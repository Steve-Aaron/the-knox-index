/**
 * lib/tenants.ts
 * ---------------
 * The tenant registry. ONE job: given a hostname, say which dashboard the
 * request belongs to and how that dashboard should look, group and gate.
 *
 * Isomorphic — safe to import from BOTH server routes and client components.
 * It must never import BigQuery, Firebase, or anything Node-only.
 *
 * ── Adding a new subdomain ─────────────────────────────────────────────────
 * 1. Add a row to the `dashboard` table in BigQuery, note its id
 * 2. Add a TenantConfig entry below with that `dashboardId` and a `subdomain`
 * 3. Add the domain in Vercel (Project → Settings → Domains)
 * Nothing else changes: every query, label, map and gate reads this file.
 * ───────────────────────────────────────────────────────────────────────────
 */

/** Stable internal id. Used in analytics props and access records. */
export type TenantId = 'uk' | 'world';

/** How accounts are bucketed in the leaderboard widget and feed filter. */
export type GroupingMode = 'party' | 'region';

/** Which hero map the tenant renders: the UK silhouette, the rotating globe,
 *  or nothing at all. */
export type MapMode = 'uk' | 'world' | 'none';

export interface TenantAccess {
  /** 'public' — anyone may read. 'authenticated' — a signed-in, allowed user only. */
  mode: 'public' | 'authenticated';
  /**
   * Email domains that are allowed automatically, no approval needed.
   * Compared case-insensitively against the part after '@'.
   */
  allowedDomains: readonly string[];
  /**
   * When true, a signed-in user OUTSIDE allowedDomains needs an approved
   * record in the tenant_access table. When false, any signed-in user is in.
   */
  requireApproval: boolean;
}

export interface TenantConfig {
  id: TenantId;
  /** `dashboard.id` in BigQuery — the value the account_x_dashboard gate filters on. */
  dashboardId: number;
  /** Subdomain label, e.g. 'worldleaders'. Null for the apex/root site. */
  subdomain: string | null;
  /** Exact hostnames that resolve to this tenant (no port, lowercase). */
  hosts: readonly string[];
  brand: {
    /** The product name. The same on every tenant — this is one product. */
    name:        string;
    nameShort:   string;
    kicker:      string;
    /**
     * What distinguishes this tenant, shown under the headline and appended
     * where a message has to name the dashboard. Undefined on the root site.
     */
    subtitle?:   string;
    /** Hero headline, one word per line. */
    headlineWords: readonly string[];
    tagline:     string;
    description: string;
    /** What the tracked accounts are called in headline labels, e.g. 'Politicians'. */
    subjectPlural: string;
    /** Shorter form for running copy, e.g. 'MPs'. */
    subjectShort: string;
  };
  grouping: {
    mode: GroupingMode;
    /** Singular noun for one bucket, e.g. 'Party' / 'Region'. */
    label: string;
    /** Kicker on the bucket leaderboard widget, e.g. 'PARTY LEAGUE'. */
    boardKicker: string;
    /** Headline question on that widget. */
    boardQuestion: string;
    /** Info-tip copy explaining what the widget is for. */
    boardInfo: string;
  };
  map: MapMode;
  access: TenantAccess;
}

/** Root domain the subdomains hang off. */
export const ROOT_HOST = 'index.knox.digital';

export const TENANTS: readonly TenantConfig[] = [
  {
    id:          'uk',
    dashboardId: 1,
    subdomain:   null,
    hosts: [
      ROOT_HOST,
      'theknoxindex.knox.digital',
      'localhost',
      '127.0.0.1',
    ],
    brand: {
      name:          'The Knox Index',
      nameShort:     'Knox Index',
      kicker:        'THE KNOX INDEX',
      headlineWords: ['THE', 'KNOX', 'INDEX'],
      tagline:       'Learn how UK politicians use TikTok, in real time. Get insights live on our dashboard below, and bespoke email insights every day.',
      description:   'Daily intelligence on how UK politicians perform on TikTok — ranked, scored, and briefed.',
      subjectPlural: 'Politicians',
      subjectShort:  'MPs',
    },
    grouping: {
      mode:          'party',
      label:         'Party',
      boardKicker:   'PARTY LEAGUE',
      boardQuestion: "Who's winning the party engagement war?",
      boardInfo:     "Politicians grouped by party and totalled. Use this to answer 'which party is dominating TikTok this week' and 'which party is most active'. Tap a party row to filter the post feed below.",
    },
    map: 'uk',
    access: { mode: 'public', allowedDomains: [], requireApproval: false },
  },
  {
    id:          'world',
    dashboardId: 2,
    subdomain:   'worldleaders',
    hosts: [
      `worldleaders.${ROOT_HOST}`,
      'worldleaders.localhost',
    ],
    brand: {
      name:          'The Knox Index',
      nameShort:     'World Leaders',
      kicker:        'THE KNOX INDEX',
      subtitle:      'World Leaders',
      headlineWords: ['THE', 'KNOX', 'INDEX'],
      tagline:       'Learn how the world’s heads of state and government use TikTok, in real time. Live rankings, regional breakdowns and daily intelligence.',
      description:   'Daily intelligence on how world leaders perform on TikTok — ranked, scored, and briefed.',
      subjectPlural: 'World leaders',
      subjectShort:  'world leaders',
    },
    grouping: {
      mode:          'region',
      label:         'Region',
      boardKicker:   'REGION LEAGUE',
      boardQuestion: 'Which part of the world is winning on TikTok?',
      boardInfo:     'Leaders grouped by region and totalled. Use this to answer which part of the world is dominating TikTok this week, and which is most active. Tap a region row to filter the post feed below.',
    },
    map: 'world',
    access: {
      mode:            'authenticated',
      allowedDomains:  ['knoxdigi.com', 'knox.digital'],
      requireApproval: true,
    },
  },
] as const;

