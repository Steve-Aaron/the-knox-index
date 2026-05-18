/**
 * typography.ts
 * --------------
 * Figtree type system. All weights loaded in _layout.tsx via
 * @expo-google-fonts/figtree. Numbers use a tabular mono stack so
 * CountUp animations don't jitter horizontally.
 */
import { Platform } from 'react-native';

// Loaded via useFonts in _layout.tsx — strings must match exactly.
const F = {
  regular:   'Figtree_400Regular',
  medium:    'Figtree_500Medium',
  semiBold:  'Figtree_600SemiBold',
  bold:      'Figtree_700Bold',
  extraBold: 'Figtree_800ExtraBold',
  black:     'Figtree_900Black',
};

const mono = Platform.select({
  ios:     'Menlo',
  android: 'monospace',
  default: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
});

export const font = {
  ui:   F.regular,
  bold: F.bold,
  mono,
};

/**
 * Base rem unit = 16px. All sizes are 0.25rem multiples.
 * 0.5rem=8  0.75rem=12  1rem=16  1.25rem=20  1.5rem=24
 * 1.75rem=28  2rem=32  2.25rem=36  2.5rem=40  2.75rem=44
 */
export const REM = 16;

export const type = {
  display:  { fontFamily: F.black,    fontSize: 44, letterSpacing: -1 },   // 2.75rem
  title:    { fontFamily: F.bold,     fontSize: 24, letterSpacing: -0.4 }, // 1.5rem
  subtitle: { fontFamily: F.semiBold, fontSize: 16, letterSpacing: 0.6,  textTransform: 'uppercase' as const }, // 1rem
  body:     { fontFamily: F.medium,   fontSize: 16 },                      // 1rem
  caption:  { fontFamily: F.semiBold, fontSize: 12, letterSpacing: 0.8,  textTransform: 'uppercase' as const }, // 0.75rem
  numberLg: { fontFamily: mono,       fontSize: 36, letterSpacing: -0.5 }, // 2.25rem
  numberMd: { fontFamily: mono,       fontSize: 20, letterSpacing: -0.3 }, // 1.25rem
  numberSm: { fontFamily: mono,       fontSize: 16 },                      // 1rem
};
