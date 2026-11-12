/**
 * Knox Index brand palette.
 * Primary surface is #1F1D1D (warm dark). Containers use the Knox Product
 * Gradient. The Knox Gradient is used as a signature accent on key surfaces.
 *
 * Strict palette: every UI colour outside party tokens must come from `knox`
 * (named accents) or the neutral set below. Do not introduce new hex values.
 */

export const knox = {
  primaryOrange:   '#FF9363',
  secondaryOrange: '#F67374',
  primaryPink:     '#E83C91',
  primaryPurple:   '#933A89',
  accentPurple:    '#553984',
} as const;

export const brand = {
  /** Five-stop gradient — horizontal, left-to-right. */
  gradient: [knox.primaryOrange, knox.secondaryOrange, knox.primaryPink, knox.primaryPurple, knox.accentPurple] as const,
  /**
   * Product gradient — vertical, top-to-bottom.
   * Holds the darker #1F1D1D for the upper 75% of the surface and only
   * eases up to the warmer #35393B at the very bottom. Net effect: the
   * page reads as predominantly dark, with a subtle 'horizon glow' at
   * the foot. Used by every full-page container.
   */
  productGradient:          ['#1F1D1D', '#1F1D1D', '#35393B'] as const,
  productGradientLocations: [0, 0.75, 1] as const,
  black:    '#1F1D1D',
  grey:     '#7C919A',
  darkGrey: '#4D575C',
  white:    '#F4F5FF',
};

export const neutral = {
  felt:      '#1F1D1D',   // page background
  night:     '#35393B',   // product gradient end / elevated surface
  ink:       '#272424',   // slightly lighter base for depth layering
  stroke:    '#4D575C',   // dark grey — soft borders
  strokeHi:  '#7C919A',   // grey — hover / focus borders
  text:      '#F4F5FF',   // white — primary text
  textMid:   '#7C919A',   // grey — secondary text
  textDim:   '#FAFAFA',   // --textColorDim — tertiary text
};

/**
 * Party colour tokens.
 *  - base: the spine / primary accent
 *  - glow: a softer version used in shadows, radial fills, halos
 */
export const party = {
  labour:       { base: '#E4002B', glow: '#FF4F6E' },
  conservative: { base: '#1a5eb8', glow: '#4d8fdd' },
  libdem:       { base: '#FDBB30', glow: '#FFE082' },
  snp:          { base: '#FFF95D', glow: '#FFFBA6' },
  green:        { base: '#00C951', glow: '#5FE890' },
  reform:       { base: '#12B6CF', glow: '#5DE3F4' },
  plaid:        { base: '#005B54', glow: '#3C9C95' },
  dup:          { base: '#D46A4C', glow: '#F09879' },
  sinnfein:     { base: '#326760', glow: '#5FA095' },
  alliance:     { base: '#E84393', glow: '#F18FBE' },   // magenta (off the crowded warm/orange end; distinct from Lib Dem + DUP)
  restore:      { base: '#0B2545', glow: '#35527D' },   // confirmed (Restore navy)
  sdlp:         { base: '#2EA84F', glow: '#74D38E' },   // PLACEHOLDER — replace with brand hex
  uup:          { base: '#5BA3DC', glow: '#93C7EC' },   // PLACEHOLDER
  tuv:          { base: '#FFFFFF', glow: '#E4E4EC' },   // white
  workers:      { base: '#B01030', glow: '#E0526C' },   // PLACEHOLDER
  advance:      { base: '#7A3FA0', glow: '#A878C8' },   // PLACEHOLDER
  yourparty:    { base: '#FF3131', glow: '#FF8585' },   // confirmed (#FF3131)
  independent:  { base: '#8A8AA5', glow: '#B6B6CC' },
  unknown:      { base: '#8A8AA5', glow: '#B6B6CC' },
} as const;

export type PartyKey = keyof typeof party;

