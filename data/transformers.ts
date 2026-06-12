/**
 * data/transformers.ts
 * ----------------------
 * Converts raw BigQuery rows into the Politician[] shape used by all
 * components. Field names match the confirmed ariadne_tiktok_demo schema.
 */

import type { Politician, TopTrumpScores, RecentPost, AccountType, LeaderboardSortKey } from './types';
import type { PartyKey } from '@/theme/colors';
import { toPartyKeyPublic } from './partyUtils';
import { computeKnoxFactor, computeRangeKnox, activityScore, NORMALISATION_LIMITS } from './knoxConfig';
import { fmtLabel } from '@/lib/format';

// ── Raw BQ row shapes ─────────────────────────────────────────────────────────

/** account JOIN accountMetrics (latest dateUpdated) */
export interface BQAccountRow {
  // account
  id:               number;
  name:             string;    // display name
  profile:          string;    // TikTok handle — also the join key to post.profile
  party:            string;
  affiliation:      string;    // e.g. 'MP, Ashton-under-Lyne'
  displayJobTitle?: string;    // curated job title, e.g. 'MP for Ipswich' (set via admin)
  avatar?:          string;    // GCS URL for profile photo
  totalFollowing:   number;
  totalFollowers:   number;
  accountTypeNames?: string;   // comma-separated — all types for this account (STRING_AGG)
  // accountMetrics (latest row)
  totalPosts:      number;
  totalLikes:      number;
  totalViews:      number;
  totalComments:   number;
  totalShares:     number;
  totalSaves:      number;
  postsToday:      number;
  postsThisWeek:   number;   // posts in the last 7 days (recency penalty)
  postsLast28d:    number;   // posts in the last 28 days (frequency basis)
  viewsToday:      number;
  likesToday:      number;
  commentsToday:   number;
  savesToday:      number;
  followerChange:  number | null;
  // Range-specific aggregates (present when ?range= is passed to the API)
  postsInRange?:    number;
  viewsInRange?:    number;
  likesInRange?:    number;
  commentsInRange?: number;
  savesInRange?:    number;
  sharesInRange?:   number;
}

/** post rows — linked to account via post.profile = account.profile */
export interface BQPostRow {
  postId:        string;
  profile:       string;    // matches account.profile
  caption:       string;
  videoSummary:  string;
  views:         number;
  likes:         number;
  comments:      number;
  shares:        number;
  saves:         number;
  reposts:       number;
  postDate:      string;
  postUrl:       string;
  coverJpeg:     string;
  videoMp4:      string;
  styles:        string[] | null;
}

// Re-export for backward compat; use toPartyKeyPublic from partyUtils for new code.
const toPartyKey = toPartyKeyPublic;

/**
 * Normalise a profile handle: strip a leading '@' and tolerate null / undefined.
 * BigQuery LTRIM(null, '@') returns null, and some post / account rows can have
 * a null profile, so a plain string.replace would throw
 * 'Cannot read properties of null (reading replace)'.
 */
function normProfile(p: string | null | undefined): string {
  return (p ?? '').replace(/^@/, '');
}

/**
 * Resolve all account types for an account.
 * Priority: 1) DB values from account_x_accountType JOIN (comma-separated STRING_AGG)
 *           2) regex on name/affiliation  3) ['other']
 *
 * Returns an array because one account can legitimately hold multiple types —
 * e.g. a party leader who is also an MP gets ['party_leader', 'member_of_parliament'].
 * Each DB token is normalised from legacy/human-readable variants to canonical
 * snake_case values before being added to the result set.
 */
function resolveCanonicalType(raw: string): AccountType | null {
  const t = raw.trim().toLowerCase();
  if (
    t === 'member_of_parliament'    ||
    t === 'political_party'         ||
    t === 'party_leader'            ||
    t === 'prime_minister'          ||
    t === 'cabinet_minister'        ||
    t === 'shadow_cabinet_minister' ||
    t === 'council'                 ||
    t === 'other'
  ) return t as AccountType;

  if (
    t === 'mp' || t === 'msp' || t === 'am' || t === 'mla' || t === 'td' ||
    t === 'member of parliament' || t === 'elected official' || t === 'politician' ||
    t.startsWith('mp') || t.includes('member of parliament')
  ) return 'member_of_parliament';

  if (t === 'party leader' || t === 'leader')                              return 'party_leader';
  if (t === 'cabinet minister' || t === 'minister')                        return 'cabinet_minister';
  if (t === 'shadow cabinet minister' || t === 'shadow minister')          return 'shadow_cabinet_minister';
  if (t.includes('party') || t === 'political organisation')               return 'political_party';
  if (t.includes('council') || t === 'local government' || t === 'local authority') return 'council';
  return null;
}

