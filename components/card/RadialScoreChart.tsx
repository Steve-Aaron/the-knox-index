import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { track } from '@/lib/analytics';
import Svg, { Polygon, Circle, Line, Text as SvgText, Rect, Defs, RadialGradient, Stop, G } from 'react-native-svg';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming, withDelay, Easing } from 'react-native-reanimated';
import { party, PartyKey, neutral, glass, accent } from '@/theme/colors';
import { type, font } from '@/theme/typography';
import type { TopTrumpScores, ScoreKey } from '@/data/types';

/**
 * SVG text fontFamily must be the CSS web name on web ('Montserrat') and the
 * PostScript asset name on native ('Montserrat_600SemiBold' etc.).
 * Expo Google Fonts registers both forms at load time via @expo-google-fonts.
 */
const SVG_FONT_LABEL  = Platform.select({ web: 'Figtree', default: 'Figtree_600SemiBold' });
const SVG_WEIGHT_LABEL: string = '600';
import { timing } from '@/theme/motion';
import { DevLabel } from '@/components/primitives/DevLabel';

const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);
const AnimatedG       = Animated.createAnimatedComponent(G);

/**
 * RadialScoreChart
 * -----------------
 * 5-axis radar chart. Axes: views | frequency | engagement | followers | knox.
 * Hover/press an axis label to expand it with score value + full description.
 * Click a score dot to see the raw underlying metric value.
 * One job.
 */
export interface RawScoreValues {
  views:      number;   // avg post views (raw number)
  frequency:  number;   // posts today
  engagement: number;   // (likes+comments+shares)/views * 100
  followers:  number;   // total followers
  knoxFactor: number;   // composite score (same as normalised)
}

interface Props {
  scores: TopTrumpScores;
  partyKey: PartyKey;
  size?: number;
  highlightKey?: ScoreKey | null;
  rawValues?: RawScoreValues;
}

const AXES: { key: ScoreKey; label: string; desc: string; format: (v: number) => string }[] = [
  { key: 'views',      label: 'Views',     desc: 'Avg post views',                        format: v => compact(v) + ' avg views' },
  { key: 'frequency',  label: 'Activity', desc: 'Posts this week',                       format: v => `${v} posts this week` },
  { key: 'engagement', label: 'Eng. %',    desc: 'Likes + comments + saves + shares per view',   format: v => v.toFixed(2) + '% eng. rate' },
  { key: 'followers',  label: 'Followers', desc: 'Total followers',                       format: v => compact(v) + ' followers' },
  { key: 'knoxFactor', label: 'Knox',      desc: 'Average of all four axes',             format: v => `${v} / 100` },
];

function compact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(Math.round(n));
}

function polar(cx: number, cy: number, radius: number, angleDeg: number) {
  const a = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
}

