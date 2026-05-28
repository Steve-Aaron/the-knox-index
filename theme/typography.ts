/**
 * typography.ts
 * --------------
 * Single typeface — Figtree. The Google Fonts CSS link in
 * components/web/HTMLHead.tsx loads the variable family; this module just
 * exposes consistent weights so component styles don't need to know which
 * weight maps to which numeric value.
 *
 * One job per export:
 *   font   — fontFamily values used wherever a style declares one
 *   weight — explicit fontWeight numbers, for use alongside fontFamily
 *   type   — pre-baked text role tokens (display / title / body etc.)
 */
import { Platform } from 'react-native';

/** The single brand typeface. */
const FIGTREE = 'Figtree';

const mono = Platform.select({
  ios:     'Menlo',
  android: 'monospace',
  default: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
});

/**
 * Font-family tokens. Every weight maps to the same family — Figtree —
 * because the loaded variable font handles weight via fontWeight, not via
 * separate family names. Components that previously used `font.bold` will
 * therefore still render in Figtree; pair with `weight.bold` to actually
 * get a bold rendering.
 */
export const font = {
  ui:   FIGTREE,
  bold: FIGTREE,
  mono,
};

/** Numeric font-weight tokens. Use alongside `font.*` family values. */
export const weight = {
  light:     '300' as const,
  regular:   '400' as const,
  medium:    '500' as const,
  semiBold:  '600' as const,
  bold:      '700' as const,
  extraBold: '800' as const,
  black:     '900' as const,
};

/**
 * Base rem unit = 16px. All sizes are 0.25rem multiples.
 * 0.5rem=8  0.75rem=12  1rem=16  1.25rem=20  1.5rem=24
 * 1.75rem=28  2rem=32  2.25rem=36  2.5rem=40  2.75rem=44
 */
export const REM = 16;

/**
 * Pre-baked text role tokens. Each carries fontFamily + fontWeight so
 * spreading `...type.body` gives a component everything it needs to render
 * the intended look without setting fontFamily separately.
 */
export const type = {
  display:  { fontFamily: FIGTREE, fontWeight: weight.black,    fontSize: 44, letterSpacing: -1 },   // 2.75rem
  title:    { fontFamily: FIGTREE, fontWeight: weight.bold,     fontSize: 24, letterSpacing: -0.4 }, // 1.5rem
  subtitle: { fontFamily: FIGTREE, fontWeight: weight.semiBold, fontSize: 16, letterSpacing: 0.6,  textTransform: 'uppercase' as const }, // 1rem
  body:     { fontFamily: FIGTREE, fontWeight: weight.medium,   fontSize: 16 },                      // 1rem
  caption:  { fontFamily: FIGTREE, fontWeight: weight.semiBold, fontSize: 12, letterSpacing: 0.8,  textTransform: 'uppercase' as const }, // 0.75rem
  numberLg: { fontFamily: mono,    fontSize: 36, letterSpacing: -0.5 }, // 2.25rem
  numberMd: { fontFamily: mono,    fontSize: 20, letterSpacing: -0.3 }, // 1.25rem
  numberSm: { fontFamily: mono,    fontSize: 16 },                       // 1rem
};
