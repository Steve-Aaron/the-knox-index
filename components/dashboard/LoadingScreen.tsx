import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, {
  Circle, Line, Polygon, Defs,
  RadialGradient, Stop,
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { neutral, accent, party } from '@/theme/colors';
import { font } from '@/theme/typography';
import { DevLabel } from '@/components/primitives/DevLabel';

/**
 * LoadingScreen
 * -------------
 * Full-viewport overlay shown while BigQuery data is in flight.
 * Fades out smoothly once `visible` is set to false by the parent.
 *
 * Visual centrepiece: the 5-axis radar web from RadialScoreChart,
 * brought to life as an ambient loading animation.
 */

const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

const { width: SW, height: SH } = Dimensions.get('window');
const SIZE   = Math.min(SW * 0.55, 260);
const CX     = SIZE / 2;
const CY     = SIZE / 2;
const MAX_R  = SIZE / 2 - 24;
const N      = 5;  // axes
const RINGS  = [0.25, 0.5, 0.75, 1];

// Party colours cycled across the 5 axis tip dots
const TIP_COLOURS = [
  party.labour.glow,
  party.libdem.glow,
  party.green.glow,
  party.reform.glow,
  party.snp.glow,
] as const;

function polar(r: number, i: number) {
  const angle = ((360 / N) * i - 90) * (Math.PI / 180);
  return { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) };
}

// Pre-compute stable geometry
const axisEnds   = Array.from({ length: N }, (_, i) => polar(MAX_R, i));
const ringPoints = RINGS.map(f =>
  Array.from({ length: N }, (_, i) => polar(MAX_R * f, i))
);

/** Build the SVG polygon points string from a 0-1 fill factor per axis. */
function buildPoints(factors: number[]): string {
  return factors
    .map((f, i) => { const p = polar(MAX_R * f, i); return `${p.x},${p.y}`; })
    .join(' ');
}

interface Props {
  visible: boolean;   // false triggers the exit animation
}

