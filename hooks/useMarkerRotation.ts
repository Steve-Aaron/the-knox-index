/**
 * hooks/useMarkerRotation.ts
 * ---------------------------
 * The hero map's marker scheduler, shared by every map.
 *
 *   t=0  marker A appears        ┐
 *   t=4  marker B appears        │ two on screen at once
 *   t=10 marker A expires        ┘ …loops forever
 *
 * Spawn and expiry live in ONE effect, and each marker's expiry timer is
 * scheduled at the moment it spawns, holding its own key in closure. A second
 * effect would have its cleanup run on every render of the marker list and
 * silently cancel the in-flight timers — which is exactly the bug that once
 * left cards on screen forever.
 *
 * One job: decide which markers are visible right now.
 */

import { useEffect, useRef, useState } from 'react';
import type { RecentPost } from '@/data/types';
import type { GroupKey } from '@/theme/colors';

/**
 * A point on a map. Flat maps position by `x`/`y` in viewBox units; the globe
 * re-projects `lon`/`lat` on every frame, so it carries those instead.
 */
export interface MarkerAnchor {
  id:   string;
  name: string;
  x:    number;
  y:    number;
  /** Degrees. Set by the globe; unused by the flat UK map. */
  lon?: number;
  lat?: number;
}

/** One thing the map could show: a post pinned to a place. */
export interface MarkerCandidate {
  anchor:   MarkerAnchor;
  post:     RecentPost;
  groupKey: GroupKey;
  handle:   string;
}

export interface ActiveMarker extends MarkerCandidate {
  /** Stable key for AnimatePresence. */
  key: number;
}

export interface RotationOptions {
  /** Gap between spawns. */
  spawnIntervalMs?: number;
  /** How long each marker stays. */
  lifeMs?:          number;
  /** Hard cap on simultaneous markers — belt and braces if timings drift. */
  maxMarkers?:      number;
}

const DEFAULTS: Required<RotationOptions> = {
  spawnIntervalMs: 4000,
  lifeMs:          10000,
  maxMarkers:      2,
};

export function useMarkerRotation(
  candidates: MarkerCandidate[],
  options: RotationOptions = {},
): ActiveMarker[] {
  const { spawnIntervalMs, lifeMs, maxMarkers } = { ...DEFAULTS, ...options };
  const [markers, setMarkers] = useState<ActiveMarker[]>([]);
  const keyRef = useRef(0);

  useEffect(() => {
    if (candidates.length === 0) {
      setMarkers([]);
      return;
    }

    const expiryTimers = new Set<ReturnType<typeof setTimeout>>();

    const spawn = () => {
      setMarkers(prev => {
        if (prev.length >= maxMarkers) return prev;

        // Never show the same place or the same post twice at once.
        const usedAnchors = new Set(prev.map(m => m.anchor.id));
        const usedPosts   = new Set(prev.map(m => m.post.postId));
        const free = candidates.filter(
          c => !usedAnchors.has(c.anchor.id) && !usedPosts.has(c.post.postId),
        );
        if (free.length === 0) return prev;

        const pick   = free[Math.floor(Math.random() * free.length)];
        const newKey = ++keyRef.current;

        const timer = setTimeout(() => {
          setMarkers(cur => cur.filter(x => x.key !== newKey));
          expiryTimers.delete(timer);
        }, lifeMs);
        expiryTimers.add(timer);

        return [...prev, { ...pick, key: newKey }];
      });
    };

    // Kick off immediately so the first card doesn't wait a full interval.
    spawn();
    const interval = setInterval(spawn, spawnIntervalMs);

    return () => {
      clearInterval(interval);
      expiryTimers.forEach(clearTimeout);
      expiryTimers.clear();
    };
  }, [candidates, spawnIntervalMs, lifeMs, maxMarkers]);

  return markers;
}
