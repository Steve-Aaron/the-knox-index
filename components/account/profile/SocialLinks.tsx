import React from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { glass, neutral } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { type } from '@/theme/typography';
import type { SocialProfile } from '@/data/account/types';
import { PLATFORM_META } from '../platforms';

/**
 * SocialLinks
 * ------------
 * One outbound pill per connected platform ('TikTok profile ↗', 'X ↗').
 *
 * One job: link out to the account's social profiles.
 */
interface Props {
  socials: SocialProfile[];
}

export function SocialLinks({ socials }: Props) {
  return (
    <View style={styles.row}>
      {socials.map(s => (
        <SocialLinkPill key={s.platform} social={s} />
      ))}
    </View>
  );
}

function SocialLinkPill({ social }: { social: SocialProfile }) {
  const meta = PLATFORM_META[social.platform];
  const open = () => {
    Linking.openURL(social.url).catch(() => {
      /* preview environments may not support Linking */
    });
  };

  return (
    <Pressable
      onPress={open}
      accessibilityRole="link"
      accessibilityLabel={`Open ${social.handle} on ${meta.label}`}
      style={({ pressed, hovered }: any) => [
        styles.pill,
        hovered && styles.pillHover,
        pressed && styles.pillPressed,
      ]}
    >
      <FontAwesome6 name={meta.icon} size={12} color={neutral.textMid} />
      <Text style={styles.label}>{meta.label} profile</Text>
      <Text style={styles.arrow}>↗</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    justifyContent: 'center',
    gap:            spacing.sm,
  },
  pill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    borderRadius:      radius.pill,
    borderWidth:       1,
    borderColor:       glass.border,
    backgroundColor:   glass.fill,
    ...Platform.select({
      web: { cursor: 'pointer', transitionProperty: 'border-color', transitionDuration: '160ms' } as any,
      default: {},
    }),
  },
  pillHover: {
    borderColor: glass.borderHi,
  },
  pillPressed: {
    opacity: 0.75,
  },
  label: {
    ...type.caption,
    fontSize: 11,
    color:    neutral.textMid,
  },
  arrow: {
    fontSize: 11,
    color:    neutral.textMid,
  },
});
