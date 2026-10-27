import React, { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { DevLabel } from '@/components/primitives/DevLabel';
import { ringSegmentPath } from './geometry';

/**
 * DonutChart
 * -----------
 * Generic ring chart. Segments are sized by `value`; anything rendered as
 * children is centred in the hole (e.g. a total + delta).
 *
 * Optionally interactive: pass `activeKey` to emphasise one segment (the rest
 * dim), and `onSegmentHover` / `onSegmentPress` to drive it. Hover only
 * reacts to a mouse, so a tap on touch doesn't leave a stuck preview.
 *
 * The ring draws itself clockwise from 12 o'clock on mount and again whenever
 * the segments change (new range, new tab).
 *
 * One job: draw proportional ring segments with a centre slot.
 */
export interface DonutSegment {
  key:   string;
  value: number;
  color: string;
}

interface Props {
  segments:   DonutSegment[];
  size:       number;
  /** Ring thickness in px. */
  thickness?: number;
  /** Gap between segments in degrees. */
  gapDeg?:    number;
  /** Segment to emphasise; the others dim. Null / undefined = all equal. */
  activeKey?: string | null;
  /** Mouse entered (key) or left (null) a segment. */
  onSegmentHover?: (key: string | null) => void;
  onSegmentPress?: (key: string) => void;
  /** Soft radial glow filling the hole, e.g. the leading segment's colour. */
  centreGlow?: string;
  children?:  React.ReactNode;
}

const SWEEP_MS = 900;

/** 0 → 1 over SWEEP_MS, eased out, restarting whenever `trigger` changes. */
function useSweep(trigger: string): number {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let frame = 0;
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / SWEEP_MS);
      setProgress(1 - (1 - t) ** 3);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    setProgress(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [trigger]);
  return progress;
}

/** Opacity of the segments that aren't active. */
const DIMMED_OPACITY = 0.25;

/** Pointer handlers for one segment. Web only — native has no hover. */
function hoverProps(key: string, onHover?: (key: string | null) => void): object {
  if (!onHover || Platform.OS !== 'web') return {};
  const isMouse = (e: any) => (e?.pointerType ?? e?.nativeEvent?.pointerType) === 'mouse';
  return {
    onPointerEnter: (e: any) => { if (isMouse(e)) onHover(key); },
    onPointerLeave: (e: any) => { if (isMouse(e)) onHover(null); },
    style:          { cursor: 'pointer', transition: 'opacity 160ms ease' },
  };
}

export function DonutChart({
  segments,
  size,
  thickness = 32,
  gapDeg = 1.5,
  activeKey,
  onSegmentHover,
  onSegmentPress,
  centreGlow,
  children,
}: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2;
  const innerR = Math.max(0, outerR - thickness);

  const arcs = useMemo(() => {
    const total = segments.reduce((s, seg) => s + Math.max(0, seg.value), 0);
    if (total <= 0) return [];
    // A gap only makes sense between two or more segments.
    const gap = segments.length > 1 ? gapDeg : 0;

    let cursor = 0;
    return segments.map(seg => {
      const sweep = (Math.max(0, seg.value) / total) * 360;
      const start = cursor + gap / 2;
      // Clamp just under 360 so a single full segment still draws as an arc.
      const end = Math.min(cursor + sweep - gap / 2, cursor + 359.99);
      cursor += sweep;
      return { key: seg.key, color: seg.color, start, end };
    });
  }, [segments, gapDeg]);

  const sweepKey = segments.map(s => `${s.key}:${s.value}`).join('|');
  const progress = useSweep(sweepKey);
  // Each segment is cut at the sweep's leading edge.
  const edge = progress * 360;
  const paths = arcs.map(a => {
    const end = Math.min(a.end, edge);
    return { ...a, d: end > a.start ? ringSegmentPath(cx, cy, outerR, innerR, a.start, end) : null };
  });

  return (
    <View style={{ width: size, height: size }}>
      <DevLabel name="DonutChart" />
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {centreGlow ? (
          <>
            <Defs>
              <RadialGradient id="donut-centre-glow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={centreGlow} stopOpacity={0.2} />
                <Stop offset="100%" stopColor={centreGlow} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={cx} cy={cy} r={innerR} fill="url(#donut-centre-glow)" />
          </>
        ) : null}
        {paths.map(p => (p.d ? (
          <Path
            key={p.key}
            d={p.d}
            fill={p.color}
            opacity={activeKey != null && activeKey !== p.key ? DIMMED_OPACITY : 1}
            onPress={onSegmentPress ? () => onSegmentPress(p.key) : undefined}
            {...hoverProps(p.key, onSegmentHover)}
          />
        ) : null))}
      </Svg>
      <View style={styles.centre} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: {
    ...StyleSheet.absoluteFillObject,
    alignItems:     'center',
    justifyContent: 'center',
  },
});
