import React, { useEffect, useState } from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';

/**
 * CountUp
 * --------
 * Animate a number from 0 to `value` over `durationMs`. One job.
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

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const to = value;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic — crisper arrival than linear, no overshoot.
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
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
  compact: (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return `${n}`;
  },
};
