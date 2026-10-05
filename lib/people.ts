/**
 * lib/people.ts
 * --------------
 * Server-side only. Creating a person by hand, from the admin tie-in queue.
 *
 * The backfill (002) builds a person from every TikTok account. This is the
 * other door: somebody appears on X whom we do not track on TikTok, so there is
 * no person for their account to point at. Rather than leave the account
 * unlinked, an admin creates the person here and the link is made in the same
 * action.
 *
 * Two rules keep this from colliding with the backfill:
 *   - the id is derived from the platform AND the account, so an X-origin
 *     person can never take the id the backfill would give a TikTok account
 *   - the slug is checked against every existing slug, not just this batch
 *
 * One job: make a person, safely, from an account that has none.
 */

import { createHash } from 'node:crypto';
import { metadataRef, query, queryParams } from '@/lib/bigquery';
import { isRegionKey, type RegionKey } from '@/lib/regions';
import COUNTRIES from '@/data/countries.json';

export type PersonOrigin = 'tiktok' | 'x' | 'manual';

/** A country as the create-person form offers it. */
export interface Country {
  country_iso2: string;
  country:      string;
  continent:    string;
  region:       string;
  latitude:     number;
  longitude:    number;
}

export const COUNTRY_LIST: readonly Country[] = COUNTRIES as Country[];

const COUNTRY_BY_ISO = new Map(COUNTRY_LIST.map(c => [c.country_iso2, c]));

/**
 * Deterministic id, namespaced by platform. 002 uses `person:<tiktokId>`, so
 * `person:x:<authorId>` can never collide with it even if the two ids match.
 */
export function personIdFor(platform: PersonOrigin, accountId: string): string {
  const seed = platform === 'tiktok' ? `person:${accountId}` : `person:${platform}:${accountId}`;
  const h = createHash('sha256').update(seed).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/** Same rule as the backfill, so slugs from either door look alike. */
export function slugify(value: string): string {
  return String(value ?? '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

export interface NewPerson {
  name:            string;
  displayJobTitle?: string;
  party?:          string;
  wing?:           string;
  countryIso2?:    string;
  constituency?:   string;
  /** The account this person is being created for. */
  platform:        PersonOrigin;
  accountId:       string;
  /** Falls back to the name when the account has no handle worth slugging. */
  handle?:         string;
  createdBy:       string;
}

export interface CreatedPerson {
  personId: string;
  slug:     string;
  region:   RegionKey;
}

/** A slug nobody is using yet: the name, then the handle, then a counter. */
async function uniqueSlug(name: string, handle?: string): Promise<string> {
  const taken = new Set(
    (await query<{ slug: string }>(`SELECT slug FROM ${metadataRef('person')}`)).map(r => r.slug),
  );

  const base = slugify(name) || slugify(handle ?? '') || 'person';
  if (!taken.has(base)) return base;

  const withHandle = handle ? `${base}-${slugify(handle)}` : base;
  if (withHandle !== base && !taken.has(withHandle)) return withHandle;

  for (let n = 2; n < 100; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error(`Could not find a free slug for '${name}'`);
}

/**
 * Write the person. MERGE rather than INSERT so a double submit, or a second
 * admin working the same row, updates rather than duplicating.
 */
export async function createPerson(input: NewPerson): Promise<CreatedPerson> {
  const name = input.name.trim();
  if (!name) throw new Error('A name is required');

  const country = input.countryIso2 ? COUNTRY_BY_ISO.get(input.countryIso2.toUpperCase()) : undefined;
  if (input.countryIso2 && !country) throw new Error(`Unknown country code '${input.countryIso2}'`);

  const personId = personIdFor(input.platform, input.accountId);
  const slug     = await uniqueSlug(name, input.handle);
  const region   = isRegionKey(country?.region) ? country.region : 'unknown';

  await queryParams(`
    MERGE ${metadataRef('person')} T
    USING (SELECT
      @personId AS person_id, @slug AS slug, @name AS name,
      @jobTitle AS display_job_title, @party AS party, @wing AS wing,
      STRUCT(
        @countryIso2 AS country_iso2, @country AS country, @continent AS continent,
        @region AS region, @constituency AS constituency,
        @latitude AS latitude, @longitude AS longitude
      ) AS location,
      @sourceAccountId AS source_account_id, @sourcePlatform AS source_platform,
      @createdBy AS created_by
    ) S
    ON T.person_id = S.person_id
    WHEN MATCHED THEN UPDATE SET
      name = S.name, display_job_title = S.display_job_title, party = S.party,
      wing = S.wing, location = S.location, updated_at = CURRENT_TIMESTAMP()
    WHEN NOT MATCHED THEN INSERT (
      person_id, slug, name, display_job_title, party, wing, location,
      is_active, source_account_id, source_platform, created_by,
      created_at, updated_at
    ) VALUES (
      S.person_id, S.slug, S.name, S.display_job_title, S.party, S.wing, S.location,
      TRUE, S.source_account_id, S.source_platform, S.created_by,
      CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()
    )`,
    {
      personId, slug, name,
      jobTitle:        input.displayJobTitle?.trim() || null,
      party:           input.party?.trim() || null,
      wing:            input.wing?.trim() || null,
      countryIso2:     country?.country_iso2 ?? null,
      country:         country?.country     ?? null,
      continent:       country?.continent   ?? null,
      region,
      constituency:    input.constituency?.trim() || null,
      latitude:        country?.latitude  ?? null,
      longitude:       country?.longitude ?? null,
      sourceAccountId: input.accountId,
      sourcePlatform:  input.platform,
      createdBy:       input.createdBy,
    },
    {
      personId: 'STRING', slug: 'STRING', name: 'STRING',
      jobTitle: 'STRING', party: 'STRING', wing: 'STRING',
      countryIso2: 'STRING', country: 'STRING', continent: 'STRING',
      region: 'STRING', constituency: 'STRING',
      latitude: 'FLOAT64', longitude: 'FLOAT64',
      sourceAccountId: 'STRING', sourcePlatform: 'STRING', createdBy: 'STRING',
    },
  );

  return { personId, slug, region: region as RegionKey };
}
