import React, { useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Platform, Pressable, Linking, useWindowDimensions } from 'react-native';
import { MotiView } from 'moti';
import { Easing } from 'react-native-reanimated';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { DevLabel } from '@/components/primitives/DevLabel';
import { knox, neutral, glass, accent, party, colourFor } from '@/theme/colors';
import { font } from '@/theme/typography';
import { radius } from '@/theme/spacing';
import { breakpoints } from '@/theme/breakpoints';
import { formatters } from '@/components/primitives/CountUp';
import { track } from '@/lib/analytics';
import type { RecentPost } from '@/data/types';
import type { GroupKey } from '@/theme/colors';
import type { MarkerAnchor } from '@/hooks/useMarkerRotation';


// Slowed entrance to match the longer overall cadence — dot lands, stem grows,
// card pops in. Each step is roughly twice the previous gap so the sequence
// reads as deliberate rather than a snap-on appearance.
const DOT_DELAY  = 0;
const LINE_DELAY = 400;
const CARD_DELAY = 700;

// 1.5x the original footprint — see brief. Stem grows proportionally.
const STEM_HEIGHT    = 96;
const CARD_WIDTH     = 165;
const CARD_HEIGHT    = 225;
const CAPTION_HEIGHT = 18;   // 'Picked up in …' italic label above the dot
const DOT_SIZE       = 10;
/** A press that travels further than this is a drag, not a click (px). */
const CLICK_SLOP     = 6;
/** Mobile shrinks the whole marker. */
const MOBILE_SCALE   = 0.78;

/**
 * The marker's footprint, so a parent can work out whether a card will fall
 * off its container and nudge it back before it does. Same numbers the
 * component lays itself out with.
 */
export const MARKER_METRICS = {
  cardWidth:     CARD_WIDTH,
  cardHeight:    CARD_HEIGHT,
  captionHeight: CAPTION_HEIGHT,
  dotSize:       DOT_SIZE,
  mobileScale:   MOBILE_SCALE,
} as const;

/** Total vertical space a marker needs above (or below) its dot. */
export function markerExtent(stemHeight: number, mobile: boolean): number {
  const scale = mobile ? MOBILE_SCALE : 1;
  return stemHeight + CARD_HEIGHT * scale + CAPTION_HEIGHT + DOT_SIZE / 2;
}

interface Props {
  /** Where the pin sits, in the host map's viewBox units. */
  location: MarkerAnchor;
  post:     RecentPost;
  groupKey: GroupKey;
  /** TikTok handle of the account that posted the video, e.g. 'uklabour'.
   *  The leading '@' is added at render time so the input can be either form. */
  handle:   string;
  /** Option E (prepared, not yet active) — render a 'Trending · {city}' pill
   *  at the top-left of the card. Flip this true from UkMap to enable. */
  showTrendingPill?: boolean;
  /** Multiplier on the connector stem length. 1 = full (default, England /
   *  Wales). 0.5 = half-length, used by Scottish locations to stop the card
   *  flying off the top of the viewBox. Anything outside (0, 2] gets clamped
   *  so a bad value can't break the layout. */
  stemMultiplier?: number;
  /** Absolute stem length in px, overriding stemMultiplier. The globe passes
   *  20 — the house connector length used across the dashboards — so the pin
   *  stays tight to the country under it. Clamped to 0–200. */
  stemHeight?: number;
  /**
   * Horizontal nudge, in px, applied to the CARD and its caption only — the
   * dot and stem stay on the anchor. The globe uses it to keep a card that is
   * drifting towards the edge fully on screen while its pin carries on to the
   * limb. Positive moves the card right.
   */
  cardOffsetX?: number;
  /**
   * Which side of the dot the card sits on. 'above' is the default; a parent
   * flips it to 'below' when there is not enough room overhead, which is what
   * stops a card being cropped by the top of the container.
   */
  placement?: 'above' | 'below';
  /** Called once when the card has fully entered — parent uses this for cleanup timing if it wants. */
  onReady?: () => void;
}

