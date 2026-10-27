/**
 * hooks/useInViewport.ts
 * -----------------------
 * Whether an element has scrolled into the viewport yet. Latches: once seen
 * it stays true, so an entry animation plays once and later data changes
 * animate in place.
 *
 * Web: IntersectionObserver. Native (or no observer): true on mount.
 *
 * Usage:
 *   const [ref, seen] = useInViewport();
 *   <View ref={ref}>...</View>
 *
 * One job: tell a component when it first becomes visible.
 */

import { useCallback, useRef, useState } from 'react';
import { Platform, type View } from 'react-native';

/** Share of the element that must be visible to count as seen. */
const THRESHOLD = 0.3;

export function useInViewport(): [(node: View | null) => void, boolean] {
  const canObserve = Platform.OS === 'web' && typeof IntersectionObserver !== 'undefined';
  const [seen, setSeen] = useState(!canObserve);
  const observer = useRef<IntersectionObserver | null>(null);

  const ref = useCallback((node: View | null) => {
    observer.current?.disconnect();
    observer.current = null;
    // On web a View ref is its DOM element.
    if (!canObserve || !(node instanceof Element)) return;

    observer.current = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        setSeen(true);
        observer.current?.disconnect();
        observer.current = null;
      }
    }, { threshold: THRESHOLD });
    observer.current.observe(node);
  }, [canObserve]);

  return [ref, seen];
}
