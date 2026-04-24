import React, { useState } from 'react';
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
 * or tap (native). Aimed at non-technical users who need context.
 *
 * Renders nothing more than a circle and a tooltip — zero layout impact
 * until the tooltip opens. Use next to any label that needs clarification.
 *
 * Usage:
 *   <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
 *     <Text style={styles.label}>Knox Factor</Text>
 *     <InfoTip text="Our composite score — an average of views, engagement, frequency and followers, all scored 0–100." />
 *   </View>
 */
interface Props {
  text:       string;
  placement?: 'below' | 'above';   // default: below
  width?:     number;              // tooltip width, default 240
}

export function InfoTip({ text, placement = 'below', width = 240 }: Props) {
  const [visible, setVisible] = useState(false);

  const show = () => setVisible(true);
  const hide = () => setVisible(false);
  const toggle = () => setVisible(v => !v);

  const tooltipOffset = placement === 'above' ? { bottom: 22, top: undefined } : { top: 22, bottom: undefined };

  return (
    <View style={styles.wrap}>
      <Pressable
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
        <View style={[styles.tooltip, { width }, tooltipOffset as any]}>
          <View style={styles.tooltipInner}>
            <Text style={styles.tooltipText}>{text}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    alignSelf: 'center',
    // zIndex ensures tooltip floats above siblings
    ...Platform.select({ web: { zIndex: 100 } as any, default: {} }),
  },

  badge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  badgeActive: {
    borderColor: accent.indigo,
    backgroundColor: 'rgba(124,131,255,0.18)',
  },
  icon: {
    fontFamily: font.bold,
    fontSize: 9,
    color: neutral.textDim,
    lineHeight: 11,
  },
  iconActive: {
    color: accent.indigo,
  },

  tooltip: {
    position: 'absolute',
    left: 0,
    ...Platform.select({ web: { zIndex: 9999 } as any, default: {} }),
  },
  tooltipInner: {
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: 'rgba(124,131,255,0.35)',
    borderRadius: 8,
    padding: 10,
    ...Platform.select({
      web: { boxShadow: '0 8px 32px rgba(0,0,0,0.55)' } as any,
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.5,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
    }),
  },
  tooltipText: {
    fontFamily: font.ui,
    fontSize: 12,
    color: neutral.textMid,
    lineHeight: 18,
  },
});
