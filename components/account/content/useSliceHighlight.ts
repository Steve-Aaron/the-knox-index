import { useCallback, useEffect, useState } from 'react';

/**
 * Which content slice is highlighted across the donut and the table.
 *
 * Hover previews a slice (pointer devices); press pins it, and pressing the
 * pinned slice again clears it (the only way on touch, where there is no
 * hover). The preview wins while the pointer is over a slice, so you can
 * glance at others without losing the pinned one.
 *
 * `resetKey` clears everything when the slices change, e.g. a new dimension.
 *
 * One job: own the highlighted slice key.
 */
export interface SliceHighlight {
  /** Slice to emphasise, or null when nothing is highlighted. */
  activeKey: string | null;
  /** Slice pinned by a press. */
  pinnedKey: string | null;
  hover:     (key: string | null) => void;
  toggle:    (key: string) => void;
}

export function useSliceHighlight(resetKey: unknown): SliceHighlight {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);

  useEffect(() => {
    setHoveredKey(null);
    setPinnedKey(null);
  }, [resetKey]);

  const toggle = useCallback((key: string) => {
    setPinnedKey(current => (current === key ? null : key));
  }, []);

  return {
    activeKey: hoveredKey ?? pinnedKey,
    pinnedKey,
    hover:     setHoveredKey,
    toggle,
  };
}
