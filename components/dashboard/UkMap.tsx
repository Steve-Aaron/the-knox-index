import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { AnimatePresence } from 'moti';
import { DevLabel } from '@/components/primitives/DevLabel';
import { UkMapSvg } from './UkMapSvg';
import { MapMarker } from './MapMarker';
import { UK_MARKER_LOCATIONS, SCOTTISH_LOCATION_IDS } from '@/lib/uk-locations';
import type { Politician, RecentPost } from '@/data/types';
import type { PartyKey } from '@/theme/colors';

/**
 * UkMap
 * ------
 * Hero map: the UK silhouette with looping marker reveals over England + Wales.
 *
 * Scheduler:
 *   t=0  marker A appears        ┐
 *   t=2  marker B appears        │ overlap = 1s (two visible at once)
 *   t=3  marker A vanishes       │
 *   t=4  marker C appears        ┘
 *   …loops forever, picking random locations + posts that aren't already active.
 *
 * One job: orchestrate the map + animated markers + video pool.
 *
 * Composes:
 *   - UkMapSvg       (country shape, decorative)
 *   - MapMarker x N  (active markers — one component instance per active pin)
 */

// Slowed cadence — twice as long between cards as the original brief.
// At 4s spawn × 10s life we get a sedate 2-3 visible at any moment, with each
// video on screen long enough for the eye to actually watch it.
const SPAWN_INTERVAL_MS = 4000;
const MARKER_LIFE_MS    = 10000;
const MAX_MARKERS       = 2;      // hard cap — never more than two cards on screen

interface Props {
  politicians: Politician[];
}

interface ActiveMarker {
  /** Stable key for AnimatePresence */
  key:      number;
  location: typeof UK_MARKER_LOCATIONS[number];
  post:     RecentPost;
  partyKey: PartyKey;
  handle:   string;
}

export function UkMap({ politicians }: Props) {
  const { width: winWidth } = useWindowDimensions();

  // ── Build the video pool from politicians' top posts ────────────────────────
  // We need posts that actually have an MP4 — otherwise the card has nothing
  // to play (the fallback still renders, but a real video is the whole point).
  const videoPool = useMemo(() => {
    const all = politicians.flatMap(p =>
      (p.recentPosts ?? [])
        .filter(post => !!post.videoMp4)
        .map(post => ({ post, partyKey: p.partyKey, handle: p.handle }))
    );
    // Sort by views desc, take the top 30. More than that is rarely useful;
    // fewer means the loop starts repeating too quickly.
    return all.sort((a, b) => b.post.views - a.post.views).slice(0, 30);
  }, [politicians]);

  // ── Active marker state — single effect owns both spawn and expiry ─────────
  // The PREVIOUS implementation used a second effect to schedule expiry, but
  // its cleanup ran on every render of `markers` and cancelled the in-flight
  // expiry timers. That's why videos weren't disappearing. Now spawn + expiry
  // share one effect; expiry is scheduled inline at the moment of spawn so it
  // can't be cancelled by an unrelated re-render. A hard MAX_MARKERS cap is
  // belt-and-braces in case timings drift.
  const [markers, setMarkers] = useState<ActiveMarker[]>([]);
  const keyRef = useRef(0);

  useEffect(() => {
    if (videoPool.length === 0) return;

    const expiryTimers = new Set<ReturnType<typeof setTimeout>>();

    const spawn = () => {
      setMarkers(prev => {
        if (prev.length >= MAX_MARKERS) return prev;

        // Avoid duplicating an active location or post.
        const usedLocIds  = new Set(prev.map(m => m.location.id));
        const usedPostIds = new Set(prev.map(m => m.post.postId));

        const freeLocations = UK_MARKER_LOCATIONS.filter(l => !usedLocIds.has(l.id));
        const freePosts     = videoPool.filter(v => !usedPostIds.has(v.post.postId));
        if (freeLocations.length === 0 || freePosts.length === 0) return prev;

        const location = freeLocations[Math.floor(Math.random() * freeLocations.length)];
        const pick     = freePosts[Math.floor(Math.random() * freePosts.length)];
        const newKey   = ++keyRef.current;

        // Schedule THIS marker's expiry NOW. The timer holds `newKey` in
        // closure so it removes exactly the right entry regardless of how
        // many other markers have spawned in the meantime.
        const timer = setTimeout(() => {
          setMarkers(cur => cur.filter(x => x.key !== newKey));
          expiryTimers.delete(timer);
        }, MARKER_LIFE_MS);
        expiryTimers.add(timer);

        return [...prev, {
          key:      newKey,
          location,
          post:     pick.post,
          partyKey: pick.partyKey,
          handle:   pick.handle,
        }];
      });
    };

    // Kick off immediately so the user sees the first marker without a 2s wait.
    spawn();
    const spawnInterval = setInterval(spawn, SPAWN_INTERVAL_MS);

    return () => {
      clearInterval(spawnInterval);
      expiryTimers.forEach(clearTimeout);
      expiryTimers.clear();
    };
  }, [videoPool]);

  return (
    <View style={styles.wrap}>
      <DevLabel name="UkMap" />

      {/* Country silhouette — fills the wrap. */}
      <UkMapSvg />

      {/* Marker layer — absolutely positioned per location.
          pointerEvents='box-none' lets clicks pass through the empty space
          but child cards still receive them (Pressable on the card itself). */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <AnimatePresence>
          {markers.map(m => (
            <View
              key={m.key}
              style={{
                position: 'absolute',
                left:     `${(m.location.x / 1024) * 100}%` as any,
                top:      `${(m.location.y / 1024) * 100}%` as any,
              }}
            >
              <MapMarker
                location={m.location}
                post={m.post}
                partyKey={m.partyKey}
                handle={m.handle}
                // Scotland sits near the top edge of the viewBox — give those
                // markers a shorter connector stem so the video card stays
                // inside the map area. England/Wales keep the default.
                stemMultiplier={SCOTTISH_LOCATION_IDS.has(m.location.id) ? 0.5 : 1}
              />
            </View>
          ))}
        </AnimatePresence>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Original layout — flex + width + aspectRatio. This was the version that
  // worked best position-wise per the user, so restored verbatim.
  wrap: {
    flex:        1,
    width:       '100%',
    aspectRatio: 1,
    alignSelf:   'center',
    position:    'relative',
    overflow:    'visible',
  },
});