export function RadialScoreChart({ scores, partyKey, size = 440, highlightKey, rawValues }: Props) {
  const colour   = party[partyKey];
  const cx       = size / 2;
  const cy       = size / 2;
  const maxR     = size / 2 - 30;
  const noData   = AXES.every(a => (scores[a.key] ?? 0) === 0);

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [dotHoverIdx, setDotHoverIdx] = useState<number | null>(null);

  // Fire radial_chart_hovered once per mount when the user first interacts.
  const chartHoverFiredRef = useRef(false);
  useEffect(() => {
    if (chartHoverFiredRef.current) return;
    if (hoveredIdx !== null || dotHoverIdx !== null) {
      chartHoverFiredRef.current = true;
      const axisKey = hoveredIdx !== null ? AXES[hoveredIdx]?.key : null;
      track('radial_chart_hovered', {
        axis_key:  axisKey ?? null,
        party_key: partyKey,
      });
    }
  }, [hoveredIdx, dotHoverIdx, partyKey]);

  // Staged load-in: rings fade first, polygon grows with overshoot, dots pop last
  const ringOpacity = useSharedValue(0);
  const progress    = useSharedValue(0);
  const dotOpacity  = useSharedValue(0);

  useEffect(() => {
    // Reset
    ringOpacity.value = 0;
    progress.value    = 0;
    dotOpacity.value  = 0;

    // 1. Rings + spokes: fade in immediately
    ringOpacity.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.ease) });

    // 2. Polygon: delayed start, longer duration, slight overshoot
    progress.value = withDelay(
      180,
      withTiming(1, { duration: 1100, easing: Easing.out(Easing.back(1.08)) })
    );

    // 3. Score dots: pop in near the end of the polygon animation
    dotOpacity.value = withDelay(
      900,
      withTiming(1, { duration: 280, easing: Easing.out(Easing.ease) })
    );
  }, [scores]); // eslint-disable-line react-hooks/exhaustive-deps

  const ringGroupProps = useAnimatedProps(() => ({ opacity: ringOpacity.value } as any));
  const dotGroupProps  = useAnimatedProps(() => ({ opacity: dotOpacity.value } as any));

  const geometry = useMemo(() => {
    const rings = [0.25, 0.5, 0.75, 1].map(r => r * maxR);
    const axisPoints = AXES.map((_, i) => {
      const angle = (360 / AXES.length) * i;
      return { angle, end: polar(cx, cy, maxR, angle) };
    });
    const valuePoints = AXES.map((a, i) => {
      const angle = (360 / AXES.length) * i;
      const v = (scores[a.key] ?? 0) / 100;
      return polar(cx, cy, maxR * v, angle);
    });
    const labelPoints = AXES.map((_, i) => {
      const angle = (360 / AXES.length) * i;
      return polar(cx, cy, maxR + 18, angle);
    });
    return { rings, axisPoints, valuePoints, labelPoints };
  }, [cx, cy, maxR, scores]);

  const animatedPolygonProps = useAnimatedProps(() => {
    const t = progress.value;
    const pts = geometry.valuePoints.map(p => {
      const x = cx + (p.x - cx) * t;
      const y = cy + (p.y - cy) * t;
      return `${x},${y}`;
    });
    return { points: pts.join(' ') } as any;
  });

  return (
    <View style={{ width: size, height: size + 24, alignSelf: 'center' }}>
      <DevLabel name="RadialScoreChart" />
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={`spiderFill-${partyKey}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colour.glow} stopOpacity={0.55} />
            <Stop offset="100%" stopColor={colour.base} stopOpacity={0.15} />
          </RadialGradient>
        </Defs>

        {/* Concentric grid rings + spokes — fade in first */}
        <AnimatedG animatedProps={ringGroupProps}>
          {geometry.rings.map((r, idx) => (
            <Circle
              key={`ring-${idx}`}
              cx={cx} cy={cy} r={r}
              stroke={neutral.stroke}
              strokeOpacity={0.55}
              strokeWidth={1}
              fill="none"
            />
          ))}
          {geometry.axisPoints.map((p, idx) => (
            <Line
              key={`axis-${idx}`}
              x1={cx} y1={cy} x2={p.end.x} y2={p.end.y}
              stroke={neutral.stroke}
              strokeOpacity={0.45}
              strokeWidth={1}
            />
          ))}
        </AnimatedG>

        {/* Score polygon */}
        <AnimatedPolygon
          animatedProps={animatedPolygonProps}
          fill={`url(#spiderFill-${partyKey})`}
          stroke={colour.base}
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Axis end dots — pop in near the end of the polygon animation */}
        <AnimatedG animatedProps={dotGroupProps}>
        {geometry.valuePoints.map((p, idx) => {
          const isHi      = AXES[idx].key === highlightKey;
          const isHovered = dotHoverIdx === idx;
          return (
            <React.Fragment key={`dot-group-${idx}`}>
              <Circle
                cx={p.x} cy={p.y}
                r={isHovered ? 6 : isHi ? 4 : 2.5}
                fill={isHovered ? colour.glow : isHi ? colour.glow : colour.base}
                stroke={isHovered ? '#fff' : isHi ? colour.base : 'none'}
                strokeWidth={isHovered ? 1.5 : isHi ? 1.5 : 0}
              />
              {/* Invisible hover target centred on the dot */}
              <Rect
                x={p.x - 12} y={p.y - 12}
                width={24} height={24}
                fill="transparent"
                onPressIn={() => setDotHoverIdx(idx)}
                onPressOut={() => setDotHoverIdx(null)}
                {...(Platform.OS === 'web' ? {
                  onMouseEnter: () => setDotHoverIdx(idx),
                  onMouseLeave: () => setDotHoverIdx(null),
                } as any : {})}
              />
            </React.Fragment>
          );
        })}

        </AnimatedG>

        {/* Axis labels — abbreviated; expand on hover via invisible hit area */}
        {geometry.labelPoints.map((p, idx) => {
          const axis = AXES[idx];
          const isHovered = hoveredIdx === idx;
          const isHi = axis.key === highlightKey;
          const score = scores[axis.key] ?? 0;

          return (
            <SvgText
              key={`lbl-${idx}`}
              x={p.x}
              y={p.y}
              fontSize={isHovered ? 10 : 9}
              fontFamily={SVG_FONT_LABEL}
              fontWeight={SVG_WEIGHT_LABEL}
              fill={isHovered ? colour.glow : isHi ? neutral.text : neutral.textDim}
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              {isHovered ? `${axis.label.toUpperCase()} · ${score}%` : axis.label.toUpperCase()}
            </SvgText>
          );
        })}

        {/* Invisible hit-rect overlays for each axis label — handles hover/press */}
        {geometry.labelPoints.map((p, idx) => (
          <Rect
            key={`hit-${idx}`}
            x={p.x - 30}
            y={p.y - 10}
            width={60}
            height={20}
            fill="transparent"
            onPressIn={() => setHoveredIdx(idx)}
            onPressOut={() => setHoveredIdx(null)}
            {...(Platform.OS === 'web' ? {
              onMouseEnter: () => setHoveredIdx(idx),
              onMouseLeave: () => setHoveredIdx(null),
            } as any : {})}
          />
        ))}
      </Svg>

      {/* No-data overlay — shown when account has zero activity */}
      {noData && (
        <View style={styles.noDataOverlay} pointerEvents="none">
          <Text style={styles.noDataText}>No activity recorded</Text>
          <Text style={styles.noDataSub}>This account has not posted recently</Text>
        </View>
      )}

      {/* Axis-label hover tooltip: raw value when available, otherwise normalised score */}
      {!noData && hoveredIdx !== null && dotHoverIdx === null && (() => {
        const axis  = AXES[hoveredIdx];
        const score = scores[axis.key] ?? 0;
        const raw   = rawValues ? rawValues[axis.key] : null;
        return (
          <View style={styles.tooltip}>
            <Text style={[styles.tooltipLabel, { color: colour.glow }]}>
              {axis.label.toUpperCase()}
            </Text>
            {raw !== null && axis.key !== 'knoxFactor' ? (
              <Text style={[styles.tooltipScore, { color: colour.glow }]}>
                {axis.format(raw)}
              </Text>
            ) : (
              <Text style={styles.tooltipScore}>{score}<Text style={styles.tooltipPct}>%</Text></Text>
            )}
            <Text style={styles.tooltipDesc}>{axis.desc}</Text>
          </View>
        );
      })()}

      {/* Dot hover popup: raw underlying metric */}
      {!noData && dotHoverIdx !== null && (() => {
        const axis  = AXES[dotHoverIdx];
        const score = scores[axis.key] ?? 0;
        const raw   = rawValues ? rawValues[axis.key] : null;
        return (
          <View style={[styles.tooltip, styles.dotTooltip, { borderColor: colour.base }]}>
            <Text style={[styles.tooltipLabel, { color: colour.glow }]}>
              {axis.label.toUpperCase()}
            </Text>
            {raw !== null ? (
              <Text style={[styles.tooltipScore, { color: colour.glow }]}>
                {axis.format(raw)}
              </Text>
            ) : (
              <Text style={styles.tooltipScore}>
                {score}<Text style={styles.tooltipPct}>/ 100</Text>
              </Text>
            )}
            <Text style={styles.tooltipDesc}>{axis.desc}</Text>
          </View>
        );
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
  tooltip: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 2,
    backgroundColor: 'rgba(8, 8, 18, 0.9)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tooltipLabel: {
    ...type.caption,
    fontSize: 12,
    letterSpacing: 1.2,
  },
  tooltipScore: {
    fontFamily: font.mono,
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 24,
  },
  tooltipPct: {
    fontFamily: font.mono,
    fontSize: 12,
    fontWeight: '600',
    color: '#aaa',
  },
  tooltipDesc: {
    fontFamily: font.ui,
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
  dotTooltip: {
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: 'rgba(8, 8, 18, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 4,
  },
  noDataOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  noDataText: {
    fontFamily: font.mono,
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
  },
  noDataSub: {
    fontFamily: font.ui,
    fontSize: 12,
    color: 'rgba(255,255,255,0.2)',
    textAlign: 'center',
  },
});
