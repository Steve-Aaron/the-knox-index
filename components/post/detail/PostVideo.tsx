import React, { createElement } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

/**
 * PostVideo
 * ----------
 * Inline player that replaces the cover once the viewer presses play. Starts
 * playing straight away: it mounts inside that press, so browsers allow sound.
 *
 * Web renders a plain <video> (see dashboard/VideoModal for why); native uses
 * expo-video.
 *
 * One job: play a post's video in place.
 */
interface Props {
  uri:     string;
  poster?: string;
}

export function PostVideo({ uri, poster }: Props) {
  if (Platform.OS === 'web') {
    return createElement('video', {
      src:         uri,
      poster,
      autoPlay:    true,
      controls:    true,
      playsInline: true,
      style:       { width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000', display: 'block' },
    });
  }
  return <NativePostVideo uri={uri} />;
}

function NativePostVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, p => p.play());
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls />;
}
