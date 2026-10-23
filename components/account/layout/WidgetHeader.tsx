import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Kicker } from '@/components/ui/Kicker';
import { Title } from '@/components/ui/Title';
import { spacing } from '@/theme/spacing';
import { useAccountLayout } from './accountLayout';

/**
 * WidgetHeader
 * -------------
 * Kicker + title on the left, optional controls on the right. Leaves room on
 * the right for the DashCard ? helper, which is absolutely positioned. The
 * title steps down a size on mobile so it fits one line with its accessory.
 *
 * One job: the top line of an account widget.
 */
interface Props {
  title:   string;
  kicker?: string;
  /** Overrides the kicker's default dim colour. */
  kickerColor?: string;
  /** Controls aligned to the right, e.g. a SegmentedControl. */
  right?:  React.ReactNode;
  /** Text next to the title, e.g. a count badge. */
  titleAccessory?: React.ReactNode;
}

export function WidgetHeader({ title, kicker, kickerColor, right, titleAccessory }: Props) {
  const { isMobile } = useAccountLayout();
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        {kicker ? <Kicker tone="dim" style={kickerColor ? { color: kickerColor } : undefined}>{kicker}</Kicker> : null}
        <View style={styles.titleRow}>
          <Title style={isMobile ? styles.titleCompact : undefined}>{title}</Title>
          {titleAccessory}
        </View>
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

/** Width reserved for the DashCard ? helper in the top-right corner. */
const HELPER_GUTTER = 28;

const styles = StyleSheet.create({
  row: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    flexWrap:       'wrap',
    gap:            spacing.md,
    paddingRight:   HELPER_GUTTER,
  },
  text: {
    gap:        spacing.xs,
    flexShrink: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  titleCompact: {
    fontSize:   20,
    lineHeight: 26,
  },
  right: {
    flexShrink: 0,
  },
});
