/**
 * data/transformers.ts
 * ----------------------
 * Converts raw BigQuery rows into the Politician[] shape used by all
 * components. Field names match the confirmed ariadne_tiktok_demo schema.
 */

import type { Politician, TopTrumpScores, RecentPost, AccountType } from './types';
import type { PartyKey } from '@/theme/colors';
import { toPartyKeyPublic } from './partyUtils';
import { computeKnoxFactor, NORMALISATION_LIMITS } from './knoxConfig';
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
  postsThisWeek:   number;
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

interface ScoreMaxValues {
  virality:       number;  // (avgViews / followers) — per-post reach as fraction of audience
  engagementRate: number;  // (likes + comments + saves + shares) / views
  postsInRange:   number;  // posts within the selected range
  totalFollowers: number;
}

function computeMaxValues(
  rows: BQAccountRow[],
  postsByProfile: Map<string, BQPostRow[]>
): ScoreMaxValues {
  let maxVirality = 0, maxEngRate = 1, maxPostsInRange = 1, maxFollowers = 1;

  for (const acc of rows) {
    const posts = postsByProfile.get(normProfile(acc.profile)) ?? [];

    // views: use range views from BQ aggregate if present, else average posts in feed
    const rangeViews = acc.viewsInRange ?? 0;
    const feedViews  = posts.reduce((s, p) => s + (p.views ?? 0), 0);
    const avgViews   = rangeViews > 0
      ? rangeViews / Math.max(acc.postsInRange ?? posts.length, 1)
      : posts.length > 0 ? feedViews / posts.length : 0;

    // virality: per-post reach as a fraction of follower base (avgViews / followers),
    // winsorised at NORMALISATION_LIMITS.viralityRatio so tiny-account outliers
    // can't poison the dataset max.
    const viralityRawTrue = acc.totalFollowers > 0 ? avgViews / acc.totalFollowers : 0;
    const viralityRaw     = Math.min(viralityRawTrue, NORMALISATION_LIMITS.viralityRatio);

    // engagement: prefer range-specific totals, fall back to lifetime.
    // Clamped at NORMALISATION_LIMITS.engRatePct because ratios above 100% are
    // a data artifact (likes exceeding undercounted views).
    const eViews    = Math.max(rangeViews > 0 ? rangeViews : (acc.totalViews ?? 1), 1);
    const eLikes    = acc.likesInRange    ?? acc.totalLikes;
    const eComments = acc.commentsInRange ?? acc.totalComments;
    const eSaves    = acc.savesInRange    ?? acc.totalSaves;
    const eShares   = acc.sharesInRange   ?? acc.totalShares;
    const engRateRaw = ((eLikes + eComments + eSaves + eShares) / eViews) * 100;
    const engRate    = Math.min(engRateRaw, NORMALISATION_LIMITS.engRatePct);

    // frequency: posts in range when available, fall back to postsThisWeek
    const postsCount = acc.postsInRange ?? acc.postsThisWeek;

    if (viralityRaw  > maxVirality)      maxVirality      = viralityRaw;
    if (engRate      > maxEngRate)       maxEngRate       = engRate;
    if (postsCount   > maxPostsInRange)  maxPostsInRange  = postsCount;
    if (acc.totalFollowers > maxFollowers) maxFollowers   = acc.totalFollowers;
  }

  return {
    virality:       maxVirality > 0 ? maxVirality : 1,
    engagementRate: maxEngRate,
    postsInRange:   maxPostsInRange,
    totalFollowers: maxFollowers,
  };
}

function computeScores(
  acc: BQAccountRow,
  posts: BQPostRow[],
  max: ScoreMaxValues
): TopTrumpScores {
  // views: prefer range aggregate, fall back to feed average
  const rangeViews = acc.viewsInRange ?? 0;
  const feedViews  = posts.reduce((s, p) => s + (p.views ?? 0), 0);
  const avgViews   = rangeViews > 0
    ? rangeViews / Math.max(acc.postsInRange ?? posts.length, 1)
    : posts.length > 0 ? feedViews / posts.length : 0;

  // virality: per-post reach as a fraction of follower base (avgViews / followers),
  // winsorised at NORMALISATION_LIMITS.viralityRatio. Must match the clamp used
  // inside computeMaxValues or the normalisation denominator and numerator drift.
  const viralityRawTrue = acc.totalFollowers > 0 ? avgViews / acc.totalFollowers : 0;
  const viralityRaw     = Math.min(viralityRawTrue, NORMALISATION_LIMITS.viralityRatio);

  // engagement: prefer range-specific totals, fall back to lifetime.
  // Clamped at NORMALISATION_LIMITS.engRatePct because >100% is a data artifact.
  const eViews    = Math.max(rangeViews > 0 ? rangeViews : (acc.totalViews ?? 1), 1);
  const eLikes    = acc.likesInRange    ?? acc.totalLikes;
  const eComments = acc.commentsInRange ?? acc.totalComments;
  const eSaves    = acc.savesInRange    ?? acc.totalSaves;
  const eShares   = acc.sharesInRange   ?? acc.totalShares;
  const engRateRaw = ((eLikes + eComments + eSaves + eShares) / eViews) * 100;
  const engRate    = Math.min(engRateRaw, NORMALISATION_LIMITS.engRatePct);

  // frequency: posts in range when available, fall back to postsThisWeek
  const postsCount = acc.postsInRange ?? acc.postsThisWeek;

  const virality   = normalise(viralityRaw,         max.virality);
  const engagement = normalise(engRate,             max.engagementRate);
  const frequency  = normalise(postsCount,          max.postsInRange);
  const followers  = normalise(acc.totalFollowers,  max.totalFollowers);

  // Knox Factor: virality (per-follower reach), engagement, followers, frequency
  const knoxFactor = computeKnoxFactor(virality, engagement, followers, frequency);

  return { virality, engagement, frequency, followers, knoxFactor };
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

  const max = computeMaxValues(accountRows, postsByProfile);

  return accountRows.map((acc): Politician => {
    const posts = (postsByProfile.get(normProfile(acc.profile)) ?? []).slice(0, 5);
    const scores      = computeScores(acc, posts, max);

    return {
      id:             String(acc.id),
      name:           acc.name ?? '',
      handle:         acc.profile ?? '',
      role:           acc.affiliation ?? '',
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
      recentPosts: posts.map(transformPost),
    };
  });
}
