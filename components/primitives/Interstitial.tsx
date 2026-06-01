import React from 'react';
import ReactDOM from 'react-dom';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { MotiView } from 'moti';
import { neutral, glass, knox, brand } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { font } from '@/theme/typography';
import { DevLabel } from '@/components/primitives/DevLabel';
import { Kicker } from '@/components/ui/Kicker';
import { Title } from '@/components/ui/Title';

/**
 * Interstitial
 * -------------
 * Full-screen centered modal shell. Used wherever the app wants to interrupt
 * the user with a focused message — locked time ranges, locked features, info
 * tips, value-prop reminders.
 *
 * Visual signature: dimmed full-viewport backdrop + a single centered card
 * with the Knox product gradient border accent. Clicking the backdrop closes
 * the modal; clicking the card does not. The card has no fixed max-width
 * because the user asked for the interstitial to feel like it takes up the
 * whole screen — content sits in a generous frame, the backdrop bleeds to
 * the edges, and the card itself is large by design.
 *
 * One job: a consistent, attention-commanding centered modal primitive.
 */

interface Props {
  visible:    boolean;
  onClose:    () => void;
  /** Small uppercase tag above the title, e.g. 'LOCKED' or 'WHAT DOES THIS MEAN?' */
  kicker?:    string;
  title?:     string;
  /** Optional body. If `children` is passed it wins over `text`. */
  text?:      string;
  children?:  React.ReactNode;
  /** Optional CTA at the foot. Pair label with onPress. */
  ctaLabel?:  string;
  onCta?:     () => void;
  /** Secondary CTA — usually 'Maybe later' / 'Close'. */
  secondaryLabel?: string;
  /**
   * When true, the modal stretches edge-to-edge across the viewport
   * instead of capping at a 720px-wide centred card. Content sits inside
   * a generous container that fills the whole screen. Used for the
   * (?) helper tips where the whole page is the takeover.
   */
  fullScreen?: boolean;
}

