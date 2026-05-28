import React, { useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { MotiView } from 'moti';
import { party } from '@/theme/colors';
import type { Politician } from '@/data/types';

/**
 * HeroBackground
 * ---------------
 * Bubble map sitting behind the hero content. One circle per tracked
 * politician:
 *   - position is deterministic (Vogel's spiral / golden angle) so the
 *     constellation feels organic but never reshuffles between renders
 *   - radius is proportional to sqrt(views), giving area-accurate scaling
 *   - fill is the politician's party colour at 10% opacity, slightly
 *     darker than the hero background so it reads as ambient mood rather
 *     than data the user is meant to interact with
 *
 * The whole layer drifts very slowly with a MotiView loop — a gentle
 * rotation just enough to feel alive without distracting from the hero
 * copy. pointerEvents='none' so clicks pass through to the content.
 *
 * One job: a live, brand-coloured ambient backdrop that says
 * 'this is a data product about UK politicians on TikTok'.
 */

interface Props {
  politicians: Politician[];
}

const VIEWBOX_W = 1600;
const VIEWBOX_H = 900;
const CENTER_X  = VIEWBOX_W / 2;
const CENTER_Y  = VIEWBOX_H / 2;

// Vogel's spiral spacing. Larger value = bubbles further apart.
const SPIRAL_SPREAD = 78;
// Bubble size bounds (in viewBox units)
const MIN_R = 28;
const MAX_R = 180;

const GOLDEN_ANGLE_RAD = 137.508 * Math.PI / 180;

export function HeroBackground({ politicians }: Props) {
  const bubbles = useMemo(() => {
    if (politicians.length === 0) return [];

    // Pull a single view metric. Prefer range data; fall back to 24h totals.
    const counts = politicians.map(p =>
      Math.max(0, p.totals.viewsInRange || p.totals.views24h || 0)
    );
    const maxV = Math.max(1, ...counts);

    return politicians.map((p, i) => {
      // Vogel's spiral — radius grows as sqrt(i), angle turns by golden.
      const r     = Math.sqrt(i + 1) * SPIRAL_SPREAD;
      const theta = i * GOLDEN_ANGLE_RAD;
      const x     = CENTER_X + r * Math.cos(theta);
      const y     = CENTER_Y + r * Math.sin(theta);

      // Area-accurate sizing: bubble radius ~ sqrt(views) → area ~ views
      const viewRatio = counts[i] / maxV;
      const size      = MIN_R + Math.sqrt(viewRatio) * (MAX_R - MIN_R);

      const colour = party[p.partyKey];
      return {
        x,
        y,
        size,
        fill: colour.glow,
        id:   p.id,
      };
    });
  }, [politicians]);

  if (bubbles.length === 0) return null;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <MotiView
        from={{ rotate: '0deg' }}
        animate={{ rotate: '360deg' }}
        transition={{
          type:           'timing',
          duration:       180000,    // 3 min full rotation — barely perceptible
          loop:           true,
          repeatReverse:  false,
        }}
        style={styles.spin}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
          preserveAspectRatio="xMidYMid slice"
        >
          {bubbles.map(b => (
            <Circle
              key={b.id}
              cx={b.x}
              cy={b.y}
              r={b.size}
              fill={b.fill}
              // 10% opacity per the brief
              fillOpacity={0.1}
            />
          ))}
        </Svg>
      </MotiView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  spin: {
    width:  '100%',
    height: '100%',
    ...Platform.select({
      web: {
        // Bias the rotation origin so the spiral's centre sits roughly in
        // the upper-right quadrant of the visible hero — that's where the
        // form lives, so the densest part of the bubble map orbits it.
        transformOrigin: '70% 40%',
      } as any,
      default: {},
    }),
  },
});
