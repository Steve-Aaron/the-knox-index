#!/usr/bin/env node
/**
 * scripts/generate-leader-regions.mjs
 * -----------------------------------
 * Generates data/leaderRegions.ts — the handle → country / region / coordinate
 * lookup that the World Leaders tenant groups and maps by.
 *
 * Why a generated file and not a BigQuery column: `account` is maintained by
 * the n8n ingest from a Sheet and has no country field. Keeping the mapping in
 * the repo makes it reviewable, diffable and available to BOTH the client
 * (region filter chips, world map markers) and the server (region → handle
 * filter) with no extra query.
 *
 * Adding a leader: add the handle → ISO 3166-1 alpha-2 pair to HANDLE_ISO
 * below and re-run. Country names, regions and centroid coordinates come from
 * the world-countries dataset, so they are never hand-typed.
 *
 * Run: node scripts/generate-leader-regions.mjs
 */

import { writeFileSync } from 'node:fs';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID  = process.env.BIGQUERY_PROJECT_ID ?? 'project-ariadne';
const DATASET     = process.env.BIGQUERY_DATASET    ?? 'ariadne_tiktok_demo';
const CREDS       = (process.env.GOOGLE_APPLICATION_CREDENTIALS ?? '').trim();
const DASHBOARD_ID = 2;
const COUNTRIES_URL = 'https://cdn.jsdelivr.net/npm/world-countries@5.1.0/countries.json';
const OUT = 'data/leaderRegions.ts';

/** TikTok handle (no '@', lower-case) → ISO 3166-1 alpha-2 country code. */
const HANDLE_ISO = {
  realdonaldtrump: 'US', nayibbukele: 'SV', claudiasheinbaum: 'MX', emmanuelmacron: 'FR',
  lulaoficial: 'BR', giorgiameloni_ufficiale: 'IT', gustavopetrooficial: 'CO', javiermileii: 'AR',
  keikofujimorih: 'PE', danielnoboaok: 'EC', delaespriella_style: 'CO', bnetanyahu: 'IL',
  'bongbong.marcos': 'PH', anwaribrahimofficial: 'MY', bernardoarevalogt: 'GT', manethuncambodia: 'KH',
  sanchezcastejon: 'ES', prabowosubianto08: 'ID', rodrigopazpereira: 'BO', balenshah: 'NP',
  yoweri_kagutamuseveni: 'UG', joseantoniokast: 'CL', abiyahmedali: 'ET', magyarpeterofficial: 'HU',
  nawrocki25: 'PL', donald_tusk: 'PL', jaemyung_lee: 'KR', santipenap: 'PY',
  'president.az': 'AZ', abdelmadjid_tebboune_: 'DZ', 'hakainde.hichilema': 'ZM', nicusordanro: 'RO',
  'nikol.pashinyan_pm': 'AM', lawrencewongst: 'SG', hhshkmohd: 'AE', hassansheikhmohamud1960: 'SO',
  andrewmholness: 'JM', keirstarmer: 'GB', 'president.adama.barrow': 'GM', kyriakosmitsotakis_: 'GR',
  jasamaleksandar: 'RS', 'presedinta.maiasandu': 'MD', andrejbabis: 'CZ', paulkagameofficial: 'RW',
  luisabinadercorona: 'DO', wadagniromuald: 'BJ', anurakumaraofficial: 'LK', advocateduma_boko: 'BW',
  sonkoofficiel: 'SN', merzcdu: 'DE', christopherluxonmp: 'NZ', mahmoudridaabbas: 'PS',
  daniel_chapo24: 'MZ', jdmahama: 'GH', vanderbellen: 'AT', fegnassingbe: 'TG',
  shehbazism: 'PK', alexstubb: 'FI', albomp: 'AU', robjettend66: 'NL',
  ediramatiktok: 'AL', joseraulmulino: 'PA', hamza_barre: 'SO', prdiomaye: 'SN',
  jonasgahrstore: 'NO', 'tharman.sg': 'SG', mmuizzu: 'MV', mamottley: 'BB',
  peter_pellegrini: 'SK', julius_maadabio: 'SL', plenkovic_andrej: 'HR', 'ilie.bolojan': 'RO',
  orsiyamandu: 'UY', ulfkristersson: 'SE', sitivenirabukaofficial: 'FJ', ajseguro: 'PT',
  michealmartintd: 'IE', sadyrnurgozhoevich: 'KG', 'robertabela.mt': 'MT', 'dr.denisbecirovic': 'BA',
  presidentofzimbab: 'ZW', ncrmru: 'MU', jennifergsimons: 'SR', 'natasa.pirc.musar': 'SI',
  lmontenegro_pt: 'PT', 'alexandru.munteanu.pm': 'MD', coolbergs: 'LV', 'ismail.omar.guelleh': 'DJ',
  jjansa_sds: 'SI', prpaulbiya: 'CM', siljanovskadavkova: 'MK', ttobgay: 'BT',
  nawafasalam: 'LB', pmkamlapersadbissessar: 'TT', bravedavisofficial: 'BS', aziz_akhannouch: 'MA',
  johnbricenobze: 'BZ', mickoski_hristijan: 'MK', 'philipj.pierre': 'LC', mette_insider_official: 'DK',
  nikoschristodoulides: 'CY', 'r.nabbanja': 'UG', kristrunfrostadottir: 'IS', petteriorpo: 'FI',
  mickeyspajic: 'ME', ignazio_cassis: 'CH', skerritr: 'DM', dr_godwinfriday: 'VC',
  'mr.luc.frieden': 'LU', dickonmitchell: 'GD', guyparmelin: 'CH', 'kristen.michal': 'EE',
  'patrick.herminie': 'SC',
};