function inferAccountTypes(name: string, affiliation: string, dbTypeNames?: string): AccountType[] {
  // 1. DB-sourced types — parse comma-separated STRING_AGG result
  if (dbTypeNames) {
    const resolved = dbTypeNames
      .split(',')
      .map(resolveCanonicalType)
      .filter((t): t is AccountType => t !== null);
    // Deduplicate while preserving order
    const unique = Array.from(new Set(resolved));
    if (unique.length > 0) return unique;
  }

  // 2. Regex fallback on name + affiliation — may infer multiple types
  const a = (affiliation ?? '').toLowerCase();
  const n = (name ?? '').toLowerCase();
  const inferred: AccountType[] = [];
  if (/\bcouncil\b/.test(n) || /\bcouncil\b/.test(a))                                    inferred.push('council');
  if (/\b(mp|msp|am|mla|lord|baron|earl|councillor|senator|mayor)\b/.test(a))            inferred.push('member_of_parliament');
  if (/\b(party|labour|conservative|libdem|snp|green|reform|plaid|dup|sinn)\b/.test(n))  inferred.push('political_party');
  if (inferred.length > 0) return inferred;

  // 3. Final fallback
  return ['other'];
}

function toInitials(name: string): string {
  if (!name) return '';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

// ── Score normalisation ───────────────────────────────────────────────────────

function normalise(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round(Math.min(100, (value / max) * 100));
}

/** Log-scaled normalisation: LN(1+value)/LN(1+max)·100. Spreads heavy-tailed
 *  inputs (followers, virality) instead of letting one outlier flatten the rest. */
function logNormalise(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round(Math.min(100, (Math.log1p(Math.max(0, value)) / Math.log1p(max)) * 100));
}

/**
 * Raw (unclamped) reach-per-follower ratio for a window. Used ONLY as a
 * leaderboard tie-breaker so accounts that clamp to the same virality score
 * still order by true reach (higher reach can never sit below lower reach).
 * Never feeds the displayed score or Knox.
 */
export function viralityRatioFor(p: Politician, isLifetime: boolean): number {
  const f = p.totals.followers;
  if (f <= 0) return 0;
  const views = isLifetime ? p.totals.views : p.totals.viewsInRange;
  const posts = isLifetime ? p.totals.posts : p.totals.postsInRange;
  return posts > 0 ? views / posts / f : 0;
}

/**
 * Raw axis inputs for one account. SINGLE source of the scoring inputs — used by
 * both the dataset-max pass and per-account scoring so the two can never drift.
 * All lifetime-based, mirroring scripts/knox-mps-scored.sql.
 */
interface RawAxes {
  viralityRaw:   number;  // clamped lifetime avgViews / followers
  engRate:       number;  // clamped lifetime engagement %
  postsLast28d:  number;  // posts in the last 28 days (frequency basis)
  postsLast7d:   number;  // posts in the last 7 days (recency penalty)
  followers:     number;  // lifetime total followers
  lifetimePosts: number;  // lifetime total posts (low-volume penalty)
  avgViews:      number;  // lifetime average views per post (low-views penalty)
}

/**
 * Winsorised virality ratio + clamped engagement % from a post set's totals.
 * SHARED by rawAxes (lifetime) and rangeAxes (range-scoped) so the two
 * scoring paths can never drift apart. Pure mechanical extraction of the
 * locked formula — virality is per-post reach as a fraction of audience,
 * winsorised so tiny-account outliers can't poison the dataset max;
 * engagement is interactions/views clamped at the configured limit.
 */
function clampedRatios(
  posts: number, views: number, interactions: number, followers: number,
): { viralityRaw: number; engRate: number } {
  const avgViews        = posts > 0 ? views / posts : 0;
  const viralityRawTrue = followers > 0 ? avgViews / followers : 0;
  const viralityRaw     = Math.min(viralityRawTrue, NORMALISATION_LIMITS.viralityRatio);

  const engViews   = Math.max(views, 1);
  const engRateRaw = (interactions / engViews) * 100;
  const engRate    = Math.min(engRateRaw, NORMALISATION_LIMITS.engRatePct);

  return { viralityRaw, engRate };
}

function rawAxes(acc: BQAccountRow): RawAxes {
  const lifetimePosts = acc.totalPosts    ?? 0;
  const totalViews    = acc.totalViews     ?? 0;
  const followers     = acc.totalFollowers ?? 0;
  const avgViews      = lifetimePosts > 0 ? totalViews / lifetimePosts : 0;

  const { viralityRaw, engRate } = clampedRatios(
    lifetimePosts,
    totalViews,
    acc.totalLikes + acc.totalComments + acc.totalSaves + acc.totalShares,
    followers,
  );

  return {
    viralityRaw,
    engRate,
    postsLast28d: acc.postsLast28d  ?? 0,
    postsLast7d:  acc.postsThisWeek ?? 0,
    followers,
    lifetimePosts,
    avgViews,
  };
}

/**
 * Raw axis inputs computed from posts INSIDE the selected time range.
 * Mirrors rawAxes but sourced from the *InRange aggregates. Followers stays
 * lifetime — a range has no follower count. Feeds computeRangeKnox only
 * (leaderboard); lifetime Knox is untouched.
 */
interface RangeAxes {
  viralityRaw:  number;  // clamped in-range avgViews / followers
  engRate:      number;  // clamped in-range engagement %
  postsInRange: number;  // frequency basis for the range
  followers:    number;  // lifetime total followers
}

function rangeAxes(acc: BQAccountRow): RangeAxes {
  const posts     = acc.postsInRange ?? 0;
  const followers = acc.totalFollowers ?? 0;

  const { viralityRaw, engRate } = clampedRatios(
    posts,
    acc.viewsInRange ?? 0,
    (acc.likesInRange ?? 0) + (acc.commentsInRange ?? 0) +
      (acc.savesInRange ?? 0) + (acc.sharesInRange ?? 0),
    followers,
  );

  return { viralityRaw, engRate, postsInRange: posts, followers };
}

interface RangeMaxValues {
  virality:       number;
  engagementRate: number;
  postsInRange:   number;
  followers:      number;
}

function computeRangeMaxValues(rows: BQAccountRow[]): RangeMaxValues {
  let maxVirality = 0, maxEng = 1, maxPosts = 1, maxFollowers = 1;

  for (const acc of rows) {
    const r = rangeAxes(acc);
    if (r.viralityRaw  > maxVirality)  maxVirality  = r.viralityRaw;
    if (r.engRate      > maxEng)       maxEng       = r.engRate;
    if (r.postsInRange > maxPosts)     maxPosts     = r.postsInRange;
    if (r.followers    > maxFollowers) maxFollowers = r.followers;
  }

  return {
    virality:       maxVirality > 0 ? maxVirality : 1,
    engagementRate: maxEng,
    postsInRange:   maxPosts,
    followers:      maxFollowers,
  };
}

/**
 * Knox Factor computed from in-range posts only (see computeRangeKnox in
 * knoxConfig.ts for the sign-off note). Accounts with no posts in range
 * score 0 — the leaderboard filters them out anyway.
 */
function computeRangeKnoxScore(acc: BQAccountRow, max: RangeMaxValues): number {
  const r = rangeAxes(acc);
  if (r.postsInRange <= 0) return 0;

  const virality   = logNormalise(r.viralityRaw,  max.virality);
  const engagement = normalise(r.engRate,         max.engagementRate);
  const frequency  = normalise(r.postsInRange,    max.postsInRange);
  const followers  = logNormalise(r.followers,    max.followers);

  return computeRangeKnox(virality, engagement, followers, frequency);
}

/**
 * Range-scoped display/sort scores for the non-Knox axes (virality, engagement,
 * frequency), computed from in-range aggregates using the same normalisation as
 * the lifetime axes. Used by the leaderboard sort and the radar when a time
 * filter is active. Does NOT feed computeKnoxFactor — it reuses the sanctioned
 * range layer only. Accounts with no posts in range score 0.
 */
function computeRangeScores(acc: BQAccountRow, max: RangeMaxValues): { virality: number; engagement: number; frequency: number } {
  const r = rangeAxes(acc);
  if (r.postsInRange <= 0) return { virality: 0, engagement: 0, frequency: 0 };
  return {
    virality:   logNormalise(r.viralityRaw,  max.virality),
    engagement: normalise(r.engRate,         max.engagementRate),
    frequency:  normalise(r.postsInRange,    max.postsInRange),
  };
}

interface ScoreMaxValues {
  virality:       number;  // clamped virality ratio
  engagementRate: number;  // clamped engagement %
  postsLast28d:   number;  // posts in last 28 days (frequency basis for Knox)
  followers:      number;  // total followers
}

function computeMaxValues(rows: BQAccountRow[]): ScoreMaxValues {
  let maxVirality = 0, maxEng = 1, maxPosts28 = 1, maxFollowers = 1;

  for (const acc of rows) {
    const r = rawAxes(acc);
    if (r.viralityRaw  > maxVirality)  maxVirality  = r.viralityRaw;
    if (r.engRate      > maxEng)       maxEng       = r.engRate;
    if (r.postsLast28d > maxPosts28)   maxPosts28   = r.postsLast28d;
    if (r.followers    > maxFollowers) maxFollowers = r.followers;
  }

  return {
    virality:       maxVirality > 0 ? maxVirality : 1,
    engagementRate: maxEng,
    postsLast28d:   maxPosts28,
    followers:      maxFollowers,
  };
}

function computeScores(acc: BQAccountRow, max: ScoreMaxValues): TopTrumpScores {
  const r = rawAxes(acc);

  // KNOX scoring. Virality + followers are log-scaled (this is the spread fix
  // that de-clusters scores off the 50s — it must stay in Knox). Engagement is
  // linear. Frequency is the 28-day count normalised to the dataset max.
  // NOTE: the activity STEP scale is the only thing that is radar-only; it does
  // NOT feed Knox frequency.
  const virality   = logNormalise(r.viralityRaw,  max.virality);
  const engagement = normalise(r.engRate,         max.engagementRate);
  const frequency  = normalise(r.postsLast28d,    max.postsLast28d);
  const followers  = logNormalise(r.followers,    max.followers);

  // Single Knox Factor calculation, with the post-volume / recency / low-views
  // penalties applied here. This is the only place Knox Factor is computed.
  const knoxFactor = computeKnoxFactor(virality, engagement, followers, frequency, {
    lifetimePosts: r.lifetimePosts,
    postsLast7d:   r.postsLast7d,
    postsLast28d:  r.postsLast28d,
    avgViews:      r.avgViews,
  });

  return { virality, engagement, frequency, followers, knoxFactor };
}

/**
 * The score the leaderboard ranks and displays for a given sort key.
 * Knox Factor is range-scoped when a time filter is active; every other key
 * (and Knox on 'Lifetime') reads the standard scores. Single source for both
 * RankBoard sorting and RankBoardRow display so they can never disagree.
 */
export function leaderboardScore(p: Politician, key: LeaderboardSortKey, isLifetime: boolean): number {
  // Views: range-scoped view count when a filter is active, lifetime total on
  // 'Lifetime'. Not a 0–100 score — the row formats it as a raw count.
  if (key === 'views') {
    // Use the post-table sum (viewsInRange tracks the fetched range, including
    // lifetime) rather than accountMetrics.totalViews, which is incomplete or
    // zero for some accounts even when their posts have views.
    return p.totals.viewsInRange;
  }
  if (!isLifetime) {
    if (key === 'knoxFactor') return p.knoxFactorRange ?? p.scores.knoxFactor;
    // Virality / engagement / frequency are range-scoped when a filter is active.
    // Followers stays the lifetime snapshot (no per-range follower count exists).
    if (key === 'virality' || key === 'engagement' || key === 'frequency') {
      return p.scoresRange?.[key] ?? p.scores[key];
    }
  }
  return p.scores[key];
}

// ── Post transformer ──────────────────────────────────────────────────────────

/** Safely coerce a BigQuery DATE value to a plain string.
 *  The BQ Node client returns DATE fields as { value: 'YYYY-MM-DD' }
 *  when not explicitly CAST to STRING in the SQL. */
function toDateStr(v: unknown): string | undefined {
  if (!v) return undefined;
  if (typeof v === 'string') return v;
  // BigQuery Date object: { value: 'YYYY-MM-DD' }
  const bqDate = v as { value?: string };
  if (typeof bqDate.value === 'string') return bqDate.value;
  return undefined;
}

function transformPost(row: BQPostRow): RecentPost {
  return {
    // postId is already a STRING from the SQL CAST — wrap in String() as a
    // belt-and-braces safeguard for any future codepath that hands us a
    // number again. TikTok IDs exceed Number.MAX_SAFE_INTEGER so we must
    // never let them be parsed as JS Number.
    postId:    String(row.postId),
    caption:   row.caption      ?? '(no caption)',
    views:     row.views        ?? 0,
    likes:     row.likes        ?? 0,
    comments:  row.comments     ?? 0,
    shares:    row.shares       ?? 0,
    saves:     row.saves        ?? 0,
    summary:   row.videoSummary || undefined,
    styles:    Array.isArray(row.styles) ? row.styles.filter(Boolean) : undefined,
    coverJpeg: row.coverJpeg    || undefined,
    videoMp4:  row.videoMp4     || undefined,
    postUrl:   row.postUrl      || undefined,
    postDate:  toDateStr(row.postDate),
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export function transformToPoliticians(
  accountRows: BQAccountRow[],
  postRows:    BQPostRow[]
): Politician[] {
  // Group posts by normalised profile handle.
  // account.profile = '@uklabour', post.profile = 'uklabour' — strip the
  // leading '@' on both sides so the lookup always matches.
  // Skip posts with no profile, they can't link back to an account anyway.
  const postsByProfile = new Map<string, BQPostRow[]>();
  for (const post of postRows) {
    const key = normProfile(post.profile);
    if (!key) continue;
    const bucket = postsByProfile.get(key) ?? [];
    bucket.push(post);
    postsByProfile.set(key, bucket);
  }

  const max      = computeMaxValues(accountRows);
  const rangeMax = computeRangeMaxValues(accountRows);

  return accountRows.map((acc): Politician => {
    const posts = (postsByProfile.get(normProfile(acc.profile)) ?? []).slice(0, 5);
    const scores      = computeScores(acc, max);
    // Range-scoped Knox — used by the leaderboard when a time filter is
    // active. For range='lifetime' the API's date filter makes the *InRange
    // aggregates equal lifetime totals, but the leaderboard shows the true
    // (penalised) lifetime Knox in that case, not this value.
    const knoxFactorRange = computeRangeKnoxScore(acc, rangeMax);
    // Range-scoped virality/engagement/frequency for the leaderboard + radar.
    const scoresRange = computeRangeScores(acc, rangeMax);

    // RADAR-ONLY display scores. Activity = absolute 7-day step scale; followers
    // = log-scaled against the dataset max. These never feed Knox Factor.
    const radial = {
      activity:  activityScore(acc.postsThisWeek ?? 0),
      followers: logNormalise(acc.totalFollowers ?? 0, max.followers),
    };

    return {
      id:             String(acc.id),
      name:           acc.name ?? '',
      handle:         acc.profile ?? '',
      role:           acc.affiliation ?? '',
      displayJobTitle: acc.displayJobTitle || acc.affiliation || '',
      partyKey:       toPartyKey(acc.party),
      partyLabel:     fmtLabel(acc.party) || 'Unknown',
      country:        'UK',
      avatarInitials: toInitials(acc.name ?? ''),
      avatarUrl:      acc.avatar || undefined,
      accountTypes:   inferAccountTypes(acc.name ?? '', acc.affiliation ?? '', acc.accountTypeNames),
      totals: {
        posts:          acc.totalPosts     ?? 0,
        followers:      acc.totalFollowers ?? 0,
        followerChange: acc.followerChange ?? null,
        likes:          acc.totalLikes     ?? 0,
        views:          acc.totalViews     ?? 0,
        views24h:       acc.viewsToday     ?? 0,
        likesToday:     acc.likesToday     ?? 0,
        commentsToday:  acc.commentsToday  ?? 0,
        savesToday:     acc.savesToday     ?? 0,
        postsToday:     acc.postsToday     ?? 0,
        postsThisWeek:  acc.postsThisWeek  ?? 0,
        postsInRange:    acc.postsInRange    ?? 0,
        viewsInRange:    acc.viewsInRange    ?? 0,
        likesInRange:    acc.likesInRange    ?? 0,
        commentsInRange: acc.commentsInRange ?? 0,
        savesInRange:    acc.savesInRange    ?? 0,
        sharesInRange:   acc.sharesInRange   ?? 0,
      },
      scores,
      knoxFactorRange,
      scoresRange,
      radial,
      recentPosts: posts.map(transformPost),
    };
  });
}
