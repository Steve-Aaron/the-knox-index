import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Kicker } from '@/components/ui/Kicker';
import { Title } from '@/components/ui/Title';
import { glass, neutral } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import type { SocialProfile } from '@/data/account/types';
import { SocialLinks } from '../profile/SocialLinks';

/**
 * PostInsightHeader
 * ------------------
 * 'DETAILED INSIGHT / Post' on the left; the account's profile links and the
 * close button on the right.
 *
 * One job: the top bar of the post insight modal.
 */
interface Props {
  socials: SocialProfile[];
  onClose: () => void;
}

export function PostInsightHeader({ socials, onClose }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.titles}>
        <Kicker>Detailed insight</Kicker>
        <Title>Post</Title>
      </View>
      <SocialLinks socials={socials} />
      {/* Pinned top-right so it never wraps away on narrow screens */}
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
        hitSlop={8}
        style={({ pressed, hovered }: any) => [
          styles.close,
          hovered && styles.closeHover,
          pressed && styles.closePressed,
        ]}
      >
        <FontAwesome6 name="xmark" size={14} color={neutral.text} />
      </Pressable>
    </View>
  );
}

const CLOSE_SIZE = 32;

const styles = StyleSheet.create({
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    flexWrap:       'wrap',
    gap:            spacing.md,
    paddingRight:   CLOSE_SIZE + spacing.xl,
  },
  titles: {
    gap: spacing.xs,
  },
  close: {
    position:        'absolute',
    top:             0,
    right:           0,
    width:           CLOSE_SIZE,
    height:          CLOSE_SIZE,
    borderRadius:    CLOSE_SIZE / 2,
    borderWidth:     1,
    borderColor:     glass.borderHi,
    backgroundColor: glass.fill,
    alignItems:      'center',
    justifyContent:  'center',
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  closeHover: {
    backgroundColor: glass.fillHi,
  },
  closePressed: {
    opacity: 0.75,
  },
});
