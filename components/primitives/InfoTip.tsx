import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { neutral, glass, accent } from '@/theme/colors';
import { font } from '@/theme/typography';

/**
 * InfoTip
 * --------
 * A small ? badge that reveals a plain-English explanation on hover (web)
 * or tap (native).
 *
 * On web the tooltip uses position:fixed so it:
 *   - Always renders on the top layer (escapes all stacking contexts)
 *   - Is never clipped by overflow:hidden parents
 *   - Is never made transparent by parent opacity
 *
 * Props:
 *   align  — 'left'  → tooltip's top-left corner anchors to the badge
 *             'right' → tooltip's top-right corner anchors to the badge (default)
 *   placement — 'below' | 'above' (default: below) — native only
 *   width  — tooltip width in px (default 240)
 */
interface Props {
  text:        string;
  align?:      'left' | 'right';   // horizontal anchor, default: 'right'
  placement?:  'below' | 'above';  // native only, default: 'below'
  width?:      number;
}

interface FixedPos {
  top:    number;
  left?:  number;
  right?: number;
}

const GAP = 6; // px between badge bottom and tooltip top

export function InfoTip({ text, align = 'right', placement = 'below', width = 240 }: Props) {
  const [visible,  setVisible]  = useState(false);
  const [fixedPos, setFixedPos] = useState<FixedPos | null>(null);
  const badgeRef = useRef<any>(null);

  const show = useCallback(() => {
    if (Platform.OS === 'web' && badgeRef.current) {
      const rect: DOMRect = badgeRef.current.getBoundingClientRect();
      const top = rect.bottom + GAP + window.scrollY;

      if (align === 'left') {
        setFixedPos({ top, left: rect.left });
      } else {
        // right: anchor the tooltip's right edge to the badge's right edge
        setFixedPos({ top, right: window.innerWidth - rect.right });
      }
    }
    setVisible(true);
  }, [align]);

  const hide = useCallback(() => {
    setVisible(false);
    setFixedPos(null);
  }, []);

  const toggle = useCallback(() => {
    if (visible) hide(); else show();
  }, [visible, show, hide]);

  // ── Native: absolute offset from badge ───────────────────────────────────
  const nativeOffset = placement === 'above'
    ? { bottom: 22, top: undefined }
    : { top: 22,   bottom: undefined };

  return (
    <View style={styles.wrap}>
      <Pressable
        ref={badgeRef}
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={`More information: ${text}`}
        style={({ pressed }) => [
          styles.badge,
          visible && styles.badgeActive,
          pressed && { opacity: 0.7 },
        ]}
        {...(Platform.OS === 'web' ? {
          onMouseEnter: show,
          onMouseLeave: hide,
        } as any : {})}
      >
        <Text style={[styles.icon, visible && styles.iconActive]}>?</Text>
      </Pressable>

      {visible && (
        Platform.OS === 'web' && fixedPos ? (
          /* ── Web: fixed position — escapes all parent contexts ────── */
          <View
            style={[
              styles.tooltipFixed,
              {
                top:   fixedPos.top,
                left:  fixedPos.left  ?? undefined,
                right: fixedPos.right ?? undefined,
                width,
              },
            ] as any}
            pointerEvents="none"
          >
            <TooltipBody text={text} />
          </View>
        ) : (
          /* ── Native: absolute positioned ─────────────────────────── */
          <View
            style={[
              styles.tooltipAbsolute,
              align === 'left' ? { left: 0 } : { right: 0 },
              nativeOffset as any,
              { width },
            ]}
            pointerEvents="none"
          >
            <TooltipBody text={text} />
          </View>
        )
      )}
    </View>
  );
}

// ── Shared tooltip body ───────────────────────────────────────────────────────

function TooltipBody({ text }: { text: string }) {
  return (
    <View style={styles.tooltipInner}>
      <Text style={styles.tooltipText}>{text}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    alignSelf: 'center',
  },

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
    fontSize:   9,
    color:      neutral.textDim,
    lineHeight: 11,
  },
  iconActive: {
    color: accent.indigo,
  },

  // Web: fixed position — fully escapes parent opacity/overflow/stacking contexts
  tooltipFixed: {
    position: 'fixed' as any,
    zIndex:   999999,
  },

  // Native: absolute offset from the badge container
  tooltipAbsolute: {
    position: 'absolute',
    zIndex:   9999,
  },

  tooltipInner: {
    backgroundColor: '#0d0d1a',
    borderWidth:     1,
    borderColor:     'rgba(124,131,255,0.35)',
    borderRadius:    8,
    padding:         10,
    // Solid opacity — never transparent
    opacity:         1,
    elevation:       20,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 32px rgba(0,0,0,0.85)',
        zIndex:    999999,
      } as any,
      default: {
        shadowColor:   '#000',
        shadowOpacity: 0.7,
        shadowRadius:  16,
        shadowOffset:  { width: 0, height: 6 },
      },
    }),
  },
  tooltipText: {
    fontFamily: font.ui,
    fontSize:   12,
    color:      neutral.textMid,
    lineHeight: 18,
  },
});
