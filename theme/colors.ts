/**
 * Dark glassmorphist palette. Party colours are kept distinct and vivid so
 * they pop against the dark felt. Neutrals stay cool to sell the "screen at
 * night" feel.
 */

export const neutral = {
  felt: '#07070B',        // page background, deepest
  night: '#0E0E14',       // panel background
  ink: '#14141C',         // card body base
  stroke: '#26263A',      // soft borders
  strokeHi: '#3A3A55',    // hover / focus borders
  text: '#ECECF2',        // primary text
  textMid: '#A8A8BA',     // secondary text
  textDim: '#6C6C82',     // tertiary text
};

/**
 * Party colour tokens. Each has:
 *  - base: the spine / primary accent
 *  - glow: a softer version used in shadows, radial fills, halos
 */
export const party = {
  labour:       { base: '#E4002B', glow: '#FF4F6E' },
  conservative: { base: '#1a5eb8', glow: '#4d8fdd' },   // royal blue — vivid on dark bg
  libdem:       { base: '#FAA61A', glow: '#FFC96B' },
  snp:          { base: '#FFF95D', glow: '#FFFBA6' },
  green:        { base: '#00C951', glow: '#5FE890' },   // vivid green
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
  pink: '#FF6BD4',
  mint: '#3FE6B1',
  amber: '#FFB657',
};

export const glass = {
  fill: 'rgba(255, 255, 255, 0.04)',
  fillHi: 'rgba(255, 255, 255, 0.08)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderHi: 'rgba(255, 255, 255, 0.16)',
};
