import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { glass, neutral } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { type } from '@/theme/typography';
import type { AccountAffiliation } from '@/data/account/types';

/**
 * AffiliationPanel
 * -----------------
 * 'Affiliation' label over a row with the group name (in its colour) and the
 * number of tracked members.
 *
 * One job: show which group the account belongs to.
 */
interface Props {
  affiliation: AccountAffiliation;
  color:       string;
}

export function AffiliationPanel({ affiliation, color }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Affiliation</Text>
      <View style={styles.row}>
        <Text style={[styles.group, { color }]} numberOfLines={1}>
          {affiliation.label}
        </Text>
        <Text style={styles.members}>{affiliation.memberCount} members</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    gap:       spacing.md,
  },
  heading: {
    ...type.body,
    fontSize: 16,
    color:    neutral.textMid,
  },
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    gap:               spacing.md,
    paddingVertical:   spacing.base,
    paddingHorizontal: spacing.base,
    borderRadius:      radius.md,
    borderWidth:       1,
    borderColor:       glass.border,
    backgroundColor:   glass.card,
  },
  group: {
    ...type.caption,
    fontSize:   12,
    flexShrink: 1,
  },
  members: {
    ...type.caption,
    fontSize: 12,
    color:    neutral.text,
  },
});
