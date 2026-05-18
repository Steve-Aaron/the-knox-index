import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { party, PartyKey, neutral } from '@/theme/colors';
import { font } from '@/theme/typography';

/**
 * CardAvatar
 * -----------
 * Circular avatar with party-coloured ring. Shows a profile photo when
 * avatarUrl is provided; falls back to initials on error or when absent.
 * One job.
 */
interface Props {
  partyKey:   PartyKey;
  initials:   string;
  size?:      number;
  avatarUrl?: string;
}

export function CardAvatar({ partyKey, initials, size = 56, avatarUrl }: Props) {
  const colour  = party[partyKey];
  const ring    = size;
  const inner   = size - 6;
  const [imgErr, setImgErr] = useState(false);

  const showPhoto = !!avatarUrl && !imgErr;

  return (
    <View style={{ width: ring, height: ring, alignItems: 'center', justifyContent: 'center' }}>
      {/* Party-colour gradient ring */}
      <LinearGradient
        colors={[colour.base, colour.glow]}
        style={{ width: ring, height: ring, borderRadius: ring / 2, position: 'absolute' }}
      />
      <View style={[styles.inner, { width: inner, height: inner, borderRadius: inner / 2 }]}>
        {showPhoto ? (
          <Image
            source={{ uri: avatarUrl }}
            style={[styles.photo, { width: inner, height: inner, borderRadius: inner / 2 }]}
            onError={() => setImgErr(true)}
          />
        ) : (
          <Text style={[styles.initials, { fontSize: Math.round(inner * 0.35) }]}>
            {initials}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inner: {
    backgroundColor: neutral.ink,
    alignItems:      'center',
    justifyContent:  'center',
    overflow:        'hidden',
  },
  photo: {
    resizeMode: 'cover',
  },
  initials: {
    fontFamily:    font.bold,
    color:         neutral.text,
    letterSpacing: 0.5,
  },
});
