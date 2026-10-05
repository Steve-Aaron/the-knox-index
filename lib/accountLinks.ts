/**
 * lib/accountLinks.ts
 * --------------------
 * Server-side only. Reads and writes metadata.account_link — the table that
 * says which platform account belongs to which person.
 *
 * The matcher (scripts/metadata/004-link-accounts.mjs) proposes; a human
 * confirms or rejects on /admin/links. Nothing downstream — the photo view,
 * the writeback onto twitter.account — trusts a row until its status is
 * 'confirmed', so a wrong guess is inert until somebody agrees with it.
 *
 * One job: the link queue's data access.
 */

import { metadataRef, tableRef, query, queryParams } from '@/lib/bigquery';

export type LinkPlatform   = 'tiktok' | 'x';
export type LinkStatus     = 'proposed' | 'confirmed' | 'rejected';
export type LinkConfidence = 'exact' | 'high' | 'medium' | 'low' | 'ambiguous' | 'none';

export const LINK_STATUSES: readonly LinkStatus[] = ['proposed', 'confirmed', 'rejected'];
export const LINK_CONFIDENCES: readonly LinkConfidence[] = ['exact', 'high', 'medium', 'low', 'ambiguous', 'none'];

/** One runner-up the matcher considered, offered to the reviewer as a swap. */
export interface LinkAlternative {
  person_id: string;
  name:      string;
  score:     number;
  method:    string;
}

/** A link row with both sides filled in, ready to render side by side. */
export interface LinkRow {
  linkId:        string;
  platform:      LinkPlatform;
  accountId:     string;
  handle:        string | null;
  accountName:   string | null;
  accountPhoto:  string | null;
  followers:     number | null;
  bio:           string | null;

  personId:      string | null;
  personName:    string | null;
  personTitle:   string | null;
  personCountry: string | null;
  personPhoto:   string | null;

  status:        LinkStatus;
  confidence:    LinkConfidence;
  score:         number | null;
  method:        string | null;
  matchedOn:     string | null;
  alternatives:  LinkAlternative[];
  reviewedBy:    string | null;
  reviewedAt:    string | null;
}

/** Row shape as BigQuery returns it, before camel-casing. */
interface BQLinkRow {
  link_id: string; platform: LinkPlatform; platform_account_id: string;
  platform_handle: string | null; platform_name: string | null;
  account_photo: string | null; followers: number | null; bio: string | null;
  person_id: string | null; person_name: string | null; person_title: string | null;
  person_country: string | null; person_photo: string | null;
  status: LinkStatus; confidence: LinkConfidence; score: number | null;
  method: string | null; matched_on: string | null; alternatives: string | null;
  reviewed_by: string | null; reviewed_at: { value: string } | string | null;
}

const asIso = (v: BQLinkRow['reviewed_at']): string | null =>
  !v ? null : typeof v === 'string' ? v : v.value;

function parseAlternatives(raw: string | null): LinkAlternative[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LinkAlternative[]) : [];
  } catch { return []; }
}

const toLinkRow = (r: BQLinkRow): LinkRow => ({
  linkId:       r.link_id,
  platform:     r.platform,
  accountId:    r.platform_account_id,
  handle:       r.platform_handle,
  accountName:  r.platform_name,
  accountPhoto: r.account_photo,
  followers:    r.followers,
  bio:          r.bio,
  personId:      r.person_id,
  personName:    r.person_name,
  personTitle:   r.person_title,
  personCountry: r.person_country,
  personPhoto:   r.person_photo,
  status:       r.status,
  confidence:   r.confidence,
  score:        r.score,
  method:       r.method,
  matchedOn:    r.matched_on,
  alternatives: parseAlternatives(r.alternatives),
  reviewedBy:   r.reviewed_by,
  reviewedAt:   asIso(r.reviewed_at),
});

/**
 * Both sides of every link, joined for review. The photo on the ACCOUNT side
 * comes from that platform's own table, never from the person, so the reviewer
 * is comparing two independent sources rather than one echoed twice.
 */
