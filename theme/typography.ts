/**
 * typography.ts
 * --------------
 * Montserrat-only type system. All weights are loaded in _layout.tsx via
 * @expo-google-fonts/montserrat. Numbers use a tabular mono stack so
 * CountUp animations don't jitter horizontally.
 */
import { Platform } from 'react-native';

// Loaded via useFonts in _layout.tsx — strings must match exactly.
const M = {
  regular:   'Montserrat_400Regular',
  medium:    'Montserrat_500Medium',
  semiBold:  'Montserrat_600SemiBold',
  bold:      'Montserrat_700Bold',
  extraBold: 'Montserrat_800ExtraBold',
  black:     'Montserrat_900Black',
};

const mono = Platform.select({
  ios:     'Menlo',
  android: 'monospace',
  default: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
});

export const font = {
  ui:   M.regular,
  bold: M.bold,
  mono,
};

export const type = {
  display:  { fontFamily: M.black,    fontSize: 42, letterSpacing: -1 },
  title:    { fontFamily: M.bold,     fontSize: 22, letterSpacing: -0.4 },
  subtitle: { fontFamily: M.semiBold, fontSize: 14, letterSpacing: 0.6,  textTransform: 'uppercase' as const },
  body:     { fontFamily: M.medium,   fontSize: 14 },
  caption:  { fontFamily: M.semiBold, fontSize: 11, letterSpacing: 0.8,  textTransform: 'uppercase' as const },
  numberLg: { fontFamily: mono,       fontSize: 36, letterSpacing: -0.5 },
  numberMd: { fontFamily: mono,       fontSize: 18, letterSpacing: -0.3 },
  numberSm: { fontFamily: mono,       fontSize: 13 },
};
