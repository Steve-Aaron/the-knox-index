import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { track } from '@/lib/analytics';
import Svg, { Polygon, Circle, Line, Text as SvgText, Rect, Defs, RadialGradient, Stop, G } from 'react-native-svg';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming, withDelay, Easing } from 'react-native-reanimated';
import { party, PartyKey, neutral } from '@/theme/colors';
import { font } from '@/theme/typography';
import type { TopTrumpScores, ScoreKey } from '@/data/types';
import type { TimeRange } from '@/components/dashboard/TimeRangePicker';

/**
 * SVG text fontFamily must be the CSS web name on web ('Montserrat') and the
 * PostScript asset name on native ('Montserrat_600SemiBold' etc.).
 * Expo Google Fonts registers both forms at load time via @expo-google-fonts.
 */
const SVG_FONT_LABEL  = Platform.select({ web: 'Figtree, sans-serif', default: 'Figtree_600SemiBold' });
const SVG_WEIGHT_LABEL: string = '600';
import { timing } from '@/theme/motion';
import { DevLabel } from '@/components/primitives/DevLabel';
import { InfoTipModal } from '@/components/primitives/InfoTip';

const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);
const AnimatedG       = Animated.createAnimatedComponent(G);

/**
 * RadialScoreChart
 * -----------------
 * 5-axis radar chart. Axes: views | frequency | engagement | followers | knox.
 * Click a score dot to open an InfoTipModal with the raw underlying metric.
 * The modal is the same centred-card pattern used by every other helper in
 * the app (Performance radar, Reach looks healthy for size, every DashCard).
 * Hover only changes the visual size of the dot to signal interactivity —
 * the data is revealed on click, not on hover.
 * Labels are static.
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
  /**
   * Selected time range. The frequency axis adapts to this:
   *   yesterday | week         → 'past 7 days'   (rawValues.frequency must be postsThisWeek)
   *   month     | year | lifetime → matches the range wording (rawValues.frequency = postsInRange)
   * Defaults to 'week' so existing call sites stay backward-compatible.
   */
  range?: TimeRange;
}

/**
 * Frequency axis wording per range. The label stays short ('Activity') because
 * it has to fit at the rim of the radar; the desc/format strings are the
 * verbose copy shown in the dot-hover tooltip.
 */
function frequencyAxis(range: TimeRange): { desc: string; format: (v: number) => string } {
  switch (range) {
    case 'yesterday':
    case 'week':
      return { desc: 'Posts in the past 7 days',   format: v => `${v} posts in past 7 days` };
    case 'month':
      return { desc: 'Posts this month',           format: v => `${v} posts this month`     };
    case 'year':
      return { desc: 'Posts this year',            format: v => `${v} posts this year`      };
    case 'lifetime':
      return { desc: 'Posts (lifetime)',           format: v => `${v} posts (lifetime)`     };
  }
}

function buildAxes(range: TimeRange): { key: ScoreKey; label: string; desc: string; format: (v: number) => string }[] {
  const freq = frequencyAxis(range);
  return [
    { key: 'views',      label: 'Views',     desc: 'Avg post views',                              format: v => compact(v) + ' avg views' },
    { key: 'frequency',  label: 'Activity',  desc: freq.desc,                                     format: freq.format },
    { key: 'engagement', label: 'Eng. %',    desc: 'Likes + comments + saves + shares per view',  format: v => v.toFixed(2) + '% eng. rate' },
    { key: 'followers',  label: 'Followers', desc: 'Total followers',                             format: v => compact(v) + ' followers' },
    { key: 'knoxFactor', label: 'Knox',      desc: 'Average of all four axes',                    format: v => `${v} / 100` },
  ];
}

function compact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(Math.round(n));
}

function polar(cx: number, cy: number, radius: number, angleDeg: number) {
  const a = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
}

