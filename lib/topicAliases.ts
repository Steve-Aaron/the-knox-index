/**
 * lib/topicAliases.ts
 * --------------------
 * TikTok posts are still tagged with the old topic list
 * (ariadne_tiktok_demo.topic); X uses the final list (metadata.topic). Until
 * the backend moves TikTok onto the final list, the site matches the two
 * here: an old topic with the same name as a final one matches it directly,
 * and the names below are matched by hand. An old topic that matches nothing
 * shows as 'Other topics'.
 *
 * Site-side only and a stopgap: no BigQuery table holds this.
 *
 * One job: say which final topic an old TikTok topic name means.
 */

/** Old TikTok topic name → topic name on the final list. */
export const TIKTOK_TOPIC_ALIASES: Readonly<Record<string, string>> = {
  DEMOCRACY: 'ELECTIONS', DEMOCHRACY: 'ELECTIONS',
  LOCAL_GOVERNMENT: 'LOCAL_GOV', BUSINESS_AND_INDUSTRY: 'BUSINESS', JUSTICE: 'COURTS_AND_SENTENCING',
  CRIME_AND_POLICING: 'POLICING', EQUALITY: 'EQUALITY_AND_RIGHTS', LABOUR: 'PARTY_POLITICS',
  JOBS_AND_WAGES: 'EMPLOYMENT', REFORM_UK: 'PARTY_POLITICS', SCOTLAND_POLITICS: 'SCOTLAND',
  CLIMATE: 'CLIMATE_CHANGE', MEDIA: 'MEDIA_PRESS_COVERAGE', SPORT: 'OTHER_SPORT',
  EU_POLITICS: 'EUROPEAN_UNION', CONSERVATIVES: 'PARTY_POLITICS', KEIR_STARMER: 'LEADERSHIP',
  WALES_POLITICS: 'WALES', NIGEL_FARAGE: 'LEADERSHIP', SNP: 'PARTY_POLITICS',
  GREEN_PARTY: 'PARTY_POLITICS', UKRAINE_AND_RUSSIA: 'UKRAINE', USA_POLITICS: 'UNITED_STATES',
  DONALD_TRUMP: 'UNITED_STATES', LGBTQ_AND_TRANS: 'LGBT_RIGHTS', PLAID_CYMRU: 'PARTY_POLITICS',
  LIB_DEMS: 'PARTY_POLITICS', PENSIONS: 'STATE_PENSION', KEMI_BADENOCH: 'LEADERSHIP',
  HEALTH: 'HEALTHCARE', ATTACK_AD: 'PARTISAN_ATTACK', ATTACK: 'PARTISAN_ATTACK',
  ELECTION: 'ELECTIONS', SCOTTISH_POLITICS: 'SCOTLAND', PM: 'LEADERSHIP',
  PUBLIC_SERVICES: 'LOCAL_SERVICES', LABOUR_PARTY: 'PARTY_POLITICS', PARLIAMENT: 'PARLIAMENTARY_AFFAIRS',
  TECHNOLOGY: 'TECH_AND_DIGITAL', HOMEBUILDING: 'HOUSEBUILDING', PLAID_CYRU: 'PARTY_POLITICS',
  ENERGY_POLICY: 'ENERGY', DEMONY: 'FOREIGN_AFFAIRS', NORTHERN_ISLAND: 'NORTHERN_IRELAND',
  PLAID_CYMU: 'PARTY_POLITICS', HOUSING_POLICY: 'HOUSING', PLAID_CYMURU: 'PARTY_POLITICS',
  DEMONYM: 'FOREIGN_AFFAIRS', PUBLIC_SAFETY: 'CRIME', POLITICAL_CRITICISM: 'PARTISAN_ATTACK',
  WELSH_POLITICS: 'WALES', REFORM: 'PARTY_POLITICS', NEWS: 'MEDIA_PRESS_COVERAGE',
  WATER_PRIVATISATION: 'WATER', PUBLIC_OWNERSHIP: 'ECONOMY', POLITICAL_CAMPAIGN: 'CAMPAIGNS',
  DUP: 'PARTY_POLITICS', POLITICAL_LEADERSHIP: 'LEADERSHIP', JOBS_AND_INDUSTRY: 'EMPLOYMENT',
  ELECTION_CAMPAIGN: 'CAMPAIGNS', CAMPAIGNING: 'CAMPAIGNS', NORTHERN_INELAND: 'NORTHERN_IRELAND',
  HEALTH_CARE: 'HEALTHCARE', PLAID_CYMUR: 'PARTY_POLITICS', FUEL_PRICES: 'COST_OF_LIVING',
};

/** Old TikTok 'topics' that are really styles, so they are not counted as subjects. */
export const TIKTOK_TOPICS_THAT_ARE_STYLES: readonly string[] = [
  'POLICY_ANNOUNCEMENT', 'EVENT_APPEARANCE', 'NEWS_CLIP', 'FIELD_VISIT', 'INTERVIEW',
];

const quote = (s: string) => `'${s.replace(/'/g, "\\'")}'`;

/**
 * The alias list as a SQL derived table (old_name, new_name), joined on the
 * upper-cased old name. Built from the constants above, so it carries no
 * user input.
 */
export function tiktokTopicAliasSql(): string {
  const rows = Object.entries(TIKTOK_TOPIC_ALIASES)
    .map(([from, to]) => `STRUCT(${quote(from.toUpperCase())} AS old_name, ${quote(to)} AS new_name)`);
  return `UNNEST([${rows.join(', ')}])`;
}

/** SQL list of the style-like old topic names, for `NOT IN (...)`. */
export function tiktokStyleTopicsSql(): string {
  return TIKTOK_TOPICS_THAT_ARE_STYLES.map(quote).join(', ');
}
