import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { MotiView } from 'moti';
import { track } from '@/lib/analytics';
import { neutral, accent } from '@/theme/colors';
import { font } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { DevLabel } from '@/components/primitives/DevLabel';
import { Interstitial } from '@/components/primitives/Interstitial';

/**
 * InfoTip + InfoTipModal
 * -----------------------
 * Two related exports:
 *
 *   <InfoTip text="..." />
 *     A small ? badge that opens a centred modal card on click. The badge is
 *     the trigger. This is the canonical helper pattern used across the app
 *     ('Performance radar', 'Reach looks healthy for size', and every DashCard
 *     helper).
 *
 *   <InfoTipModal visible onClose text="..." />
 *     The same modal, but controlled externally. Use this when the trigger is
 *     not a ? badge — e.g. the dots on the radial chart, where the data point
 *     itself is the clickable target. Visual language and behaviour are
 *     identical to the badge-driven InfoTip: centred card, dimmed backdrop,
 *     'WHAT DOES THIS MEAN?' kicker, X close, click-outside dismiss, same
 *     `helper_clicked` analytics event.
 *
 * Both components render the same `<ModalShell>` internally so styling stays
 * in lockstep. Tweaking the modal once updates every consumer.
 */

// ── Badge-driven InfoTip ──────────────────────────────────────────────────────

interface Props {
  text:        string;
  topic?:      string;
  /** kept for backwards compatibility, not used in modal mode */
  align?:      'left' | 'right';
  /** kept for backwards compatibility, not used in modal mode */
  placement?:  'below' | 'above';
  /** max width of the modal card (default 280) */
  width?:      number;
}

export function InfoTip({ text, topic, width = 280 }: Props) {
  const [visible, setVisible] = useState(false);

  const open = useCallback(() => {
    setVisible(true);
    track('helper_clicked', {
      topic: topic ?? text.slice(0, 40),
    });
  }, [text, topic]);

  const close = useCallback(() => setVisible(false), []);

  return (
    <View style={styles.wrap}>
      <DevLabel name="InfoTip" />
      {/* Badge */}
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`More information: ${text}`}
        style={({ pressed }) => [
          styles.badge,
          visible && styles.badgeActive,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={[styles.icon, visible && styles.iconActive]}>?</Text>
      </Pressable>

      <InfoTipModal
        visible={visible}
        onClose={close}
        text={text}
        width={width}
      />
    </View>
  );
}

// ── Controlled InfoTipModal ───────────────────────────────────────────────────

interface ModalProps {
  visible:  boolean;
  onClose:  () => void;
  /** Optional kicker shown at the top of the card. Defaults to 'What does this mean?'. */
  title?:   string;
  /**
   * Body text. Use either `text` or `children` — not both. `children` wins if
   * present, so callers needing rich content (e.g. a big metric + caption) can
   * pass their own JSX.
   */
  text?:    string;
  children?: React.ReactNode;
  width?:   number;
}

// Helper popovers render as edge-to-edge interstitials — the (?) click is
// a takeover, not a tooltip. The `title` becomes the kicker tag so visitors
// still see 'WHAT DOES THIS MEAN?' framing.
export function InfoTipModal({
  visible,
  onClose,
  title    = 'What does this show?',
  text,
  children,
  // width retained for backwards compatibility; ignored — interstitial is
  // intentionally full-screen.
  width: _width,
}: ModalProps) {
  // Close on Esc (web only — no physical key on native)
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  return (
    <Interstitial
      visible={visible}
      onClose={onClose}
      kicker={title.toUpperCase()}
      text={text}
      fullScreen
    >
      {children}
    </Interstitial>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: {
    position:  'relative',
    alignSelf: 'center',
  },

  // Badge
  badge: {
    width:           16,
    height:          16,
    borderRadius:    8,
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems:      'center',
    justifyContent:  'center',
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  badgeActive: {
    borderColor:     accent.indigo,
    backgroundColor: 'rgba(124,131,255,0.18)',
  },
  icon: {
    fontFamily: font.bold,
    fontSize:   12,
    color:      neutral.textDim,
    lineHeight: 11,
  },
  iconActive: {
    color: accent.indigo,
  },

  // Web: fixed full-screen backdrop
  backdropFixed: {
    position:       'fixed' as any,
    top:            0,
    left:           0,
    right:          0,
    bottom:         0,
    zIndex:         99998,
    alignItems:     'center',
    justifyContent: 'center',
  },
  backdropHit: {
    // Dim the page behind the modal so the radial chart and other surfaces
    // are obscured. 0.78 alpha + a stronger card background below keeps the
    // helper sitting visibly on top.
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.78)',
  },
  centreWrap: {
    position:       'absolute' as any,
    top:            0,
    left:           0,
    right:          0,
    bottom:         0,
    alignItems:     'center',
    justifyContent: 'center',
    zIndex:         99999,
    pointerEvents:  'none' as any,
  },

  // Native: large absolute area around the call site
  backdropAbsolute: {
    position:       'absolute',
    top:            -200,
    left:           -140,
    right:          -140,
    bottom:         -200,
    zIndex:         9999,
    alignItems:     'center',
    justifyContent: 'center',
  },

  // Shared modal card — fully opaque so chart/page content behind never
  // shows through. The card sits above an 0.78-alpha backdrop and inside
  // a fixed/absolute centre-wrap with the highest in-app z-index.
  card: {
    width:           '100%',
    backgroundColor: '#0B0B14',
    opacity:         1,
    borderWidth:     1,
    borderColor:     'rgba(124,131,255,0.35)',
    borderRadius:    radius.lg,
    padding:         spacing.lg,
    gap:             spacing.sm,
    ...Platform.select({
      web: {
        backgroundColor: '#0B0B14',
        boxShadow: '0 16px 48px rgba(0,0,0,0.85), 0 0 0 1px rgba(124,131,255,0.12)',
        zIndex:    99999,
        pointerEvents: 'auto',
        isolation: 'isolate',
      } as any,
      default: {
        shadowColor:   '#000',
        shadowOpacity: 0.7,
        shadowRadius:  24,
        shadowOffset:  { width: 0, height: 8 },
        elevation:     24,
      },
    }),
  },

  // Modal header row
  modalHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            spacing.sm,
  },
  modalTitle: {
    fontFamily:    font.bold,
    fontSize:      12,
    color:         accent.indigo,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
  closeBtn: {
    width:           20,
    height:          20,
    borderRadius:    10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems:      'center',
    justifyContent:  'center',
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  closeBtnText: {
    fontFamily: font.bold,
    fontSize:   12,
    color:      neutral.textDim,
    lineHeight: 11,
  },

  // Body text
  modalText: {
    fontFamily: font.ui,
    fontSize:   16,
    color:      neutral.textMid,
    lineHeight: 20,
  },
});
