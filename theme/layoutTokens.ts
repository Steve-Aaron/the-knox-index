/**
 * layoutTokens.ts
 * ----------------
 * Pure flex / layout style fragments that 6+ screens currently redefine
 * locally. Spread these into your StyleSheet instead of typing the same
 * row / header / section / footer shape from scratch.
 *
 * One job per export:
 *   row     — flex row, centred items, base gap
 *   header  — flex row, space-between, centred items, base padding
 *   section — vertical stack with base gap + padding
 *   footer  — flex row, space-between, padded bottom strip
 *
 * Usage:
 *   const styles = StyleSheet.create({
 *     myRow: { ...layout.row, gap: spacing.lg },       // spread + override
 *     myHeader: layout.header,                          // verbatim
 *   });
 *
 * Each token returns a plain object (not StyleSheet.create) so consumers
 * can spread / override without losing the canonical defaults.
 */
import type { ViewStyle } from 'react-native';

import { spacing } from './spacing';

const row: ViewStyle = {
  flexDirection: 'row',
  alignItems:    'center',
  gap:           spacing.sm,
};

const header: ViewStyle = {
  flexDirection:  'row',
  alignItems:     'center',
  justifyContent: 'space-between',
  paddingHorizontal: spacing.lg,
  paddingVertical:   spacing.md,
};

const section: ViewStyle = {
  flexDirection: 'column',
  gap:           spacing.md,
  paddingHorizontal: spacing.lg,
  paddingVertical:   spacing.lg,
};

const footer: ViewStyle = {
  flexDirection:  'row',
  alignItems:     'center',
  justifyContent: 'space-between',
  paddingHorizontal: spacing.lg,
  paddingVertical:   spacing.md,
};

export const layout = {
  row,
  header,
  section,
  footer,
} as const;

export type LayoutTokenKey = keyof typeof layout;
