/**
 * lib/topicLabel.ts
 * ------------------
 * Topic names as the site shows them. Topics are stored as upper snake case
 * ('US_RELATIONS', 'NORTHERN_IRELAND'); they read as sentence case with
 * acronyms and proper nouns kept: 'US relations', 'Northern Ireland',
 * 'NATO and alliances', 'Bosnia and Herzegovina'.
 *
 * One job: turn a stored topic name into its display label.
 */

/** Names that read badly on their own, or need more than casing. */
const OVERRIDES: Readonly<Record<string, string>> = {
  OTHER_SPORT:                  'Sport',
  MEDIA_PRESS_COVERAGE:         'Media coverage',
  RELIGION_AND_NOT_IN_TAXONOMY: 'Religion',
  TAX_NONE:                     'Tax',
  PMQS:                         'PMQs',
  DR_CONGO:                     'DR Congo',
  TURKIYE:                      'Türkiye',
  GUINEA_BISSAU:                'Guinea-Bissau',
  TIMOR_LESTE:                  'Timor-Leste',
  NAGORNO_KARABAKH:             'Nagorno-Karabakh',
  CHILDRENS_RIGHTS:             "Children's rights",
  WOMENS_RIGHTS:                "Women's rights",
  COST_OF_PVERTY:               'Cost of living',
  FILM_AND_TV:                  'Film and TV',
  LOCAL_GOV:                    'Local government',
  BY_ELECTIONS:                 'By-elections',
  BY_ELECTION:                  'By-elections',
  BYELECTIONS:                  'By-elections',
  TAX_FREE_SHOPPING:            'Tax-free shopping',
};

/** Words always in capitals. */
const ACRONYMS = new Set([
  'US', 'UK', 'EU', 'NHS', 'BBC', 'NATO', 'LGBT', 'GP', 'VAT', 'SEND', 'GMC', 'TV', 'UAE',
]);

/**
 * Proper nouns: each word capitalised, except 'and', 'of', 'the' inside the
 * name. Matched as whole words, so 'union rights' stays lower case while
 * 'European Union' does not.
 */
const PROPER_PHRASES: readonly string[] = [
  // Places that are more than one word
  'antigua and barbuda', 'bosnia and herzegovina', 'burkina faso', 'cape verde', 'cayman islands',
  'central african republic', 'chagos islands', 'costa rica', 'dominican republic', 'el salvador',
  'equatorial guinea', 'falkland islands', 'hong kong', 'ivory coast', 'latin america', 'marshall islands',
  'middle east', 'new zealand', 'north korea', 'north macedonia', 'northern cyprus', 'northern ireland',
  'papua new guinea', 'puerto rico', 'saint kitts and nevis', 'saint lucia',
  'saint vincent and the grenadines', 'san marino', 'sao tome and principe', 'saudi arabia',
  'sierra leone', 'sint maarten', 'solomon islands', 'south africa', 'south america', 'south korea',
  'south sudan', 'sri lanka', 'trinidad and tobago', 'united arab emirates', 'united kingdom',
  'united states', 'vatican city', 'western balkans', 'western sahara', 'european union',
  'house of lords', 'universal credit', 'national insurance', 'cancer research uk',
];

/** Single proper-noun words: places, faiths and the like. */
const PROPER_WORDS = new Set([
  'afghanistan', 'africa', 'albania', 'algeria', 'amazonia', 'andorra', 'angola', 'antarctica',
  'argentina', 'armenia', 'australia', 'austria', 'azerbaijan', 'bahamas', 'bahrain', 'baltic',
  'bangladesh', 'barbados', 'belarus', 'belgium', 'belize', 'benin', 'bhutan', 'bolivia', 'botswana',
  'brazil', 'brexit', 'brunei', 'bulgaria', 'burundi', 'cambodia', 'cameroon', 'canada', 'caribbean',
  'caucasus', 'chad', 'chile', 'china', 'colombia', 'comoros', 'congo', 'croatia', 'cuba', 'cyprus',
  'czechia', 'denmark', 'english', 'djibouti', 'dominica', 'ecuador', 'egypt', 'eritrea', 'estonia', 'eswatini',
  'ethiopia', 'europe', 'european', 'fiji', 'finland', 'france', 'gabon', 'gambia', 'georgia', 'germany',
  'ghana', 'gibraltar', 'greece', 'greenland', 'grenada', 'guatemala', 'guinea', 'guyana', 'haiti',
  'honduras', 'hungary', 'iceland', 'india', 'indonesia', 'iran', 'iraq', 'ireland', 'islam', 'israel',
  'italy', 'jamaica', 'japan', 'jewish', 'jordan', 'judaism', 'kashmir', 'kazakhstan', 'kenya',
  'kiribati', 'kosovo', 'kurdistan', 'kuwait', 'kyrgyzstan', 'laos', 'latvia', 'lebanon', 'lesotho',
  'liberia', 'libya', 'liechtenstein', 'lithuania', 'luxembourg', 'madagascar', 'malawi', 'malaysia',
  'maldives', 'mali', 'malta', 'mauritania', 'mauritius', 'mexico', 'micronesia', 'moldova', 'monaco',
  'mongolia', 'montenegro', 'morocco', 'mozambique', 'myanmar', 'namibia', 'nauru', 'nepal',
  'netherlands', 'nicaragua', 'niger', 'nigeria', 'norway', 'oman', 'pakistan', 'palau', 'palestine',
  'panama', 'paraguay', 'peru', 'philippines', 'poland', 'portugal', 'qatar', 'romania', 'russia',
  'rwanda', 'samoa', 'scotland', 'senegal', 'serbia', 'seychelles', 'singapore', 'slovakia',
  'slovenia', 'somalia', 'somaliland', 'spain', 'sudan', 'suriname', 'sweden', 'switzerland', 'syria',
  'taiwan', 'tajikistan', 'tanzania', 'thailand', 'tibet', 'togo', 'tonga', 'tunisia', 'turkmenistan',
  'tuvalu', 'uganda', 'ukraine', 'uruguay', 'uzbekistan', 'vanuatu', 'venezuela', 'vietnam', 'wales',
  'yemen', 'yugoslavia', 'zambia', 'zimbabwe',
]);

const SMALL = new Set(['and', 'of', 'the']);

function titleWord(w: string, i: number): string {
  if (ACRONYMS.has(w.toUpperCase())) return w.toUpperCase();
  if (i > 0 && SMALL.has(w)) return w;
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/** 'COST_OF_LIVING' → 'Cost of living'; 'US_RELATIONS' → 'US relations'. */
export function fmtTopic(name: string | null | undefined): string {
  if (!name) return '';
  const key = name.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (OVERRIDES[key]) return OVERRIDES[key];

  // Stray HTML entities and symbols out, then lower-case words
  let text = name.replace(/&[a-z]+;/gi, '').replace(/[^A-Za-z0-9_ ]/g, '').replace(/_/g, ' ')
    .trim().replace(/\s+/g, ' ').toLowerCase();
  if (!text) return '';

  for (const phrase of PROPER_PHRASES) {
    text = text.replace(new RegExp(`\\b${phrase}\\b`, 'g'), phrase.split(' ').map(titleWord).join(' '));
  }

  const words = text.split(' ').map(w => {
    if (ACRONYMS.has(w.toUpperCase())) return w.toUpperCase();
    if (PROPER_WORDS.has(w)) return w.charAt(0).toUpperCase() + w.slice(1);
    return w;
  });
  const out = words.join(' ');
  return out.charAt(0).toUpperCase() + out.slice(1);
}