export function MapMarker({
  location, post, groupKey, handle,
  showTrendingPill = false, stemMultiplier = 1, stemHeight: stemHeightOverride,
  cardOffsetX = 0, placement = 'above', onReady,
}: Props) {
  // Per-instance stem height. The wrap translateY and the stem's animated
  // `height` both derive from this so the dot, stem and card stay in sync.
  // Mobile: shrink the marker — shorter connector line + smaller video preview.
  const { width: viewportWidth } = useWindowDimensions();
  const mobile = viewportWidth < breakpoints.tablet;
  const scale  = mobile ? MOBILE_SCALE : 1;

  const safeMultiplier = Math.max(0.1, Math.min(2, stemMultiplier));
  // An explicit height wins over the multiplier, and is NOT scaled down on
  // mobile: 20px is 20px, which is the point of the house style.
  const stemHeight     = stemHeightOverride !== undefined
    ? Math.round(Math.max(0, Math.min(200, stemHeightOverride)))
    : Math.round(STEM_HEIGHT * safeMultiplier * scale);
  const cardW          = Math.round(CARD_WIDTH * scale);
  const cardH          = Math.round(CARD_HEIGHT * scale);
  // Above: the column grows upward from the dot, so the wrap is pulled up by
  // its whole height. Below: the dot is the first thing rendered (the column
  // is reversed), so only the dot's own half-height is offset.
  const isBelow     = placement === 'below';
  const wrapOffsetY = isBelow
    ? -(DOT_SIZE / 2)
    : -(stemHeight + cardH + CAPTION_HEIGHT + DOT_SIZE / 2);
  const colour = colourFor(groupKey);

  // Normalise the handle so the label is always exactly one '@' followed by
  // the handle text — defensive against upstream values that already include it.
  const displayHandle = `@${(handle ?? '').replace(/^@/, '')}`;

  // Engagement rate = (likes + comments + shares + saves) / views * 100.
  // Falls back to 0 for zero-view posts so we never divide by zero.
  const engRate = post.views > 0
    ? ((post.likes + post.comments + post.shares + (post.saves ?? 0)) / post.views) * 100
    : 0;

  // Open TikTok in a new tab / app on press. We track the event so the loop's
  // discovery value is measurable (which posts pull the eye, which don't).
  const handleOpenTiktok = useCallback((event?: any) => {
    if (!post.postUrl) return;

    // A press that moved is a drag, not a click. Without this, letting go of a
    // spin over a card opens TikTok.
    const start = pressStartRef.current;
    const end   = event?.nativeEvent;
    if (start && end && typeof end.pageX === 'number' && typeof end.pageY === 'number') {
      const travelled = Math.hypot(end.pageX - start.x, end.pageY - start.y);
      if (travelled > CLICK_SLOP) return;
    }
    track('hero_map_marker_clicked', {
      location:  location.id,
      post_id:   post.postId,
      views:     post.views,
    });
    Linking.openURL(post.postUrl);
  }, [post.postUrl, post.postId, post.views, location.id]);

  /** Where the press began, so onPress can tell a click from a drag. */
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const handlePressIn = useCallback((event: any) => {
    const e = event?.nativeEvent;
    pressStartRef.current = typeof e?.pageX === 'number' ? { x: e.pageX, y: e.pageY } : null;
  }, []);

  useEffect(() => {
    const t = setTimeout(() => onReady?.(), CARD_DELAY + 250);
    return () => clearTimeout(t);
  }, [onReady]);

  return (
    <View
      // box-none: the wrap itself doesn't intercept clicks (so empty space
      // around the stem is transparent to clicks below) but its children CAN
      // receive them — the Pressable card listens for taps.
      pointerEvents="box-none"
      // width must match cardW (the scaled width) so the centred dot lands
      // exactly on the anchor. Using the unscaled styles.wrap width while
      // offsetting by the scaled cardW/2 pushed the pin right on mobile.
      style={[
        styles.wrap,
        isBelow && styles.wrapBelow,
        { width: cardW, transform: [{ translateX: -cardW / 2 }, { translateY: wrapOffsetY }] },
      ]}
      accessibilityLabel={`Marker for ${displayHandle} pinned near ${location.name}`}
    >
      <DevLabel name="MapMarker" />

      {/* Video card — sits above the stem. Pressable opens TikTok. */}
      <MotiView
        from={{ opacity: 0, translateY: 8, scale: 0.85 }}
        animate={{ opacity: 1, translateY: 0, scale: 1 }}
        exit={{ opacity: 0, translateY: 8, scale: 0.9 }}
        transition={{
          type: 'spring',
          damping: 18,
          stiffness: 180,
          delay: CARD_DELAY,
        }}
        style={[
          styles.card,
          { width: cardW, height: cardH, borderColor: colour.base, transform: [{ translateX: cardOffsetX }] },
        ]}
      >
        <Pressable
          onPress={handleOpenTiktok}
          onPressIn={handlePressIn}
          accessibilityRole="link"
          accessibilityLabel={`Open TikTok video from ${displayHandle}`}
          style={({ pressed, hovered }: any) => [
            styles.cardPressable,
            hovered && styles.cardPressableHover,
            pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
          ]}
        >
          <VideoCard post={post} accentColor={colour.glow} />

          {/* Option E (prepared, gated) — Trending pill at top-left of the card.
              Flip showTrendingPill={true} from UkMap to enable. */}
          {showTrendingPill && (
            <MotiView
              from={{ opacity: 0, translateY: -4 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 300, delay: CARD_DELAY + 200 }}
              style={[styles.trendingPill, { borderColor: colour.base + '99' }]}
            >
              <FontAwesome6 name="fire" size={9} color={colour.glow} solid />
              <Text style={[styles.trendingPillText, { color: colour.glow }]} numberOfLines={1}>
                Trending · {location.name}
              </Text>
            </MotiView>
          )}
          <View style={styles.cardMeta}>
            <View style={styles.cardMetaTopRow}>
              <Text style={styles.cardHandle} numberOfLines={1}>
                {displayHandle}
              </Text>
              <View style={[styles.partyDot, { backgroundColor: colour.base }]} />
            </View>
            <View style={styles.cardStatsRow}>
              <Text style={[styles.cardStat, { color: colour.glow }]} numberOfLines={1}>
                {formatters.compact(post.views)}
              </Text>
              <Text style={styles.cardStatLabel}>views</Text>
              <Text style={styles.cardStatSep}>·</Text>
              <Text style={[styles.cardStat, { color: colour.glow }]} numberOfLines={1}>
                {engRate.toFixed(1)}%
              </Text>
              <Text style={styles.cardStatLabel}>eng</Text>
            </View>
          </View>
        </Pressable>
      </MotiView>

      {/* Stem — grows up from the dot to the card. Length is per-instance
          (see stemHeight above): full length for England/Wales, half for
          Scottish locations so the card stays inside the viewBox. */}
      <MotiView
        from={{ height: 0, opacity: 0 }}
        animate={{ height: stemHeight, opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{
          type: 'timing',
          duration: 450,
          easing: Easing.out(Easing.cubic),
          delay: LINE_DELAY,
        }}
        style={[styles.stem, { backgroundColor: colour.base }]}
      />

      {/* Option C — 'Watched in {city}' italic caption. Sits just above the
          dot, fades in with the stem. Pairs with the existing pulse ring as
          the implied 'radar sweep'. */}
      <MotiView
        from={{ opacity: 0, translateY: 4 }}
        animate={{ opacity: 1, translateY: 0 }}
        exit={{ opacity: 0, translateY: 4 }}
        transition={{ type: 'timing', duration: 320, delay: LINE_DELAY + 120 }}
        style={[styles.captionWrap, { transform: [{ translateX: cardOffsetX }] }]}
      >
        <Text style={styles.caption} numberOfLines={1}>
          Watched in <Text style={[styles.captionLoc, { color: colour.glow }]}>{location.name}</Text>
        </Text>
      </MotiView>

      {/* Anchor dot with pulse. */}
      <View style={styles.dotAnchor}>
        <MotiView
          from={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{
            type: 'spring',
            damping: 12,
            stiffness: 320,
            delay: DOT_DELAY,
          }}
          style={[styles.dot, { backgroundColor: colour.base, borderColor: colour.glow }]}
        />
        {/* Pulse ring — subtle outward ripple. */}
        <MotiView
          from={{ scale: 0.6, opacity: 0.6 }}
          animate={{ scale: 2.2, opacity: 0 }}
          transition={{
            type: 'timing',
            duration: 1400,
            loop: true,
            easing: Easing.out(Easing.quad),
            delay: DOT_DELAY + 200,
          }}
          style={[styles.pulse, { borderColor: colour.base }]}
        />
      </View>
    </View>
  );
}

// ── Video card body ───────────────────────────────────────────────────────────

interface VideoCardProps {
  post:        RecentPost;
  accentColor: string;
}

function VideoCard({ post, accentColor }: VideoCardProps) {
  // Web: real autoplay-muted video. Native: cover image + play icon (no
  // expo-av dep added here to keep the touch light; see follow-ups).
  if (Platform.OS === 'web' && post.videoMp4) {
    return (
      <video
        src={post.videoMp4}
        poster={post.coverJpeg}
        autoPlay
        muted
        loop
        playsInline
        // The browser's own drag-and-drop on a media element is what produces
        // the ghost image and the ::highlight artefacts while spinning.
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          background: '#0a0a14',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitUserDrag: 'none',
          pointerEvents: 'none',
        } as any}
      />
    );
  }

  return (
    <View style={[styles.fallback, { backgroundColor: '#0a0a14' }]}>
      <Text style={[styles.fallbackIcon, { color: accentColor }]}>▶</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // The wrap is positioned by the parent — we anchor children FROM the bottom
  // upwards so the dot sits at (0,0) and the card floats above the stem.
  // The transform is applied inline at the call site so it can include the
  // per-instance stem height (full for England/Wales, half for Scotland).
  wrap: {
    position:   'absolute',
    alignItems: 'center',
    width:      CARD_WIDTH,
  },
  // Reversed column: the same children render dot-first, so the card hangs
  // below the anchor instead of above it.
  wrapBelow: {
    flexDirection: 'column-reverse',
  },
  card: {
    ...Platform.select({
      web: {
        userSelect:       'none',
        WebkitUserSelect: 'none',
        WebkitUserDrag:   'none',
      } as any,
      default: {},
    }),
    width:        CARD_WIDTH,
    height:       CARD_HEIGHT,
    borderWidth:  1.5,
    borderRadius: radius.md,
    overflow:     'hidden',
    backgroundColor: glass.card,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
      } as any,
      default: {
        shadowColor:   '#000',
        shadowOpacity: 0.45,
        shadowRadius:  16,
        shadowOffset:  { width: 0, height: 8 },
      },
    }),
  },
  // Pressable sits inside the card and fills it edge-to-edge.
  // Hover lifts the card slightly via transform — gives the 'this is clickable'
  // tactile sizzle without disrupting the entrance animation.
  cardPressable: {
    width:           '100%',
    height:          '100%',
    ...Platform.select({
      web: {
        cursor:             'pointer',
        transitionProperty: 'transform, opacity',
        transitionDuration: '160ms',
      } as any,
      default: {},
    }),
  },
  cardPressableHover: {
    ...Platform.select({
      web: {
        transform: [{ translateY: -2 }, { scale: 1.02 }] as any,
      } as any,
      default: {},
    }),
  },
  // Footer — two rows: location + party dot on top, stats below.
  cardMeta: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    paddingHorizontal: 8,
    paddingVertical:   6,
    backgroundColor:   'rgba(0,0,0,0.72)',
    gap:               3,
  },
  cardMetaTopRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
  },
  // Handle label — '@handle'. Lower letter-spacing than the old all-caps
  // location name since '@uklabour' shouldn't read like a kicker.
  cardHandle: {
    fontFamily:    font.bold,
    fontSize:      12,
    color:         neutral.text,
    letterSpacing: 0.2,
    flex:          1,
  },
  partyDot: {
    width:        6,
    height:       6,
    borderRadius: 3,
    marginLeft:   4,
  },
  cardStatsRow: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           3,
  },
  cardStat: {
    fontFamily: font.bold,
    fontSize:   11,
  },
  cardStatLabel: {
    fontFamily: font.ui,
    fontSize:   9,
    color:      neutral.textDim,
  },
  cardStatSep: {
    fontFamily:   font.ui,
    fontSize:     10,
    color:        neutral.textDim,
    marginHorizontal: 2,
  },

  stem: {
    width:       2,
    borderRadius: 1,
    opacity:     0.85,
    ...Platform.select({
      web: { boxShadow: '0 0 6px currentColor' } as any,
      default: {},
    }),
  },

  // Option C — caption row above the dot.
  captionWrap: {
    height:         CAPTION_HEIGHT,
    justifyContent: 'center',
    alignItems:     'center',
    paddingHorizontal: 4,
  },
  caption: {
    fontFamily:    font.ui,
    fontSize:      11,
    fontStyle:     'italic',
    color:         neutral.textDim,
    letterSpacing: 0.2,
    ...Platform.select({
      web: { textShadow: '0 1px 4px rgba(0,0,0,0.55)' } as any,
      default: {},
    }),
  },
  captionLoc: {
    fontFamily: font.bold,
    fontStyle:  'italic',
  },

  // Option E (prepared) — Trending pill at top-left of the card.
  // Top-left absolute position so it overlays the video.
  trendingPill: {
    position:          'absolute',
    top:               6,
    left:              6,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: 7,
    paddingVertical:   3,
    borderRadius:      radius.pill,
    borderWidth:       1,
    backgroundColor:   'rgba(10,10,20,0.78)',
    ...Platform.select({
      web: {
        backdropFilter:       'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      } as any,
      default: {},
    }),
  },
  trendingPillText: {
    fontFamily:    font.bold,
    fontSize:      9,
    letterSpacing: 0.5,
  },

  dotAnchor: {
    width:          DOT_SIZE,
    height:         DOT_SIZE,
    alignItems:     'center',
    justifyContent: 'center',
  },
  dot: {
    width:        DOT_SIZE,
    height:       DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth:  1,
    ...Platform.select({
      web: { boxShadow: '0 0 8px currentColor' } as any,
      default: {},
    }),
  },
  pulse: {
    position:     'absolute',
    width:        DOT_SIZE,
    height:       DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth:  1.5,
  },

  fallback: {
    width:           '100%',
    height:          '100%',
    alignItems:      'center',
    justifyContent:  'center',
  },
  fallbackIcon: {
    fontSize: 28,
    opacity:  0.85,
  },
});
