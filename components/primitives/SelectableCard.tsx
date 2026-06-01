import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform, ViewStyle } from 'react-native';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { DevLabel } from '@/components/primitives/DevLabel';
import { neutral, accent } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { font } from '@/theme/typography';

/**
 * SelectableCard
 * ---------------
 * Pressable card with an icon on the left, a label + sub on the right, and
 * a check badge that appears in the top-right corner when selected.
 *
 * Used by both the segment grid ('Who are you?') and the interest grid
 * ('What do you want to do?') in two places — the /preferences screen and
 * the signup ProfilingModal. Replaces ~50 lines of duplicated JSX per call
 * site (~100 lines across two files).
 *
 * One job: be a single selectable choice in a grid of related choices.
 */

interface Props {
  /** Stable identifier — not rendered, but useful for analytics on the consumer side. */
  id?:         string;
  iconName:    string;
  label:       string;
  sub:         string;
  active:      boolean;
  onPress:     () => void;
  /** Override outer style if the consumer wants a tighter / wider grid cell. */
  cardStyle?:  ViewStyle;
}

export function SelectableCard({ iconName, label, sub, active, onPress, cardStyle }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        active && styles.cardActive,
        pressed && { opacity: 0.82 },
        cardStyle,
      ]}
    >
      <DevLabel name="SelectableCard" />
      <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
        <FontAwesome6
          name={iconName as any}
          size={20}
          color={active ? accent.indigo : neutral.textMid}
          solid
        />
      </View>
      <View style={styles.text}>
        <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      {active && (
        <View style={styles.checkBadge}>
          <FontAwesome6 name="check" size={9} color="#fff" solid />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.md,
    flex:            1,
    minWidth:        220,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth:     1.5,
    borderColor:     'rgba(255,255,255,0.07)',
    borderRadius:    radius.md,
    padding:         spacing.md,
    position:        'relative',
    ...Platform.select({
      web: {
        cursor:             'pointer',
        transitionProperty: 'border-color, background-color',
        transitionDuration: '140ms',
      } as any,
      default: {},
    }),
  },
  cardActive: {
    borderColor:     accent.indigo,
    backgroundColor: 'rgba(124,131,255,0.08)',
  },
  iconWrap: {
    width:           40,
    height:          40,
    borderRadius:    radius.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  iconWrapActive: {
    backgroundColor: 'rgba(124,131,255,0.14)',
  },
  text:        { flex: 1, gap: 2, minWidth: 0 },
  label:       { fontFamily: font.bold, fontSize: 16, color: neutral.textMid },
  labelActive: { color: neutral.text },
  sub:         { fontFamily: font.ui, fontSize: 12, color: neutral.textDim, lineHeight: 16 },
  checkBadge: {
    position:        'absolute',
    top:             8,
    right:           8,
    width:           20,
    height:          20,
    borderRadius:    10,
    backgroundColor: accent.indigo,
    alignItems:      'center',
    justifyContent:  'center',
  },
});
