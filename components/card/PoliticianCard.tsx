import React, { useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Platform,
  GestureResponderEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassSurface } from '@/components/primitives/GlassSurface';
import { CardSpine } from './CardSpine';
import { CardHeader } from './CardHeader';
import { RadialScoreChart } from './RadialScoreChart';
import { HeadlineStat } from './HeadlineStat';
import { StatGrid } from './StatGrid';
import { CardBack } from './CardBack';
import { LinkPill } from '@/components/primitives/LinkPill';
import { party, neutral } from '@/theme/colors';
import { spacing, radius, card } from '@/theme/spacing';
import { spring, tilt as tiltTokens } from '@/theme/motion';
import type { Politician, ScoreKey } from '@/data/types';

/**
 * PoliticianCard
 * ---------------
 * Composes atomic pieces into a single card. Owns the flip state and the
 * tilt gesture — nothing about party, scores, or totals lives here.
 */
interface Props {
  politician: Politician;
  headlineKey?: ScoreKey;
  rank?: number;
  isTop?: boolean;
}

const LABELS: Record<ScoreKey, string> = {
  views:       'Views',
  frequency:   'Post Frequency',
  engagement:  'Eng. %',
  followers:   'Followers',
  knoxFactor:  'Knox Factor',
};

export function PoliticianCard({
  politician,
  headlineKey = 'knoxFactor',
  rank,
  isTop,
}: Props) {
  const [flipped, setFlipped] = useState(false);

  // Tilt shared values (x/y rotation in degrees) and lift
  const rx = useSharedValue(0);
  const ry = useSharedValue(0);
  const lift = useSharedValue(0);

  // Flip shared value: 0 = front, 1 = back
  const flipProgress = useSharedValue(0);

  const onHoverMove = (e: GestureResponderEvent) => {
    // Only meaningful on web + mouse. Native gets reduced behaviour.
    // We approximate location relative to the card using locationX/Y when present.
    const anyEvt = e.nativeEvent as any;
    const x = anyEvt.locationX ?? 0;
    const y = anyEvt.locationY ?? 0;
    const w = card.width;
    const h = card.height;
    const nx = (x / w) * 2 - 1; // -1..1
    const ny = (y / h) * 2 - 1;
    // Rotate *around* the pointer; y-axis rotation follows x-position, x-axis rotation follows y-position.
    ry.value = withSpring(nx * tiltTokens.maxDeg, spring.tilt);
    rx.value = withSpring(-ny * tiltTokens.maxDeg, spring.tilt);
  };

  const onHoverIn = () => {
    cancelAnimation(lift);
    lift.value = withSpring(1, spring.snappy);
  };

  const onHoverOut = () => {
    rx.value = withSpring(0, spring.gentle);
    ry.value = withSpring(0, spring.gentle);
    lift.value = withSpring(0, spring.gentle);
  };

  const onFlip = () => {
    const next = flipped ? 0 : 1;
    setFlipped(!flipped);
    flipProgress.value = withTiming(next, {
      duration: 520,
      easing: Easing.out(Easing.cubic),
    });
  };

  const wrapStyle = useAnimatedStyle(() => {
    const translateY = interpolate(lift.value, [0, 1], [0, -8]);
    return {
      transform: [
        { perspective: tiltTokens.perspective },
        { translateY },
        { rotateX: `${rx.value}deg` },
        { rotateY: `${ry.value}deg` },
      ],
    };
  });

  const frontStyle = useAnimatedStyle(() => {
    const rotY = interpolate(flipProgress.value, [0, 1], [0, 180]);
    const opacity = flipProgress.value < 0.5 ? 1 : 0;
    return {
      transform: [{ perspective: tiltTokens.perspective }, { rotateY: `${rotY}deg` }],
      opacity,
    };
  });

  const backStyle = useAnimatedStyle(() => {
    const rotY = interpolate(flipProgress.value, [0, 1], [180, 360]);
    const opacity = flipProgress.value >= 0.5 ? 1 : 0;
    return {
      transform: [{ perspective: tiltTokens.perspective }, { rotateY: `${rotY}deg` }],
      opacity,
    };
  });

  const partyColour = party[politician.partyKey];
  const headlineValue = politician.scores[headlineKey];

  // Web-only hover events bridged into onMouseEnter / Leave / Move via Pressable
  const hoverProps =
    Platform.OS === 'web'
      ? {
          onHoverIn,
          onHoverOut,
        }
      : {};

  return (
    <Animated.View style={[styles.outer, wrapStyle]}>
      <Pressable
        onPress={onFlip}
        onPressIn={onHoverIn}
        onPressOut={onHoverOut}
        onResponderMove={onHoverMove}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        // @ts-ignore — web hover props not typed on RN Pressable
        {...hoverProps}
        // @ts-ignore — web mousemove
        onMouseMove={Platform.OS === 'web' ? onHoverMove : undefined}
        style={styles.pressable}
      >
        {/* FRONT */}
        <Animated.View style={[styles.face, frontStyle]}>
          <GlassSurface style={styles.surface} radius={radius.lg}>
            <CardSpine partyKey={politician.partyKey} />

            {/* Top-of-deck shimmer sweep for rank 1 */}
            {isTop ? (
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                <LinearGradient
                  colors={[
                    'rgba(255,255,255,0)',
                    `${partyColour.glow}33`,
                    'rgba(255,255,255,0)',
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              </View>
            ) : null}

            <View style={styles.frontContent}>
              <View style={styles.topRow}>
                <CardHeader
                  name={politician.name}
                  role={politician.role}
                  partyLabel={politician.partyLabel}
                  partyKey={politician.partyKey}
                  initials={politician.avatarInitials}
                />
                {typeof rank === 'number' ? (
                  <View style={[styles.rank, { borderColor: partyColour.base }]}>
                    <Animated.Text style={[styles.rankText, { color: partyColour.glow }]}>
                      #{rank}
                    </Animated.Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.linkRow}>
                <LinkPill
                  label={politician.handle}
                  url={`https://www.tiktok.com/${politician.handle}`}
                  accentColour={partyColour.glow}
                />
              </View>

              <RadialScoreChart
                scores={politician.scores}
                partyKey={politician.partyKey}
                highlightKey={headlineKey}
                size={200}
              />

              <HeadlineStat
                label={LABELS[headlineKey]}
                value={headlineValue}
                partyKey={politician.partyKey}
              />

              <StatGrid
                scores={politician.scores}
                partyKey={politician.partyKey}
                headlineKey={headlineKey}
              />
            </View>
          </GlassSurface>
        </Animated.View>

        {/* BACK */}
        <Animated.View style={[styles.face, styles.faceAbs, backStyle]}>
          <GlassSurface style={styles.surface} radius={radius.lg}>
            <CardSpine partyKey={politician.partyKey}/>
            <CardBack politician={politician} />
          </GlassSurface>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: card.width,
    height: card.height,
  },
  pressable: {
    width: '100%',
    height: '100%',
  },
  face: {
    width: '100%',
    height: '100%',
    // @ts-ignore
    backfaceVisibility: 'hidden',
  },
  faceAbs: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  surface: {
    width: '100%',
    height: '100%',
  },
  frontContent: {
    flex: 1,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    paddingLeft: spacing.lg + 6,
    paddingRight: spacing.lg,
    gap: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rank: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  rankText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  linkRow: {
    flexDirection: 'row',
    marginTop: -spacing.xs,
  },
});
