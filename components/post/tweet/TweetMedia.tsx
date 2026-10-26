import React, { useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import type { TweetData } from '@/data/types';
import { brand, glass, neutral } from '@/theme/colors';
import { radius } from '@/theme/spacing';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * TweetMedia
 * -----------
 * A tweet's photos and video stills in X's grid: one item full width, two
 * side by side, three as one tall plus two stacked, four as a square. A still
 * with a video behind it plays in place on web (tap the Knox play button).
 *
 * One job: lay out a tweet's attached media.
 */

type Media = TweetData['media'][number];

const STILLS = ['photo', 'videoThumbnail', 'gifThumbnail', 'liveThumbnail'];

/** Attachment order on X is the _N index in the scraped file name. */
const position = (m: Media) => Number(m.url.split('?')[0].match(/_(\d+)(?:_thumb)?$/)?.[1] ?? 0);

/** The playable file behind a still: same path without the _thumb suffix. */
function playableFor(still: Media, media: Media[]): Media | undefined {
  if (still.type === 'photo') return undefined;
  const kind = still.type === 'gifThumbnail' ? 'gif' : 'video';
  const stem = still.url.split('?')[0].replace(/_thumb$/, '');
  return media.find(m => m.type === kind && m.url.split('?')[0] === stem)
      ?? media.find(m => m.type === kind);
}

export function TweetMedia({ media, height = 220 }: { media: Media[]; height?: number }) {
  const [playing, setPlaying] = useState<string | null>(null);
  const stills = media.filter(m => STILLS.includes(m.type)).sort((a, b) => position(a) - position(b)).slice(0, 4);
  if (!stills.length) return null;

  const tile = (m: Media, style: object) => {
    const playable = playableFor(m, media);
    if (playable && playing === m.url && Platform.OS === 'web') {
      return (
        <View key={m.url} style={[styles.tile, style]}>
          {React.createElement('video', {
            src: playable.url, controls: true, autoPlay: true, playsInline: true, loop: playable.type === 'gif',
            style: { width: '100%', height: '100%', objectFit: 'contain', background: '#000' },
          })}
        </View>
      );
    }
    return (
      <Pressable key={m.url} style={[styles.tile, style]} disabled={!playable} onPress={() => setPlaying(m.url)}>
        <Image source={{ uri: m.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        {playable && (
          <View style={styles.playWrap}>
            <LinearGradient colors={brand.gradient as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.play}>
              <FontAwesome6 name="play" size={18} color={neutral.felt} solid />
            </LinearGradient>
          </View>
        )}
      </Pressable>
    );
  };

  const [a, b, c, d] = stills;
  return (
    <View style={[styles.grid, { height }]}>
      {stills.length === 1 && tile(a, styles.full)}
      {stills.length === 2 && <>{tile(a, styles.half)}{tile(b, styles.half)}</>}
      {stills.length === 3 && (
        <>
          {tile(a, styles.half)}
          <View style={styles.stack}>{tile(b, styles.quarter)}{tile(c, styles.quarter)}</View>
        </>
      )}
      {stills.length === 4 && (
        <>
          <View style={styles.stack}>{tile(a, styles.quarter)}{tile(c, styles.quarter)}</View>
          <View style={styles.stack}>{tile(b, styles.quarter)}{tile(d, styles.quarter)}</View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: 2,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: glass.borderHi,
  },
  tile:    { backgroundColor: neutral.night, overflow: 'hidden' },
  full:    { flex: 1 },
  half:    { flex: 1 },
  stack:   { flex: 1, gap: 2 },
  quarter: { flex: 1 },
  playWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  play: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
  },
});
