/**
 * Knox Index brand palette.
 * Primary surface is #1F1D1D (warm dark). Containers use the Knox Product
 * Gradient. The Knox Gradient is used as a signature accent on key surfaces.
 */

export const brand = {
  /** Five-stop gradient — horizontal, left-to-right. */
  gradient: ['#FF9363', '#F67374', '#E83C91', '#933A89', '#553984'] as const,
  /** Two-stop gradient — vertical, top-to-bottom. Container fill. */
  productGradient: ['#1F1D1D', '#35393B'] as const,
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

export const accent = {
  indigo: '#7C83FF',
  pink:   '#FF6BD4',
  mint:   '#3FE6B1',
  amber:  '#FFB657',
};

export const glass = {
  fill:     'rgba(255, 255, 255, 0.04)',
  fillHi:   'rgba(255, 255, 255, 0.08)',
  border:   'rgba(255, 255, 255, 0.08)',
  borderHi: 'rgba(255, 255, 255, 0.16)',
  /** Inner card fill — #1F1D1D at 50% opacity, sits on top of Knox Product Gradient. */
  card:     'rgba(31, 29, 29, 0.5)',
};
