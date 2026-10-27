import React, { useId, useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Mask, Path, RadialGradient, Stop } from 'react-native-svg';
import Animated, { Easing, useAnimatedProps } from 'react-native-reanimated';
import { DevLabel } from '@/components/primitives/DevLabel';
import { useInViewport } from '@/hooks/useInViewport';
import { ringSegmentPath } from './geometry';
import { useEntryProgress } from './useEntryProgress';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

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
 * The ring draws itself clockwise from 12 o'clock once it scrolls into view,
 * and again whenever the segments change (new range, new tab): the segments
 * are static, a mask stroke sweeping round reveals them.
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

const SWEEP = { duration: 900, easing: Easing.out(Easing.cubic) };

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

  const paths = useMemo(() => {
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
      return {
        key:   seg.key,
        color: seg.color,
        d:     end > start ? ringSegmentPath(cx, cy, outerR, innerR, start, end) : null,
      };
    });
  }, [segments, gapDeg, cx, cy, outerR, innerR]);

  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [viewRef, seen] = useInViewport();
  const progress = useEntryProgress(seen, segments.map(s => `${s.key}:${s.value}`).join('|'), SWEEP);
  // A stroke down the middle of the ring, rotated to start at 12 o'clock;
  // its dash grows from nothing to a full turn. +1 hides the seam.
  const maskR = (outerR + innerR) / 2;
  const dash = 2 * Math.PI * maskR + 1;
  const maskProps = useAnimatedProps(() => ({ strokeDashoffset: dash * (1 - progress.value) }));

  return (
    <View ref={viewRef} style={{ width: size, height: size }}>
      <DevLabel name="DonutChart" />
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <Mask id={`donut-sweep-${id}`}>
            <AnimatedCircle
              animatedProps={maskProps}
              cx={cx}
              cy={cy}
              r={maskR}
              fill="none"
              stroke="#fff"
              strokeWidth={thickness + 2}
              strokeDasharray={`${dash} ${dash}`}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          </Mask>
          {centreGlow ? (
            <RadialGradient id={`donut-glow-${id}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={centreGlow} stopOpacity={0.2} />
              <Stop offset="100%" stopColor={centreGlow} stopOpacity={0} />
            </RadialGradient>
          ) : null}
        </Defs>
        {centreGlow ? <Circle cx={cx} cy={cy} r={innerR} fill={`url(#donut-glow-${id})`} /> : null}
        <G mask={`url(#donut-sweep-${id})`}>
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
        </G>
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