export function RadialScoreChart({ scores, partyKey, size = 440, highlightKey, rawValues, range = 'week' }: Props) {
  const colour   = party[partyKey];
  const cx       = size / 2;
  const cy       = size / 2;
  const maxR     = size / 2 - 30;

  // AXES depends on the active range — only the frequency axis text varies,
  // but rebuilding the whole array keeps the indexing consistent and lets
  // useMemo dependencies stay clean.
  const AXES = useMemo(() => buildAxes(range), [range]);
  const noData   = AXES.every(a => (scores[a.key] ?? 0) === 0);

  // Two pieces of dot state:
  //   dotHoverIdx  — purely cosmetic; enlarges the dot on hover so users know
  //                  it's a clickable target. No data is revealed here.
  //   activeDotIdx — drives the InfoTipModal. Set on click, cleared on close.
  const [dotHoverIdx,  setDotHoverIdx]  = useState<number | null>(null);
  const [activeDotIdx, setActiveDotIdx] = useState<number | null>(null);

  // Fire radial_chart_hovered once per mount when the user first interacts.
  // Counts both hover (signal of interest) and click (real engagement).
  const chartHoverFiredRef = useRef(false);
  useEffect(() => {
    if (chartHoverFiredRef.current) return;
    if (dotHoverIdx !== null || activeDotIdx !== null) {
      chartHoverFiredRef.current = true;
      const idx = activeDotIdx ?? dotHoverIdx;
      track('radial_chart_hovered', {
        axis_key:  idx !== null ? AXES[idx]?.key ?? null : null,
        party_key: partyKey,
      });
    }
  }, [dotHoverIdx, activeDotIdx, partyKey]);

  const openDot = (idx: number) => {
    setActiveDotIdx(idx);
    // Mirror the InfoTip analytics so dot clicks and ? clicks count together.
    track('helper_clicked', {
      topic: `radial_dot_${AXES[idx]?.key ?? 'unknown'}`,
    });
  };
  const closeDot = () => setActiveDotIdx(null);

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
  // AXES only changes when `range` changes; including it keeps the lint happy
  // and guarantees the geometry recomputes if the axis count ever changes.
  }, [cx, cy, maxR, scores, AXES]);

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

        {/* Axis end dots — pop in near the end of the polygon animation.
            Hover enlarges the dot to signal it's clickable; click opens the
            shared InfoTipModal with the raw value. */}
        <AnimatedG animatedProps={dotGroupProps}>
        {geometry.valuePoints.map((p, idx) => {
          const isHi      = AXES[idx].key === highlightKey;
          const isHovered = dotHoverIdx === idx || activeDotIdx === idx;
          return (
            <React.Fragment key={`dot-group-${idx}`}>
              <Circle
                cx={p.x} cy={p.y}
                r={isHovered ? 6 : isHi ? 4 : 2.5}
                fill={isHovered ? colour.glow : isHi ? colour.glow : colour.base}
                stroke={isHovered ? '#fff' : isHi ? colour.base : 'none'}
                strokeWidth={isHovered ? 1.5 : isHi ? 1.5 : 0}
              />
              {/* Invisible click target centred on the dot */}
              <Rect
                x={p.x - 12} y={p.y - 12}
                width={24} height={24}
                fill="transparent"
                onPress={() => openDot(idx)}
                {...(Platform.OS === 'web' ? {
                  onMouseEnter: () => setDotHoverIdx(idx),
                  onMouseLeave: () => setDotHoverIdx(null),
                  style: { cursor: 'pointer' },
                } as any : {})}
              />
            </React.Fragment>
          );
        })}

        </AnimatedG>

        {/* Axis labels — static, no hover effect. The score dots carry the
            hover affordance instead, so the labels stay calm and uncluttered. */}
        {geometry.labelPoints.map((p, idx) => {
          const axis = AXES[idx];
          const isHi = axis.key === highlightKey;

          return (
            <SvgText
              key={`lbl-${idx}`}
              x={p.x}
              y={p.y}
              fontSize={9}
              fontFamily={SVG_FONT_LABEL}
              fontWeight={SVG_WEIGHT_LABEL}
              fill={isHi ? neutral.text : neutral.textDim}
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              {axis.label.toUpperCase()}
            </SvgText>
          );
        })}
      </Svg>

      {/* No-data overlay — shown when account has zero activity */}
      {noData && (
        <View style={styles.noDataOverlay} pointerEvents="none">
          <Text style={styles.noDataText}>No activity recorded</Text>
          <Text style={styles.noDataSub}>This account has not posted recently</Text>
        </View>
      )}

      {/* Dot click popup — the same InfoTipModal pattern used by every other
          helper in the app. Open on dot click, dismiss on backdrop / X click.
          Body shows the raw underlying metric and the axis description. */}
      <InfoTipModal
        visible={!noData && activeDotIdx !== null}
        onClose={closeDot}
        title={activeDotIdx !== null ? AXES[activeDotIdx].label : 'What does this mean?'}
        width={300}
      >
        {activeDotIdx !== null && (() => {
          const axis  = AXES[activeDotIdx];
          const score = scores[axis.key] ?? 0;
          const raw   = rawValues ? rawValues[axis.key] : null;
          return (
            <>
              <Text style={[styles.modalValue, { color: colour.glow }]}>
                {raw !== null
                  ? axis.format(raw)
                  : `${score} / 100`}
              </Text>
              <Text style={styles.modalDesc}>{axis.desc}</Text>
            </>
          );
        })()}
      </InfoTipModal>
    </View>
  );
}

const styles = StyleSheet.create({
  // Modal body — rendered inside the shared InfoTipModal card. Two lines:
  // the large coloured raw value, and a smaller subdued description.
  modalValue: {
    fontFamily: font.mono,
    fontSize:   24,
    fontWeight: '700',
    color:      '#fff',
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  modalDesc: {
    fontFamily: font.ui,
    fontSize:   14,
    color:      neutral.textMid,
    lineHeight: 18,
  },

  // No-data overlay — shown when the account has zero activity on every axis.
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
