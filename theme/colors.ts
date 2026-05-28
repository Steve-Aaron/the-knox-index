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
  independent:  { base: '#8A8AA5', glow: '#B6B6CC' },
  unknown:      { base: '#8A8AA5', glow: '#B6B6CC' },
} as const;

export type PartyKey = keyof typeof party;

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
  indigo: knox.primaryPink,
  pink:   knox.accentPurple,
  mint:   knox.primaryOrange,
  amber:  knox.secondaryOrange,
};

export const glass = {
  fill:     'rgba(255, 255, 255, 0.04)',
  fillHi:   'rgba(255, 255, 255, 0.08)',
  border:   'rgba(255, 255, 255, 0.08)',
  borderHi: 'rgba(255, 255, 255, 0.16)',
  /** Inner card fill — #1F1D1D at 50% opacity, sits on top of Knox Product Gradient. */
  card:     'rgba(31, 29, 29, 0.5)',
};
