import React from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { MotiView } from 'moti';
import { KeyFindingsBar } from '@/components/dashboard/KeyFindingsBar';
import { UkMap } from '@/components/dashboard/UkMap';
import { DevLabel } from '@/components/primitives/DevLabel';
import { neutral, knox, glass } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { font } from '@/theme/typography';
import { breakpoints } from '@/theme/breakpoints';
import type { Politician } from '@/data/types';
import type { TimeRange } from '@/components/dashboard/TimeRangePicker';

/**
 * HomeHero — editorial layout with staggered animation
 * -----------------------------------------------------
 * Structure:
 *
 *   ┌─────────────────────────────────────────────────────┐
 *   │  THE                                                │
 *   │  KNOX           ┌────────────────────┐              │
 *   │  INDEX          │  IMAGE PLACEHOLDER │              │
 *   │  ───────        │                    │              │
 *   │  Learn how UK   └────────────────────┘              │
 *   │  politicians …                                      │
 *   │                                                     │
 *   │  ── KeyFindings (5 dashboard numbers, full width) ──│
 *   └─────────────────────────────────────────────────────┘
 *
 *  ▸ Headline + tagline live in the LEFT column. Image in the RIGHT.
 *  ▸ KeyFindingsBar docks to the bottom of the hero so the five
 *    Davos-style numbers sit above the fold without scroll.
 *  ▸ Each headline word, then the tagline, then the image, fade and
 *    slide in on mount with a small stagger — the page comes alive in
 *    the first ~600ms.
 *
 * One job: a single editorial statement + the headline figures, both
 * visible before any user interaction.
 */

interface Props {
  politicians: Politician[];
  range:       TimeRange;
  /**
   * When false, every entrance animation stays in its 'from' state. The
   * parent flips this true once the LoadingScreen has finished its exit
   * fade — otherwise the headline 'folds in' under the loading overlay
   * and the user never sees the animation.
   *
   * Defaults to true so the component still animates when used outside
   * the LoadingScreen-gated flow (e.g. Storybook, tests, /preview).
   */
  ready?:      boolean;
}

const COPY = {
  headlineLines: ['THE', 'KNOX', 'INDEX'] as const,
  tagline:       'Learn how UK politicians use TikTok, in real time. Get insights live on our dashboard below, and in your inbox every morning.',
};

const STACK_BREAKPOINT = breakpoints.tablet;

// Animation timings — staggered so the hero reveals top-to-bottom
const HEADLINE_BASE_DELAY = 100;
const HEADLINE_STAGGER    = 110;
const TAGLINE_DELAY       = HEADLINE_BASE_DELAY + COPY.headlineLines.length * HEADLINE_STAGGER + 80;
const IMAGE_DELAY         = 240;

export function HomeHero({ politicians, range, ready = true }: Props) {
  const { width, height } = useWindowDimensions();
  const isStacked = width < STACK_BREAKPOINT;
  const isWeb     = Platform.OS === 'web';

  // Animation target values. Headlines/tagline/image all start in the
  // 'from' state and flip to their final 'to' values once `ready` is true.
  // Defining them as objects up here keeps the JSX tidy.
  const FROM_HEADLINE = { opacity: 0, rotateX: '-95deg' as const };
  const TO_HEADLINE   = { opacity: 1, rotateX: '0deg'   as const };
  const FROM_TAGLINE  = { opacity: 0, rotateX: '60deg'  as const };
  const TO_TAGLINE    = { opacity: 1, rotateX: '0deg'   as const };
  const FROM_IMAGE    = { opacity: 0, scale: 0.96 };
  const TO_IMAGE      = { opacity: 1, scale: 1 };
  const FROM_STATS    = { opacity: 0, translateY: 12 };
  const TO_STATS      = { opacity: 1, translateY: 0 };

  // Headline scale — sized so 3 stacked lines + tagline + KeyFindings all
  // fit within ~100vh. Each line is short ('THE', 'KNOX', 'INDEX') so
  // viewport-height-based sizing never overflows the column.
  const headlineStyle: any = isWeb
    ? {
        fontSize:   'clamp(48px, 17vh, 220px)' as any,
        lineHeight: '0.9em' as any,
      }
    : {
        fontSize:   Math.min(160, height * 0.17),
        lineHeight: Math.min(150, height * 0.15),
      };

  return (
    <View
      accessibilityRole={'region' as unknown as 'summary'}
      accessibilityLabel="Hero"
      style={[
        styles.section,
        isWeb
          // 92vh leaves a small breathing band at the bottom of the hero
          // before the next section starts — gives the eye a moment to
          // land rather than colliding straight into the dashboard.
          ? ({ width: '100vw', minHeight: '92vh' } as any)
          : { minHeight: height * 0.92, width },
      ]}
    >
      <DevLabel name="HomeHero" />

      {/* TOP — headline + tagline (left) | image (right) */}
      <View style={[styles.topRow, isStacked && styles.topRowStacked]}>
        {/* LEFT — headline, then tagline.
            perspective is applied to the column on web so child rotateX
            transforms render with depth (the 'fold' feel). */}
        <View style={[styles.leftCol, isWeb && webFoldPerspective]}>
          {/* Each headline line folds in: pivots from the top edge from
              -95° (folded back) to 0° (upright). Staggered between lines
              so each word lands in sequence. */}
          {COPY.headlineLines.map((word, i) => (
            <MotiView
              key={i}
              from={FROM_HEADLINE}
              animate={ready ? TO_HEADLINE : FROM_HEADLINE}
              transition={{
                type:      'spring',
                damping:   16,
                stiffness: 140,
                mass:      0.85,
                delay:     HEADLINE_BASE_DELAY + i * HEADLINE_STAGGER,
              }}
              style={isWeb ? webFoldOriginTop : undefined}
            >
              <Text
                style={[styles.headline, headlineStyle, isWeb && webNoWrap]}
                numberOfLines={1}
                adjustsFontSizeToFit={!isWeb}
              >
                {word}
              </Text>
            </MotiView>
          ))}

          {/* Tagline folds in from below — pivots from the bottom edge
              from +60° (folded forward, tilted down) to 0° (upright). A
              gentler angle so it doesn't compete with the headline. */}
          <MotiView
            from={FROM_TAGLINE}
            animate={ready ? TO_TAGLINE : FROM_TAGLINE}
            transition={{
              type:      'spring',
              damping:   18,
              stiffness: 130,
              mass:      0.9,
              delay:     TAGLINE_DELAY,
            }}
            style={[styles.taglineWrap, isWeb && webFoldOriginBottom]}
          >
            <Text style={[styles.tagline, isStacked && styles.taglineStacked]}>
              {COPY.tagline}
            </Text>
          </MotiView>
        </View>

        {/* RIGHT — animated UK map with looping marker reveals */}
        <View style={[styles.rightCol, isStacked && styles.rightColStacked]}>
          <MotiView
            from={FROM_IMAGE}
            animate={ready ? TO_IMAGE : FROM_IMAGE}
            transition={{ type: 'timing', duration: 600, delay: IMAGE_DELAY }}
            style={styles.mapWrap}
          >
            <UkMap politicians={politicians} />
          </MotiView>
        </View>
      </View>

      {/* BOTTOM — dashboard numbers strip (Davos-style, 5 scorecards) */}
      <MotiView
        from={FROM_STATS}
        animate={ready ? TO_STATS : FROM_STATS}
        transition={{ type: 'timing', duration: 600, delay: TAGLINE_DELAY + 140 }}
        style={styles.statsStrip}
      >
        <KeyFindingsBar politicians={politicians} range={range} />
      </MotiView>
    </View>
  );
}