const SELECT = `
  SELECT
    l.link_id, l.platform, l.platform_account_id, l.platform_handle, l.platform_name,
    CASE l.platform WHEN 'tiktok' THEN tk.avatar WHEN 'x' THEN x.profile_picture END AS account_photo,
    CASE l.platform WHEN 'x' THEN x.followers   ELSE tk.totalFollowers END           AS followers,
    CASE l.platform WHEN 'x' THEN x.description ELSE NULL END                        AS bio,
    l.person_id, p.name AS person_name, p.display_job_title AS person_title,
    p.location.country AS person_country, ph.photo_url AS person_photo,
    l.status, l.confidence, l.score, l.method, l.matched_on, l.alternatives,
    l.reviewed_by, l.reviewed_at
  FROM ${metadataRef('account_link')} l
  LEFT JOIN ${metadataRef('person')}       p  ON p.person_id = l.person_id
  LEFT JOIN ${metadataRef('person_photo')} ph ON ph.person_id = l.person_id
  LEFT JOIN ${metadataRef('x_account')}    x  ON l.platform = 'x'      AND x.author_id = l.platform_account_id
  LEFT JOIN ${tableRef('account')}         tk ON l.platform = 'tiktok' AND CAST(tk.id AS STRING) = l.platform_account_id`;

export interface ListLinksOptions {
  platform?:   LinkPlatform;
  status?:     LinkStatus;
  confidence?: LinkConfidence;
  limit?:      number;
}

/** The review queue, strongest match first so the easy yeses come first. */
export async function listLinks(opts: ListLinksOptions = {}): Promise<LinkRow[]> {
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (opts.platform)   { where.push('l.platform   = @platform');   params.platform   = opts.platform; }
  if (opts.status)     { where.push('l.status     = @status');     params.status     = opts.status; }
  if (opts.confidence) { where.push('l.confidence = @confidence'); params.confidence = opts.confidence; }

  const sql = `${SELECT}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY l.score DESC, l.platform_name
    LIMIT ${Math.min(Math.max(opts.limit ?? 500, 1), 2000)}`;

  const rows = where.length
    ? await queryParams<BQLinkRow>(sql, params)
    : await query<BQLinkRow>(sql);
  return rows.map(toLinkRow);
}

export interface LinkCounts {
  platform:   LinkPlatform;
  status:     LinkStatus;
  confidence: LinkConfidence;
  n:          number;
}

/** How much is left to review, split the way the filters split it. */
export async function linkCounts(): Promise<LinkCounts[]> {
  return query<LinkCounts>(`
    SELECT platform, status, confidence, COUNT(*) AS n
    FROM ${metadataRef('account_link')}
    GROUP BY 1, 2, 3
    ORDER BY 1, 2, 4 DESC`);
}

export interface LinkDecision {
  linkId:   string;
  status:   LinkStatus;
  /** Set to attach a different person than the one proposed. */
  personId?: string | null;
  reviewer: string;
}

/**
 * Record a human's decision. Confirming with no person attached is refused:
 * a confirmed link that points nowhere would quietly reach the photo view and
 * the writeback as if it meant something.
 */
export async function decideLink({ linkId, status, personId, reviewer }: LinkDecision): Promise<void> {
  const setsPerson = personId !== undefined;

  await queryParams(`
    UPDATE ${metadataRef('account_link')}
    SET status      = @status,
        person_id   = ${setsPerson ? '@personId' : 'person_id'},
        reviewed_by = @reviewer,
        reviewed_at = CURRENT_TIMESTAMP(),
        updated_at  = CURRENT_TIMESTAMP()
    WHERE link_id = @linkId`,
    setsPerson
      ? { linkId, status, personId, reviewer }
      : { linkId, status, reviewer },
  );
}

/** Every person, for the reviewer's 'attach someone else' picker. */
export interface PersonOption {
  person_id: string;
  name:      string;
  title:     string | null;
  country:   string | null;
}

export async function listPeople(): Promise<PersonOption[]> {
  return query<PersonOption>(`
    SELECT person_id, name, display_job_title AS title, location.country AS country
    FROM ${metadataRef('person')}
    ORDER BY name`);
}
