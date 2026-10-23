import React, { useEffect, useRef, useState } from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import { fmtCount } from '@/lib/format';

/**
 * CountUp
 * --------
 * Animate a number to `value` over `durationMs`: from 0 on mount, then from
 * the number on screen when `value` changes, so a new value never drops back
 * to 0 first. One job.
 * Uses requestAnimationFrame so it behaves on web and native without
 * reaching for Reanimated (kept simple for predictable number formatting).
 */
interface Props {
  value: number;
  durationMs?: number;
  format?: (n: number) => string;
  style?: StyleProp<TextStyle>;
}

export function CountUp({ value, durationMs = 700, format, style }: Props) {
  const [display, setDisplay] = useState(0);
  const shown = useRef(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = shown.current;
    const to = value;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic — crisper arrival than linear, no overshoot.
      const eased = 1 - Math.pow(1 - t, 3);
      shown.current = from + (to - from) * eased;
      setDisplay(shown.current);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  const rounded = Math.round(display);
  const text = format ? format(rounded) : rounded.toLocaleString();
  return <Text style={style}>{text}</Text>;
}

export const formatters = {
  int: (n: number) => n.toLocaleString(),
  pct: (n: number) => `${n}`,
  // Single implementation in lib/format.ts, so 1,000M reads as 1B everywhere.
  compact: fmtCount,
};
