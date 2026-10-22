import React from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import { DashCard } from '@/components/primitives/DashCard';
import { spacing } from '@/theme/spacing';

/**
 * AccountWidget
 * --------------
 * The card every account-page widget sits in: DashCard (gradient top bar,
 * glass surface, ? helper) with the page's shared inner padding and an
 * optional fixed height.
 *
 * One job: give widgets an identical frame.
 */
interface Props {
  children:  React.ReactNode;
  /** Fixed height (desktop). Omit to size to content. */
  height?:   number;
  infoText?: string;
  style?:    ViewStyle;
}

export function AccountWidget({ children, height, infoText, style }: Props) {
  return (
    <DashCard
      infoText={infoText}
      style={StyleSheet.flatten([styles.card, height != null && { height }, style])}
    >
      {children}
    </DashCard>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingTop:        spacing.xl,
    paddingBottom:     spacing.lg,
    paddingHorizontal: spacing.lg,
    gap:               spacing.base,
  },
});