/**
 * Region colour tokens — the World Leaders tenant's equivalent of the party
 * tokens above. Same { base, glow } shape so every component that colours a
 * row, dot or halo works unchanged whichever tenant it is rendering.
 *
 * Bases are taken from the Knox 2.0 data-visualisation palette (see `dataVis`)
 * so regions never collide with the interactive accent tokens; glows are the
 * matching lighter tint used for shadows, radial fills and halos.
 */
export const region = {
  europe:       { base: '#5B8DEF', glow: '#9CBCF7' },
  northamerica: { base: '#FF9363', glow: '#FFBFA4' },
  southamerica: { base: '#12B6CF', glow: '#5DE3F4' },
  africa:       { base: '#FFD700', glow: '#FFE98A' },
  asia:         { base: '#E83C91', glow: '#F58FBF' },
  middleeast:   { base: '#9D02D7', glow: '#C86BEC' },
  oceania:      { base: '#CAC1E4', glow: '#E3DDF2' },
  unknown:      { base: '#8A8AA5', glow: '#B6B6CC' },
} as const;

export type RegionColourKey = keyof typeof region;

/**
 * Every grouping token in one map. `party` keys and `region` keys never
 * collide, so a single lookup serves both tenants.
 */
export const groupColours = { ...party, ...region } as const;

/** The colour/grouping key carried on a Politician for the ACTIVE tenant:
 *  a party key on The Knox Index, a region key on World Leaders. */
export type GroupKey = PartyKey | RegionColourKey;

/**
 * Colour for a grouping key. Unknown keys fall back to the neutral grey pair
 * rather than throwing — a new party or region in the data must never be able
 * to blank a component.
 */
export function colourFor(key: string | null | undefined): { base: string; glow: string } {
  return (groupColours as Record<string, { base: string; glow: string }>)[key ?? ''] ?? region.unknown;
}

/**
 * Accent tokens map *semantic* roles onto Knox brand colours. The token names
 * are kept (indigo / pink / mint / amber) so existing components don't churn;
 * the underlying hex values are now strictly from the Knox palette.
 *
 *   indigo → primaryPink     — primary action / focus / selected
 *   pink   → accentPurple    — feature accents (PostsTable strip, sticky CTA)
 *   mint   → primaryOrange   — live / positive / success indicators
 *   amber  → secondaryOrange — warning / loading
 */
export const accent = {
  indigo: '#5F64BD',
  pink:   knox.accentPurple,
  mint:   knox.primaryOrange,
  amber:  knox.secondaryOrange,
};

/** Direction colours for week-on-week trend arrows. */
export const trend = {
  up:   '#5FA095',
  down: knox.secondaryOrange,
  /** Negative pp deltas in the content table. */
  downPp: '#FF4F6E',
} as const;

/**
 * Knox 2.0 secondary palette.
 * Lower-saturation accent colours — used individually paired with primaries.
 * Never use these together; pick one per theme/topic.
 */
export const secondary = {
  purple: '#7D529B',
  blue:   '#1D4782',
  orange: '#EF8936',
  lilac:  '#CAC1E4',
} as const;

/**
 * Knox 2.0 data visualisation palette.
 * Used for chart bars, graph lines, and data indicators — in order.
 * Never use these for interactive UI states; use accent tokens for that.
 */
export const dataVis = [
  '#ef8936',
  '#ffd700',
  '#ffb14e',
  '#fa8775',
  '#ea5f94',
  '#cd34b5',
  '#9d02d7',
  '#5B8DEF',
] as const;

export const glass = {
  fill:     'rgba(255, 255, 255, 0.04)',
  fillHi:   'rgba(255, 255, 255, 0.08)',
  border:   'rgba(255, 255, 255, 0.08)',
  borderHi: 'rgba(255, 255, 255, 0.16)',
  /** Inner card fill — #1F1D1D at 50% opacity, sits on top of Knox Product Gradient. */
  card:     'rgba(31, 29, 29, 0.5)',
};
