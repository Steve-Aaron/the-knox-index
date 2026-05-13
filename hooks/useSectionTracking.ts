/**
 * hooks/useSectionTracking.ts
 * ----------------------------
 * Area 9: Scroll depth / section reach.
 *
 * Returns a `sectionRef` function. Attach it to a View's `ref` prop and
 * pass a section name. When the element first scrolls into the viewport
 * (web: IntersectionObserver; other: always fires on mount as a fallback),
 * a `section_reached` event is fired once per section per session.
 *
 * Usage:
 *   const sectionRef = useSectionTracking();
 *   <View ref={sectionRef('post_feed')}>...</View>
 *
 * One job: emit section_reached exactly once per section without polluting
 * component code with observer boilerplate.
 */

import { useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { track } from '@/lib/analytics';

type SectionName =
  | 'key_findings'
  | 'main_panels'
  | 'post_feed'
  | 'party_leaderboard'
  | 'style_breakdown'
  | 'contact_footer';

export function useSectionTracking() {
  // Set of sections already fired this session — prevents double-counting on re-render.
  const firedRef     = useRef<Set<SectionName>>(new Set());
  // Map of section → IntersectionObserver (web only).
  const observersRef = useRef<Map<SectionName, IntersectionObserver>>(new Map());

  const sectionRef = useCallback((name: SectionName) => {
    return (node: unknown) => {
      if (!node) {
        // Node unmounted — disconnect any existing observer for this section.
        observersRef.current.get(name)?.disconnect();
        observersRef.current.delete(name);
        return;
      }

      if (Platform.OS !== 'web' || typeof IntersectionObserver === 'undefined') {
        // Native fallback: fire immediately on mount (conservative but consistent).
        if (!firedRef.current.has(name)) {
          firedRef.current.add(name);
          track('section_reached', { section: name, method: 'native_mount' });
        }
        return;
      }

      // Web: use IntersectionObserver so we only fire when the section is
      // actually visible in the viewport (threshold 10% to trigger early).
      if (observersRef.current.has(name)) {
        observersRef.current.get(name)?.disconnect();
      }

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting && !firedRef.current.has(name)) {
              firedRef.current.add(name);
              track('section_reached', {
                section:                name,
                method:                 'intersection_observer',
                intersection_ratio:     Math.round(entry.intersectionRatio * 100),
              });
              // Section fired — no need to keep observing.
              observer.disconnect();
              observersRef.current.delete(name);
            }
          }
        },
        { threshold: 0.10 },
      );

      observer.observe(node as Element);
      observersRef.current.set(name, observer);
    };
  }, []);

  return sectionRef;
}