export const DEFAULT_TENANT: TenantConfig = TENANTS[0];

/**
 * Lookup by ANY identifier for a tenant. Falls back to the default tenant.
 *
 * The dashboard id is the canonical identifier — it is what the data itself is
 * keyed by in `account_x_dashboard`, so `?tenant=2` says exactly which
 * dashboard is on screen. The slug ('uk', 'world') is accepted as a readable
 * alias wherever a human types it.
 *
 *   tenantById(2)        → World Leaders
 *   tenantById('2')      → World Leaders
 *   tenantById('world')  → World Leaders
 */
export function tenantById(id: string | number | null | undefined): TenantConfig {
  if (id === null || id === undefined) return DEFAULT_TENANT;

  const raw = String(id).trim().toLowerCase();
  if (!raw) return DEFAULT_TENANT;

  // Numeric first: a dashboard id is unambiguous and is what BigQuery holds.
  if (/^\d+$/.test(raw)) {
    return TENANTS.find(t => t.dashboardId === Number(raw)) ?? DEFAULT_TENANT;
  }

  return TENANTS.find(t => t.id === raw) ?? DEFAULT_TENANT;
}

/** Lookup by dashboard id alone. Null when no tenant serves that dashboard. */
export function tenantByDashboardId(dashboardId: number): TenantConfig | null {
  return TENANTS.find(t => t.dashboardId === dashboardId) ?? null;
}

/** True when the value names a tenant this build serves. */
export function isKnownTenant(id: string | number | null | undefined): boolean {
  if (id === null || id === undefined) return false;
  const raw = String(id).trim().toLowerCase();
  if (!raw) return false;
  return /^\d+$/.test(raw)
    ? TENANTS.some(t => t.dashboardId === Number(raw))
    : TENANTS.some(t => t.id === raw);
}

/** Strip port, lowercase, drop a trailing dot. '' for empty input. */
function normaliseHost(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.trim().toLowerCase().split(',')[0].trim().replace(/\.$/, '').split(':')[0];
}

/**
 * Host → tenant. Three passes, most specific first:
 *   1. exact host match (production domains + dev aliases)
 *   2. first label match against `subdomain` (covers preview deploys such as
 *      worldleaders.some-branch.vercel.app and any future *.index.knox.digital)
 *   3. default tenant
 */
export function resolveTenant(host: string | null | undefined): TenantConfig {
  const h = normaliseHost(host);
  if (!h) return DEFAULT_TENANT;

  const exact = TENANTS.find(t => t.hosts.includes(h));
  if (exact) return exact;

  const label = h.split('.')[0];
  const byLabel = TENANTS.find(t => t.subdomain !== null && t.subdomain === label);
  if (byLabel) return byLabel;

  return DEFAULT_TENANT;
}

/**
 * The tenant's name with its subtitle, for anywhere that has to say WHICH
 * dashboard it means: emails, the access gate, the admin list. The hero shows
 * the two separately.
 */
export function tenantFullName(tenant: TenantConfig): string {
  return tenant.brand.subtitle
    ? `${tenant.brand.name} — ${tenant.brand.subtitle}`
    : tenant.brand.name;
}

/** Canonical https origin for a tenant — used in metadata and email links. */
export function tenantOrigin(tenant: TenantConfig): string {
  return `https://${tenant.hosts[0]}`;
}

/** True when the email's domain is on this tenant's automatic allowlist. */
export function isAllowedDomain(email: string | null | undefined, tenant: TenantConfig): boolean {
  if (!email) return false;
  const domain = email.trim().toLowerCase().split('@')[1] ?? '';
  if (!domain) return false;
  return tenant.access.allowedDomains.some(d => d.toLowerCase() === domain);
}