export function Interstitial({
  visible, onClose, kicker, title, text, children, ctaLabel, onCta, secondaryLabel,
  fullScreen = false,
}: Props) {
  if (!visible) return null;

  const card = (
    <MotiView
      from={{ opacity: 0, scale: fullScreen ? 1 : 0.96, translateY: fullScreen ? 0 : 12 }}
      animate={{ opacity: 1, scale: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 220 }}
      style={[styles.modalCard, fullScreen && styles.cardFullScreen]}
    >
      <DevLabel name="Interstitial" />
      {/* Top gradient bar — Knox brand identity */}
      <View style={styles.brandAccent}>
        <View style={[styles.brandSwatch, { backgroundColor: brand.gradient[0] }]} />
        <View style={[styles.brandSwatch, { backgroundColor: brand.gradient[1] }]} />
        <View style={[styles.brandSwatch, { backgroundColor: brand.gradient[2] }]} />
        <View style={[styles.brandSwatch, { backgroundColor: brand.gradient[3] }]} />
        <View style={[styles.brandSwatch, { backgroundColor: brand.gradient[4] }]} />
      </View>

      <View style={[styles.body, fullScreen && styles.bodyFullScreen]}>
        <View style={styles.header}>
          {kicker ? <Kicker style={{ color: knox.primaryPink, letterSpacing: 2 }}>{kicker}</Kicker> : null}
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        {title ? <Title style={{ fontSize: 32, lineHeight: 38, letterSpacing: -0.6 }}>{title}</Title> : null}

        {children ? children : (
          text ? <Text style={styles.text}>{text}</Text> : null
        )}

        {(ctaLabel || secondaryLabel) ? (
          <View style={styles.footer}>
            {ctaLabel ? (
              <Pressable
                onPress={onCta}
                style={({ pressed, hovered }: any) => [
                  styles.ctaBtn,
                  hovered && styles.ctaBtnHover,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.ctaBtnText}>{ctaLabel}</Text>
              </Pressable>
            ) : null}
            {secondaryLabel ? (
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.secondaryBtnText}>{secondaryLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </MotiView>
  );

  if (Platform.OS === 'web') {
    // Portal to document.body so the modal escapes any ancestor that has a
    // CSS transform / filter / perspective set. Those properties re-anchor
    // `position: fixed` to the transformed ancestor instead of the viewport,
    // which previously trapped this modal inside MotiView animation wrappers
    // (e.g. PoliticianDetailPanel's translateX entry animation).
    const node = (
      <View style={styles.backdropFixed as any}>
        <Pressable style={styles.backdropHit} onPress={onClose} />
        <View
          // fullScreen: no padding so the card hits the viewport edges.
          // centred: padding so the 720px card has room around it.
          style={[styles.centreWrap, fullScreen && styles.centreWrapFullScreen]}
          pointerEvents="box-none"
        >
          <Pressable
            // Stop clicks on the card from bubbling to the backdrop
            onPress={e => e?.stopPropagation?.()}
            style={[styles.cardPressBlock, fullScreen && styles.cardPressBlockFullScreen]}
          >
            {card}
          </Pressable>
        </View>
      </View>
    );
    // SSR guard — document is undefined on the server render pass.
    if (typeof document === 'undefined' || !document.body) {
      return node;
    }
    return ReactDOM.createPortal(node, document.body);
  }

  return (
    <View style={styles.backdropAbsolute} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
      {card}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Web: fixed full-viewport backdrop
  backdropFixed: {
    position:        'fixed' as any,
    top:             0,
    left:            0,
    right:           0,
    bottom:          0,
    backgroundColor: 'rgba(4,4,10,0.84)',
    zIndex:          10000,
    ...Platform.select({
      web: { backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' } as any,
      default: {},
    }),
  },
  // Native fallback
  backdropAbsolute: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,4,10,0.85)',
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          10000,
  },
  backdropHit: {
    ...StyleSheet.absoluteFillObject,
  },
  centreWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        spacing.lg,
  },
  // fullScreen — kill the padding so the card stretches edge-to-edge
  centreWrapFullScreen: {
    padding: 0,
  },
  cardPressBlock: {
    width:     '100%',
    alignItems: 'center',
  },
  // fullScreen — let the press block fill 100% height too so the card
  // can stretch vertically rather than hugging its content.
  cardPressBlockFullScreen: {
    width:  '100%',
    height: '100%',
    alignItems: 'stretch',
  },

  // Card — large, generous. Caps at 720px so it doesn't stretch absurdly
  // on ultrawide monitors but otherwise fills the available width.
  modalCard: {
    width:           '100%',
    maxWidth:        720,
    backgroundColor: '#1F1D1D',
    borderWidth:     1,
    borderColor:     glass.borderHi,
    overflow:        'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 32px 96px rgba(0,0,0,0.6), 0 0 0 1px rgba(232,60,145,0.15)',
      } as any,
      default: {
        shadowColor:   '#000',
        shadowOpacity: 0.7,
        shadowRadius:  44,
        shadowOffset:  { width: 0, height: 18 },
      },
    }),
  },
  // fullScreen — kill the max-width / border / shadow so the card spans
  // the entire viewport. Top gradient bar stays as the only chrome.
  cardFullScreen: {
    maxWidth:    '100%' as any,
    width:       '100%',
    height:      '100%',
    borderWidth: 0,
    ...Platform.select({
      web:     { boxShadow: 'none' } as any,
      default: { shadowOpacity: 0, shadowRadius: 0 },
    }),
  },

  // Top gradient bar — five Knox brand swatches in sequence
  brandAccent: {
    flexDirection: 'row',
    height:        4,
  },
  brandSwatch: {
    flex: 1,
  },

  body: {
    padding: spacing.xxl,
    gap:     spacing.md,
  },
  // fullScreen — much more generous padding, content auto-centred so it
  // doesn't crowd the top edge on tall viewports. flex:1 lets it fill the
  // card's full height; maxWidth caps the readable column width.
  bodyFullScreen: {
    flex:              1,
    padding:           spacing.xxxl,
    paddingHorizontal: spacing.xxxl,
    justifyContent:    'center',
    maxWidth:          900,
    alignSelf:         'center',
    width:             '100%',
  },
  header: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
  },
  closeBtn: {
    width:           28,
    height:          28,
    borderWidth:     1,
    borderColor:     glass.borderHi,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems:      'center',
    justifyContent:  'center',
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  closeBtnText: {
    fontFamily: font.bold,
    color:      neutral.textMid,
    fontSize:   13,
    lineHeight: 13,
  },
  text: {
    fontFamily: font.ui,
    fontSize:   16,
    lineHeight: 24,
    color:      neutral.textMid,
  },

  footer: {
    flexDirection: 'row',
    gap:           spacing.md,
    alignItems:    'center',
    marginTop:     spacing.md,
    flexWrap:      'wrap',
  },
  ctaBtn: {
    backgroundColor:   knox.primaryPink,
    borderWidth:       1,
    borderColor:       knox.primaryPink,
    paddingHorizontal: spacing.xl,
    paddingVertical:   spacing.md,
    ...Platform.select({
      web: {
        cursor:             'pointer',
        transitionProperty: 'background-color, border-color, color',
        transitionDuration: '180ms',
      } as any,
      default: {},
    }),
  },
  ctaBtnHover: {
    backgroundColor: knox.accentPurple,
    borderColor:     knox.accentPurple,
  },
  ctaBtnText: {
    fontFamily:    font.bold,
    fontSize:      12,
    color:         '#fff',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  secondaryBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  secondaryBtnText: {
    fontFamily:    font.ui,
    fontSize:      12,
    color:         neutral.textDim,
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
});