/**
 * Countries the dataset files under 'Asia' that belong in the Middle East
 * bucket politically. Western-Asian states that read as European on a
 * dashboard (Armenia, Azerbaijan, Cyprus, Georgia) are deliberately absent.
 */
const MIDDLE_EAST = new Set([
  'IL','LB','PS','AE','SA','QA','KW','OM','BH','JO','IQ','IR','YE','SY','TR','EG',
]);

/**
 * Transcontinental states the dataset files under 'Asia' that sit in European
 * political structures (Council of Europe, EU accession, UEFA) and read as
 * European on this dashboard.
 */
const EUROPE_OVERRIDE = new Set(['AM','AZ','CY','GE']);

/** world-countries `region` → our RegionKey. */
const REGION_FROM_DATASET = {
  Europe:   'europe',
  Americas: 'americas',
  Africa:   'africa',
  Asia:     'asia',
  Oceania:  'oceania',
};

function regionKeyFor(country) {
  if (EUROPE_OVERRIDE.has(country.cca2)) return 'europe';
  if (MIDDLE_EAST.has(country.cca2))     return 'middleeast';
  return REGION_FROM_DATASET[country.region] ?? 'unknown';
}

// ── Load inputs ───────────────────────────────────────────────────────────────

const opts = { projectId: PROJECT_ID };
if (CREDS) {
  if (CREDS.startsWith('{')) opts.credentials = JSON.parse(CREDS);
  else opts.keyFilename = CREDS;
}
const bq = new BigQuery(opts);

const [handleRows] = await bq.query({
  location: 'EU',
  query: `
    SELECT LTRIM(LOWER(a.profile), '@') AS handle, COALESCE(a.displayName, a.name) AS name
    FROM \`${PROJECT_ID}.${DATASET}.account\` a
    JOIN \`${PROJECT_ID}.${DATASET}.account_x_dashboard\` d
      ON CAST(d.accountId AS STRING) = CAST(a.id AS STRING)
    WHERE d.dashboardId = ${DASHBOARD_ID}
    ORDER BY handle`,
});

const countries = await fetch(COUNTRIES_URL).then(r => r.json());
const byIso = new Map(countries.map(c => [c.cca2, c]));

// ── Build rows ────────────────────────────────────────────────────────────────

const entries = [];
const missing = [];

for (const { handle } of handleRows) {
  const iso = HANDLE_ISO[handle];
  if (!iso) { missing.push(handle); continue; }
  const country = byIso.get(iso);
  if (!country) { missing.push(`${handle} (unknown ISO ${iso})`); continue; }
  const [lat, lng] = country.latlng;
  entries.push({
    handle,
    iso2:    iso,
    country: country.name.common,
    region:  regionKeyFor(country),
    lat,
    lng,
  });
}

entries.sort((a, b) => a.handle.localeCompare(b.handle));

const body = entries
  .map(e => `  '${e.handle}': { handle: '${e.handle}', iso2: '${e.iso2}', country: ${JSON.stringify(e.country)}, region: '${e.region}', lat: ${e.lat}, lng: ${e.lng} },`)
  .join('\n');

const file = `/**
 * data/leaderRegions.ts
 * ---------------------
 * GENERATED by scripts/generate-leader-regions.mjs — do not edit by hand.
 * Re-run that script after adding accounts to the World Leaders dashboard.
 *
 * Handle → country, region and map coordinate for every account on the World
 * Leaders dashboard. Isomorphic: the client groups and plots with it, the
 * server turns a region filter back into a handle list.
 *
 * Coordinates are country centroids from the world-countries dataset, in
 * degrees (lat -90..90, lng -180..180). lib/world-map.ts projects them.
 *
 * Generated: ${new Date().toISOString().slice(0, 10)} · ${entries.length} accounts
 */

export type RegionKey =
  | 'europe'
  | 'americas'
  | 'africa'
  | 'asia'
  | 'middleeast'
  | 'oceania'
  | 'unknown';

export interface LeaderLocation {
  handle:  string;
  iso2:    string;
  country: string;
  region:  RegionKey;
  lat:     number;
  lng:     number;
}

export const REGION_KEYS: readonly RegionKey[] = [
  'europe', 'americas', 'africa', 'asia', 'middleeast', 'oceania', 'unknown',
];

export const REGION_LABELS: Record<RegionKey, string> = {
  europe:     'Europe',
  americas:   'Americas',
  africa:     'Africa',
  asia:       'Asia',
  middleeast: 'Middle East',
  oceania:    'Oceania',
  unknown:    'Unknown',
};

/** Keyed by bare lower-case handle (no leading '@'). */
export const LEADER_LOCATIONS: Record<string, LeaderLocation> = {
${body}
};

/** Normalise any handle spelling to the lookup key. */
export function handleKey(handle: string | null | undefined): string {
  return (handle ?? '').trim().toLowerCase().replace(/^@+/, '');
}

export function locationForHandle(handle: string | null | undefined): LeaderLocation | null {
  return LEADER_LOCATIONS[handleKey(handle)] ?? null;
}

export function regionForHandle(handle: string | null | undefined): RegionKey {
  return locationForHandle(handle)?.region ?? 'unknown';
}

export function countryForHandle(handle: string | null | undefined): string {
  return locationForHandle(handle)?.country ?? '';
}

/** Every handle in a region — the server's region → post filter. */
export function handlesInRegion(region: string): string[] {
  return Object.values(LEADER_LOCATIONS)
    .filter(l => l.region === region)
    .map(l => l.handle);
}
`;

writeFileSync(OUT, file);
console.log(`✓ ${OUT} — ${entries.length} accounts mapped`);
if (missing.length) {
  console.warn(`⚠ ${missing.length} account(s) with no country mapping:`);
  for (const m of missing) console.warn(`   - ${m}`);
  process.exitCode = 1;
}
