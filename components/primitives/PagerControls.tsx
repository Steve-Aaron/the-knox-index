import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { glass, neutral } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { font } from '@/theme/typography';

/**
 * PagerControls
 * --------------
 * '← Previous · <status> · Next →' bar along the foot of a list or modal.
 * The caller owns the position and the centre text; style that text with
 * `pagerText` so every pager reads the same.
 *
 * One job: step backwards / forwards through something paged.
 */
interface Props {
  onPrev:        () => void;
  onNext:        () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
  prevLabel?:    string;
  nextLabel?:    string;
  /** Status in the middle, e.g. 'Page 2 of 5' or '306 posts'. */
  children?:     React.ReactNode;
}

export function PagerControls({
  onPrev,
  onNext,
  prevDisabled = false,
  nextDisabled = false,
  prevLabel = '← Previous',
  nextLabel = 'Next →',
  children,
}: Props) {
  return (
    <View style={styles.bar}>
      <PagerButton label={prevLabel} onPress={onPrev} disabled={prevDisabled} />
      {children}
      <PagerButton label={nextLabel} onPress={onNext} disabled={nextDisabled} />
    </View>
  );
}

function PagerButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        disabled && styles.btnDisabled,
        pressed && !disabled && { opacity: 0.75 },
      ]}
    >
      <Text style={[styles.btnText, disabled && styles.btnTextDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Text styles for the centre status. */
export const pagerText = StyleSheet.create({
  info: {
    fontFamily: font.ui,
    fontSize:   12,
    color:      neutral.textDim,
    flex:       1,
    textAlign:  'center',
  },
  strong: {
    fontFamily: font.bold,
    color:      neutral.text,
  },
  muted: {
    fontFamily: font.ui,
    color:      neutral.textDim,
  },
});

const styles = StyleSheet.create({
  bar: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.sm,
    borderTopWidth:    1,
    borderTopColor:    glass.border,
    marginTop:         spacing.sm,
  },
  btn: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    borderRadius:      radius.pill,
    borderWidth:       1,
    borderColor:       glass.borderHi,
    backgroundColor:   'rgba(255,255,255,0.04)',
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  btnDisabled: {
    borderColor:     glass.border,
    backgroundColor: 'rgba(255,255,255,0.015)',
    ...Platform.select({ web: { cursor: 'not-allowed' } as any, default: {} }),
  },
  btnText: {
    fontFamily: font.bold,
    fontSize:   12,
    color:      neutral.textMid,
    letterSpacing: 0.3,
  },
  btnTextDisabled: {
    color: neutral.textDim,
  },
});
