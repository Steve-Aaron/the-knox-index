import React from 'react';
import { Platform, StyleSheet, Text } from 'react-native';

/**
 * PostPlatformIcon
 * -----------------
 * The small white platform mark in the corner of a post card. On web it is
 * the Font Awesome brand glyph (loaded via HTMLHead); native falls back to an
 * outbound arrow.
 *
 * One job: render the platform glyph of a post.
 */
export type PostPlatformGlyph = 'tiktok' | 'x-twitter';

interface Props {
  glyph: PostPlatformGlyph;
}

export function PostPlatformIcon({ glyph }: Props) {
  return Platform.OS === 'web'
    ? React.createElement('i', {
        className: `fa-brands fa-${glyph}`,
        style: { color: '#FFFFFF', fontSize: 16, flexShrink: 0, marginTop: 2 },
      })
    : <Text style={[styles.arrow, { color: '#FFFFFF' }]}>↗</Text>;
}

const styles = StyleSheet.create({
  arrow: {
    fontSize: 16,
  },
});
