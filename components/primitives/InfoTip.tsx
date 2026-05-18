import React, { useState, useCallback } from 'react';
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

/**
 * InfoTip
 * --------
 * A small ? badge that opens a centred modal card on press (click on web,
 * tap on native). Fires a helper_clicked analytics event with the topic.
 *
 * On web a fixed full-screen backdrop sits behind the card so any click
 * outside dismisses it. On native a large absolute Pressable captures
 * outside taps with the same effect.
 *
 * Props:
 *   text      — the explanation shown in the modal
 *   topic     — short label for analytics (defaults to first 40 chars of text)
 *   align     — kept for backwards compat, not used in modal mode
 *   placement — kept for backwards compat, not used in modal mode
 *   width     — max width of the modal card (default 280)
 */
interface Props {
  text:        string;
  topic?:      string;
  align?:      'left' | 'right';
  placement?:  'below' | 'above';
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

      {/* Modal overlay */}
      {visible && (
        Platform.OS === 'web' ? (
          /* ── Web: fixed full-screen backdrop + centred card ── */
          <View style={styles.backdropFixed as any}>
            {/* Dimmed backdrop — captures outside clicks */}
            <Pressable style={styles.backdropHit} onPress={close} />
            {/* Card — centred in viewport */}
            <View style={styles.centreWrap} pointerEvents="box-none">
              <MotiView
                from={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'timing', duration: 180 }}
                style={[styles.card, { maxWidth: width }] as any}
              >
                <ModalBody text={text} onClose={close} />
              </MotiView>
            </View>
          </View>
        ) : (
          /* ── Native: large absolute backdrop around the badge ── */
          <View style={styles.backdropAbsolute} pointerEvents="box-none">
            <Pressable style={StyleSheet.absoluteFillObject} onPress={close} />
            <MotiView
              from={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'timing', duration: 180 }}
              style={[styles.card, { maxWidth: width }]}
            >
              <ModalBody text={text} onClose={close} />
            </MotiView>
          </View>
        )
      )}
    </View>
  );
}

// ── Modal body ────────────────────────────────────────────────────────────────

function ModalBody({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>What does this mean?</Text>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>
      </View>
      <Text style={styles.modalText}>{text}</Text>
    </>
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
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

  // Native: large absolute area around the badge
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

  // Shared modal card
  card: {
    width:           '100%',
    backgroundColor: '#0d0d1a',
    borderWidth:     1,
    borderColor:     'rgba(124,131,255,0.35)',
    borderRadius:    radius.lg,
    padding:         spacing.lg,
    gap:             spacing.sm,
    ...Platform.select({
      web: {
        boxShadow: '0 16px 48px rgba(0,0,0,0.85), 0 0 0 1px rgba(124,131,255,0.12)',
        zIndex:    99999,
        pointerEvents: 'auto',
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
