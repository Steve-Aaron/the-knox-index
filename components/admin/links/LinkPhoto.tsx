import React, { useState } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { DevLabel } from '@/components/primitives/DevLabel';
import { neutral } from '@/theme/colors';

/**
 * LinkPhoto
 * ----------
 * One channel's profile picture at review size, falling back to initials when
 * there is no photo or it fails to load. Deliberately plain: the reviewer is
 * comparing two faces, so nothing here crops, tints or rounds away detail.
 *
 * One job: show a photo, or say there isn't one.
 */

interface Props {
  url?:   string | null;
  name?:  string | null;
  size?:  number;
}

const initialsOf = (name?: string | null): string =>
  (name ?? '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '?';

export function LinkPhoto({ url, name, size = 64 }: Props) {
  const [failed, setFailed] = useState(false);
  const showPhoto = !!url && !failed;

  return (
    <View style={[styles.frame, { width: size, height: size, borderRadius: size / 2 }]}>
      <DevLabel name="LinkPhoto" />
      {showPhoto ? (
        <Image
          source={{ uri: url as string }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setFailed(true)}
          accessibilityLabel={name ?? 'profile photo'}
        />
      ) : (
        <Text style={styles.initials}>{initialsOf(name)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: neutral.ink,
    borderWidth:     1,
    borderColor:     neutral.stroke,
    overflow:        'hidden',
  },
  initials: { color: neutral.textMid, fontSize: 18, fontWeight: '600' },
});
