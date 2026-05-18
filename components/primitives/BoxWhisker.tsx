import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent, Platform } from 'react-native';
import Svg, { Line, Rect, Circle, Text as SvgText } from 'react-native-svg';
import Animated, { useSharedValue, withSpring, useAnimatedProps } from 'react-native-reanimated';
import { neutral } from '@/theme/colors';
import { type, font } from '@/theme/typography';
import type { MetricBenchmark } from '@/data/types';

/**
 * BoxWhisker
 * -----------
 * Lighter, interactive horizontal box-and-whisker plot.
 *
 * Visual anatomy:
 *   whisker ─── [══box══|median══] ─── whisker
 *                       ╌ mean (dashed)
 *                              ● this post
 *
 * Interactivity (web):
 *   hover each element → tooltip below explains what it means.
 *   Dot animates from median position to actual value on mount.
 *
 * One job: show where this post sits in the distribution.
 */

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type HoveredPart = null | 'dot' | 'box' | 'median' | 'mean' | 'left' | 'right';

interface Props {
  label:     string;
  value:     number;
  benchmark: MetricBenchmark;
  colour:    string;
  format?:   (n: number) => string;
  /** 'log' compresses outliers so the IQR box is always readable.
   *  Use for view counts (power-law distribution).
   *  Use 'linear' for bounded metrics like engagement rate. */
  scaleType?: 'linear' | 'log';
}

// SVG geometry constants
const SVG_H     = 52;
const Y_MID     = 22;
const BOX_H     = 24;
const Y_BOX_TOP = Y_MID - BOX_H / 2;
const TICK_H    = 16;
const DOT_R     = 6;
const PAD       = DOT_R + 4;

/** Apply log₁₀ transformation, guarding against ≤0 values. */
function toLog(v: number): number { return Math.log10(Math.max(v, 1)); }

function scale(value: number, min: number, max: number, width: number, useLog = false): number {
  const sv   = useLog ? toLog(value) : value;
  const smin = useLog ? toLog(min)   : min;
  const smax = useLog ? toLog(max)   : max;
  if (smax <= smin) return width / 2;
  return PAD + Math.max(0, Math.min(1, (sv - smin) / (smax - smin))) * (width - PAD * 2);
}

function zone(value: number, p25: number, median: number, p75: number) {
  if (value >= p75) return { label: 'Top 25%',      bright: true };
  if (value >= median) return { label: 'Above median', bright: true };
  if (value >= p25)    return { label: 'Below median', bright: false };
  return                      { label: 'Bottom 25%',   bright: false };
}

const PART_TIPS: Record<NonNullable<HoveredPart>, (b: MetricBenchmark, fmt: (n: number) => string) => string> = {
  dot:    (b, f) => `This post's value`,
  box:    (b, f) => `Middle 50% (IQR): ${f(b.p25)} → ${f(b.p75)}`,
  median: (b, f) => `Median: ${f(b.median)} — half of all posts fall on each side`,
  mean:   (b, f) => `Mean average: ${f(b.mean)}`,
  left:   (b, f) => `Bottom 25%: all posts with less than ${f(b.p25)}`,
  right:  (b, f) => `Top 25%: all posts with more than ${f(b.p75)}`,
};

function defaultFmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function hex(colour: string, opacity: number): string {
  // Convert a hex colour to rgba
  const r = parseInt(colour.slice(1, 3), 16);
  const g = parseInt(colour.slice(3, 5), 16);
  const b = parseInt(colour.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

export function BoxWhisker({ label, value, benchmark, colour, format, scaleType = 'linear' }: Props) {
  const useLog = scaleType === 'log';
  const fmt = format ?? defaultFmt;
  const [width, setWidth]       = useState(0);
  const [hovered, setHovered]   = useState<HoveredPart>(null);
  const [dotHovered, setDotHovered] = useState(false);

  const { min, p25, median, mean, p75, max } = benchmark;

  // Animated dot — springs from median to actual value on first layout
  const dotX = useSharedValue(0);
  const animDotProps = useAnimatedProps(() => ({ cx: dotX.value } as any));

  useEffect(() => {
    if (width <= 0) return;
    const medX = scale(median, min, max, width, useLog);
    const valX = scale(value,  min, max, width, useLog);
    dotX.value = medX;
    dotX.value = withSpring(valX, { damping: 18, stiffness: 100 });
  }, [width, value, median, min, max]); // eslint-disable-line react-hooks/exhaustive-deps

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const p    = (v: number) => scale(v, min, max, width, useLog);
  const minX = PAD;
  const maxX = width > 0 ? width - PAD : 0;
  const p25X = width > 0 ? p(p25) : 0;
  const medX = width > 0 ? p(median) : 0;
  const avgX = width > 0 ? p(mean) : 0;
  const p75X = width > 0 ? p(p75) : 0;

  const z    = zone(value, p25, median, p75);
  const tip  = hovered ? PART_TIPS[hovered](benchmark, fmt) : null;

  // Web hover helpers
  const hover = (part: HoveredPart) =>
    Platform.OS === 'web' ? { onMouseEnter: () => setHovered(part), onMouseLeave: () => setHovered(null) } as any : {};
  const dotHover =
    Platform.OS === 'web' ? { onMouseEnter: () => { setHovered('dot'); setDotHovered(true); }, onMouseLeave: () => { setHovered(null); setDotHovered(false); } } as any : {};

  return (
    <View style={styles.wrap} onLayout={onLayout}>

      {/* ── Header: label + value + zone badge ── */}
      <View style={styles.header}>
        <Text style={styles.metricLabel}>{label.toUpperCase()}</Text>
        <View style={styles.headerRight}>
          <View style={[
            styles.zoneBadge,
            { backgroundColor: z.bright ? hex(colour, 0.18) : 'rgba(255,255,255,0.06)', borderColor: z.bright ? hex(colour, 0.45) : 'rgba(255,255,255,0.14)' },
          ]}>
            <Text style={[styles.zoneBadgeText, { color: z.bright ? colour : neutral.textDim }]}>
              {z.label}
            </Text>
          </View>
          <Text style={[styles.metricValue, { color: colour }]}>{fmt(value)}</Text>
        </View>
      </View>

      {/* ── SVG box plot ── */}
      {width > 0 && (
        <Svg width={width} height={SVG_H}>

          {/* Left whisker: min → p25 */}
          <Line x1={minX} y1={Y_MID} x2={p25X} y2={Y_MID}
            stroke={neutral.strokeHi} strokeWidth={1.5} />
          {/* Min end tick */}
          <Line x1={minX} y1={Y_MID - TICK_H / 2} x2={minX} y2={Y_MID + TICK_H / 2}
            stroke={neutral.strokeHi} strokeWidth={1.5} />

          {/* Right whisker: p75 → max */}
          <Line x1={p75X} y1={Y_MID} x2={maxX} y2={Y_MID}
            stroke={neutral.strokeHi} strokeWidth={1.5} />
          {/* Max end tick */}
          <Line x1={maxX} y1={Y_MID - TICK_H / 2} x2={maxX} y2={Y_MID + TICK_H / 2}
            stroke={neutral.strokeHi} strokeWidth={1.5} />

          {/* IQR box (p25 → p75) — party-coloured */}
          <Rect
            x={p25X} y={Y_BOX_TOP}
            width={Math.max(0, p75X - p25X)} height={BOX_H}
            fill={hex(colour, 0.18)}
            stroke={hex(colour, 0.55)}
            strokeWidth={1.5}
            rx={3}
          />

          {/* Mean dashed line */}
          <Line
            x1={avgX} y1={Y_BOX_TOP + 4} x2={avgX} y2={Y_BOX_TOP + BOX_H - 4}
            stroke={neutral.textDim} strokeWidth={1.5} strokeDasharray="3 3"
          />

          {/* Median line — party colour, thicker */}
          <Line
            x1={medX} y1={Y_BOX_TOP} x2={medX} y2={Y_BOX_TOP + BOX_H}
            stroke={colour} strokeWidth={2.5}
          />

          {/* Benchmark value labels below the box */}
          <SvgText x={p25X} y={SVG_H - 2} fontSize={8} fill={neutral.textDim} textAnchor="middle">
            {fmt(p25)}
          </SvgText>
          <SvgText x={medX} y={SVG_H - 2} fontSize={8} fill={neutral.textMid} textAnchor="middle">
            {fmt(median)}
          </SvgText>
          <SvgText x={p75X} y={SVG_H - 2} fontSize={8} fill={neutral.textDim} textAnchor="middle">
            {fmt(p75)}
          </SvgText>

          {/* Invisible hit areas for hover — laid on top */}

          {/* Left whisker zone */}
          <Rect x={minX} y={0} width={Math.max(0, p25X - minX)} height={SVG_H - 10}
            fill="transparent" {...hover('left')} />

          {/* IQR box zone */}
          <Rect x={p25X} y={0} width={Math.max(0, p75X - p25X)} height={SVG_H - 10}
            fill="transparent" {...hover('box')} />

          {/* Right whisker zone */}
          <Rect x={p75X} y={0} width={Math.max(0, maxX - p75X)} height={SVG_H - 10}
            fill="transparent" {...hover('right')} />

          {/* Median hit area (narrow strip) */}
          <Rect x={medX - 8} y={0} width={16} height={SVG_H - 10}
            fill="transparent" {...hover('median')} />

          {/* Mean hit area */}
          <Rect x={avgX - 8} y={0} width={16} height={SVG_H - 10}
            fill="transparent" {...hover('mean')} />

          {/* Value dot — animated, rendered last so it's on top */}
          <AnimatedCircle
            animatedProps={animDotProps}
            cy={Y_MID}
            r={dotHovered ? 8 : 6}
            fill={colour}
            stroke="#ffffff"
            strokeWidth={dotHovered ? 2.5 : 2}
            {...dotHover}
          />

          {/* Dot label "THIS POST" above dot */}
          {dotHovered && (
            <SvgText
              x={scale(value, min, max, width)}
              y={Y_BOX_TOP - 4}
              fontSize={8}
              fill={colour}
              textAnchor="middle"
              fontWeight="700"
            >
              THIS POST
            </SvgText>
          )}

        </Svg>
      )}

      {/* ── Interactive tooltip ── */}
      <View style={styles.tooltip}>
        {tip ? (
          <Text style={[styles.tipText, styles.tipActive]}>{tip}</Text>
        ) : (
          <Text style={styles.tipText}>
            <Text style={styles.tipDim}>p25 </Text>
            <Text style={styles.tipNum}>{fmt(p25)}</Text>
            <Text style={styles.tipDim}>  median </Text>
            <Text style={styles.tipNum}>{fmt(median)}</Text>
            <Text style={styles.tipDim}>  avg </Text>
            <Text style={styles.tipNum}>{fmt(mean)}</Text>
            <Text style={styles.tipDim}>  p75 </Text>
            <Text style={styles.tipNum}>{fmt(p75)}</Text>
          </Text>
        )}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4, minWidth: 0, flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricLabel: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 12,
    letterSpacing: 0.6,
  },
  metricValue: {
    fontFamily: font.mono,
    fontSize: 16,
    fontWeight: '700',
  },

  zoneBadge: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  zoneBadgeText: {
    fontFamily: font.bold,
    fontSize: 12,
    letterSpacing: 0.4,
  },

  tooltip: {
    minHeight: 16,
  },
  tipText: {
    fontFamily: font.ui,
    color: neutral.textDim,
    fontSize: 12,
    lineHeight: 15,
  },
  tipActive: {
    color: neutral.textMid,
    fontFamily: font.bold,
    fontSize: 12,
  },
  tipDim: {
    fontFamily: font.ui,
    color: neutral.textDim,
    fontSize: 12,
  },
  tipNum: {
    fontFamily: font.mono,
    color: neutral.textMid,
    fontSize: 12,
  },
});
