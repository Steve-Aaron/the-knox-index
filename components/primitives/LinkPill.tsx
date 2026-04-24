import React from 'react';
import { Pressable, Text, StyleSheet, Linking, View, Platform } from 'react-native';
import { glass, neutral } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { type } from '@/theme/typography';

/**
 * LinkPill
 * ---------
 * A compact, pressable label+arrow that opens an external URL.
 * Used for the politician's TikTok handle on the card front. One job.
 */
interface Props {
  label: string;           // e.g. "@angelarayner"
  url: string;             // external destination
  accentColour?: string;   // party glow; used for hover/focus highlight
  iconGlyph?: string;      // defaults to northeast arrow
}

export function LinkPill({ label, url, accentColour, iconGlyph = '↗' }: Props) {
  const onPress = () => {
    Linking.openURL(url).catch(() => {
      /* swallow — preview environments may not support Linking */
    });
  };

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Open ${label} on TikTok`}
      onPress={onPress}
      style={({ pressed, hovered }: any) => [
        styles.pill,
        hovered && accentColour ? { borderColor: accentColour } : null,
        pressed ? { opacity: 0.75 } : null,
      ]}
    >
      <View style={styles.tiktok}>
        <Text style={[styles.tiktokMark, { color: accentColour ?? neutral.text }]}>
          ▶
        </Text>
      </View>
      <Text
        style={[
          styles.label,
          { color: accentColour ?? neutral.text },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text style={[styles.arrow, { color: accentColour ?? neutral.textMid }]}>
        {iconGlyph}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: glass.border,
    backgroundColor: glass.fill,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    ...Platform.select({
      web: { cursor: 'pointer', transitionProperty: 'border-color, opacity', transitionDuration: '180ms' } as any,
      default: {},
    }),
  },
  tiktok: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tiktokMark: {
    fontSize: 10,
    fontWeight: '800',
  },
  label: {
    ...type.caption,
    fontSize: 11,
    textTransform: 'none',
    letterSpacing: 0.2,
    fontWeight: '700',
  },
  arrow: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 2,
  },
});
