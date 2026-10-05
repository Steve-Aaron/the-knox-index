import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { AnimatePresence } from 'moti';
import { DevLabel } from '@/components/primitives/DevLabel';
import { UkMapSvg } from './UkMapSvg';
import { MapMarker } from './MapMarker';
import { UK_MARKER_LOCATIONS, SCOTTISH_LOCATION_IDS } from '@/lib/uk-locations';
import { useMarkerRotation, type MarkerCandidate } from '@/hooks/useMarkerRotation';
import { fitViewBox } from '@/lib/mapFit';
import type { Politician } from '@/data/types';

/**
 * UkMap
 * ------
 * Hero map: the UK silhouette with looping marker reveals over England, Wales
 * and the Central Belt. A marker pairs a random tracked city with a random
 * high-performing video — the video is not from that city, it is 'being
 * watched' there.
 *
 * One job: orchestrate the UK map + animated markers + video pool.
 *
 * Composes:
 *   - UkMapSvg          (country shape, decorative)
 *   - MapMarker x N     (one component instance per active pin)
 *   - useMarkerRotation (spawn / expiry scheduling, shared with WorldMap)
 */

/** UK map art is a square viewBox (see lib/uk-map-paths.ts). */
const VIEWBOX_SIZE = 1024;
/** Top videos considered for the rotation. */
const POOL_SIZE    = 30;

interface Props {
  politicians: Politician[];
}

export function UkMap({ politicians }: Props) {
  const candidates = useMemo<MarkerCandidate[]>(() => {
    const posts = politicians
      .flatMap(p =>
        (p.recentPosts ?? [])
          .filter(post => !!post.videoMp4)
          .map(post => ({ post, groupKey: p.groupKey, handle: p.handle })),
      )
      .sort((a, b) => b.post.views - a.post.views)
      .slice(0, POOL_SIZE);

    // Every city × every video: the scheduler picks one pair at a time and
    // never repeats a city or a video that is already on screen.
    return UK_MARKER_LOCATIONS.flatMap(location =>
      posts.map(({ post, groupKey, handle }) => ({
        anchor: { id: location.id, name: location.name, x: location.x, y: location.y },
        post,
        groupKey,
        handle,
      })),
    );
  }, [politicians]);

  const markers = useMarkerRotation(candidates);

  const [box, setBox] = useState({ width: 0, height: 0 });
  const onWrapLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox(prev => (prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);

  const drawn = fitViewBox(box, VIEWBOX_SIZE, VIEWBOX_SIZE);

  return (
    <View style={styles.wrap} onLayout={onWrapLayout}>
      <DevLabel name="UkMap" />

      {/* Map stage — the exact rectangle the SVG occupies under
          preserveAspectRatio='xMidYMid meet'. Silhouette AND markers live
          inside it, so they share one coordinate space by construction and
          cannot drift apart at any viewport size. */}
      {drawn.width > 0 && (
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', left: drawn.left, top: drawn.top, width: drawn.width, height: drawn.height }}
        >
          <UkMapSvg />

          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <AnimatePresence>
              {markers.map(m => (
                <View
                  key={m.key}
                  style={{
                    position: 'absolute',
                    left:     `${(m.anchor.x / VIEWBOX_SIZE) * 100}%` as any,
                    top:      `${(m.anchor.y / VIEWBOX_SIZE) * 100}%` as any,
                  }}
                >
                  <MapMarker
                    location={m.anchor}
                    post={m.post}
                    groupKey={m.groupKey}
                    handle={m.handle}
                    // Scotland sits near the top edge of the viewBox — a
                    // shorter stem keeps the card inside the map area.
                    stemMultiplier={SCOTTISH_LOCATION_IDS.has(m.anchor.id) ? 0.5 : 1}
                  />
                </View>
              ))}
            </AnimatePresence>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex:        1,
    width:       '100%',
    aspectRatio: 1,
    alignSelf:   'center',
    position:    'relative',
    overflow:    'visible',
  },
});