// ── Web-only helpers ──────────────────────────────────────────────────────────
//
// Style objects pre-built once at module scope. RN-Web passes unknown CSS
// keys through to the DOM, so `perspective` and `transformOrigin` work as
// expected. On native these are no-ops (we apply them via Platform check).
const webNoWrap:         any = Platform.OS === 'web' ? { whiteSpace: 'nowrap' } : {};
// `perspective` on the parent gives 3D rotateX transforms real depth.
const webFoldPerspective: any = Platform.OS === 'web' ? { perspective: 1400 } : {};
// Pivot from the top edge — used for the headline so it folds DOWN from above.
const webFoldOriginTop:    any = Platform.OS === 'web' ? { transformOrigin: 'top center' }    : {};
// Pivot from the bottom edge — used for the tagline so it folds UP from below.
const webFoldOriginBottom: any = Platform.OS === 'web' ? { transformOrigin: 'bottom center' } : {};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Section — column, top content + bottom stats. justifyContent: 'space-between'
  // pushes the top row up and pins the stats strip to the foot.
  section: {
    width:             '100%',
    flexDirection:     'column',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop:        spacing.lg,
    paddingBottom:     spacing.lg,
    overflow:          'hidden',
  },

  // ── Top row — headline+tagline (left) | image (right) ─────────────────────
  topRow: {
    flexDirection: 'row',
    alignItems:    'stretch',
    gap:           spacing.xxl,
    width:         '100%',
    flex:          1,
    maxWidth:      1600,
    alignSelf:     'center',
  },
  topRowStacked: {
    flexDirection: 'column',
    gap:           spacing.lg,
  },

  // LEFT — headline stacked, tagline underneath
  leftCol: {
    flex:           1.4,
    flexDirection:  'column',
    justifyContent: 'center',
    gap:            0,
  },
  headline: {
    fontFamily:    font.bold,
    fontWeight:    '900',
    color:         knox.primaryPink,
    letterSpacing: -4,
    textTransform: 'uppercase',
    margin:        0,
    padding:       0,
  },
  taglineWrap: {
    marginTop: spacing.lg,
    maxWidth:  640,
  },
  tagline: {
    fontFamily: font.ui,
    fontWeight: '400',
    fontSize:   18,
    lineHeight: 26,
    color:      neutral.textMid,
  },
  taglineStacked: {
    fontSize:   16,
    lineHeight: 24,
  },

  // RIGHT — animated UK map
  rightCol: {
    flex:          1,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  rightColStacked: {
    width: '100%',
  },
  mapWrap: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    minHeight:      280,
  },

  // ── Bottom — dashboard numbers strip ──────────────────────────────────────
  statsStrip: {
    width:    '100%',
    maxWidth: 1600,
    alignSelf: 'center',
    marginTop: spacing.lg,
  },
});