export function LoadingScreen({ visible }: Props) {
  const [mounted, setMounted] = useState(true);

  // ── Screen opacity (exit animation) ────────────────────────────────────────
  const screenOpacity = useSharedValue(1);
  const screenStyle   = useAnimatedStyle(() => ({ opacity: screenOpacity.value }));

  useEffect(() => {
    if (!visible) {
      screenOpacity.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.ease) }, () => {
        runOnJS(setMounted)(false);
      });
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Radar rotation ─────────────────────────────────────────────────────────
  const rotation = useSharedValue(0);
  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 14000, easing: Easing.linear }),
      -1, false
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // ── Fill polygon — breathes between partial and fuller fill ─────────────────
  const fillFactor = useSharedValue(0.12);
  const animProps  = useAnimatedProps(() => {
    const f = fillFactor.value;
    // Each axis gets a slightly different radius for an organic look
    const offsets = [f, f * 0.82, f * 0.95, f * 0.75, f * 0.88];
    return { points: buildPoints(offsets) } as any;
  });

  useEffect(() => {
    fillFactor.value = withRepeat(
      withSequence(
        withTiming(0.72, { duration: 2800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.18, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Outer ring pulse ────────────────────────────────────────────────────────
  const ringScale = useSharedValue(1);
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
  }));

  useEffect(() => {
    ringScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        withTiming(1,    { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Progress bar ────────────────────────────────────────────────────────────
  const barProgress = useSharedValue(0);
  const barStyle    = useAnimatedStyle(() => ({
    width: `${barProgress.value * 100}%` as any,
  }));

  useEffect(() => {
    // Crawl quickly to 60%, then slowly creep toward 85% — indeterminate feel
    barProgress.value = withSequence(
      withTiming(0.6,  { duration: 1800, easing: Easing.out(Easing.quad) }),
      withTiming(0.85, { duration: 6000, easing: Easing.out(Easing.exp) }),
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null;

  return (
    <Animated.View style={[styles.root, screenStyle]} pointerEvents="none">
      <DevLabel name="LoadingScreen" />
      {/* Radial background glow */}
      <LinearGradient
        colors={['#0D0D24', '#07070B']}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, styles.glow]} />

      {/* ── Brand text ──────────────────────────────────────────────────────── */}
      <MotiView
        from={{ opacity: 0, translateY: -10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 500, delay: 100 }}
        style={styles.brandWrap}
      >
        <Text style={styles.kicker}>POLITICAL INTELLIGENCE</Text>
        <Text style={styles.brand}>THE KNOX INDEX</Text>
        <Text style={styles.sub}>DAILY BRIEF</Text>
      </MotiView>

      {/* ── Animated radar web ───────────────────────────────────────────────── */}
      <MotiView
        from={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'timing', duration: 700, delay: 300 }}
      >
        {/* Outer pulse ring wraps the whole SVG */}
        <Animated.View style={[{ width: SIZE, height: SIZE }, ringStyle]}>
          <Animated.View style={[{ width: SIZE, height: SIZE }, rotateStyle]}>
            <Svg width={SIZE} height={SIZE}>
              <Defs>
                <RadialGradient id="loadFill" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%"   stopColor={accent.indigo} stopOpacity={0.45} />
                  <Stop offset="100%" stopColor={accent.indigo} stopOpacity={0.08} />
                </RadialGradient>
              </Defs>

              {/* Concentric rings */}
              {RINGS.map((f, ri) => (
                <Circle
                  key={ri}
                  cx={CX} cy={CY} r={MAX_R * f}
                  stroke={ri === RINGS.length - 1 ? accent.indigo : neutral.stroke}
                  strokeWidth={ri === RINGS.length - 1 ? 1.5 : 1}
                  strokeOpacity={ri === RINGS.length - 1 ? 0.5 : 0.3}
                  fill="none"
                />
              ))}

              {/* Axis spokes */}
              {axisEnds.map((p, i) => (
                <Line
                  key={i}
                  x1={CX} y1={CY} x2={p.x} y2={p.y}
                  stroke={neutral.stroke}
                  strokeWidth={1}
                  strokeOpacity={0.4}
                />
              ))}

              {/* Animated fill polygon */}
              <AnimatedPolygon
                animatedProps={animProps}
                fill="url(#loadFill)"
                stroke={accent.indigo}
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeOpacity={0.8}
              />

              {/* Axis tip dots — party colours cycling */}
              {axisEnds.map((p, i) => (
                <Circle
                  key={`dot-${i}`}
                  cx={p.x} cy={p.y} r={3.5}
                  fill={TIP_COLOURS[i]}
                  opacity={0.9}
                />
              ))}

              {/* Centre dot */}
              <Circle cx={CX} cy={CY} r={4} fill={accent.indigo} opacity={0.9} />
            </Svg>
          </Animated.View>
        </Animated.View>
      </MotiView>

      {/* ── Status text ──────────────────────────────────────────────────────── */}
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: 'timing', duration: 500, delay: 600 }}
        style={styles.statusWrap}
      >
        <Text style={styles.statusText}>Connecting to live data</Text>
        <LoadingDots />
      </MotiView>

      {/* ── Progress bar ─────────────────────────────────────────────────────── */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, barStyle]} />
      </View>
    </Animated.View>
  );
}

/** Three dots that animate in sequence to suggest activity. */
function LoadingDots() {
  return (
    <View style={styles.dots}>
      {[0, 1, 2].map(i => (
        <MotiView
          key={i}
          from={{ opacity: 0.2, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            type: 'timing',
            duration: 400,
            delay: i * 180,
            loop: true,
            repeatReverse: true,
          }}
          style={[styles.dot, { backgroundColor: accent.indigo }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  glow: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Brand
  brandWrap: {
    alignItems: 'center',
    gap: 4,
  },
  kicker: {
    fontFamily: font.bold,
    fontSize: 12,
    color: neutral.textDim,
    letterSpacing: 3,
  },
  brand: {
    fontFamily: font.bold,
    fontSize: 40,
    color: neutral.text,
    letterSpacing: -1,
  },
  sub: {
    fontFamily: font.ui,
    fontSize: 16,
    color: accent.indigo,
    letterSpacing: 4,
  },

  // Status
  statusWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontFamily: font.ui,
    fontSize: 12,
    color: neutral.textDim,
    letterSpacing: 0.5,
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  // Progress bar
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  progressFill: {
    height: 2,
    backgroundColor: accent.indigo,
    opacity: 0.8,
  },
});
