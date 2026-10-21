import React, { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { MotiView } from 'moti';
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
  children?:  React.ReactNode;
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

  return (
    <View style={{ width: size, height: size }}>
      <DevLabel name="DonutChart" />
      <MotiView
        from={{ opacity: 0, rotate: '-30deg' }}
        animate={{ opacity: 1, rotate: '0deg' }}
        transition={{ type: 'timing', duration: 600 }}
        style={StyleSheet.absoluteFill}
      >
        <Svg width={size} height={size}>
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
      </MotiView>
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
