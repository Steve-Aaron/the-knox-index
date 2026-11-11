import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { CardAvatar } from '@/components/card/CardAvatar';
import { accent, colourFor, glass, neutral } from '@/theme/colors';
import { font, weight } from '@/theme/typography';
import { radius } from '@/theme/spacing';
import type { ComparisonRow as Row } from '@/data/account/types';

/**
 * ComparisonRow
 * --------------
 * Rank, avatar, name and party, then the Knox Factor out of 100. The page's
 * own account is highlighted; the others link to their account page.
 *
 * One job: render one leaderboard row.
 */
interface Props {
  row: Row;
}

export function ComparisonRow({ row }: Props) {
  const colour = colourFor(row.groupKey).base;

  const identity = (
    <>
      <CardAvatar
        groupKey={row.groupKey}
        initials={row.avatarInitials}
        avatarUrl={row.avatarUrl}
        size={36}
      />
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>{row.name}</Text>
        <Text style={styles.party} numberOfLines={1}>{row.partyLabel}</Text>
      </View>
    </>
  );

  return (
    <View style={[styles.row, row.isSelf && styles.rowSelf]}>
      <Text style={[styles.rank, { color: colour }]}>#{row.rank}</Text>
      {row.isSelf ? (
        <View style={styles.identity}>{identity}</View>
      ) : (
        <Pressable
          onPress={() => router.push(`/account/${encodeURIComponent(row.handle)}`)}
          accessibilityRole="link"
          accessibilityLabel={row.name}
          style={({ hovered }: any) => [styles.identity, styles.link, hovered && styles.linkHovered]}
        >
          {identity}
        </Pressable>
      )}
      <View style={styles.score}>
        <Text style={[styles.scoreValue, { color: colour }]}>{row.knoxFactor}</Text>
        <Text style={styles.scoreMax}>/ 100</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    height:            54,
    paddingHorizontal: 12,
    paddingVertical:   8,
    borderRadius:      radius.md,
    borderWidth:       1,
    borderColor:       glass.border,
    backgroundColor:   glass.card,
  },
  rowSelf: {
    borderColor:     accent.indigo,
    backgroundColor: accent.indigo + '2E',  // 18%
  },
  rank: {
    width:         25,
    fontFamily:    font.ui,
    fontWeight:    weight.semiBold,
    fontSize:      12,
    letterSpacing: 0.8,
  },
  identity: {
    flex:          1,
    minWidth:      0,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  link: Platform.select({ web: { cursor: 'pointer' } as any, default: {} }) as any,
  linkHovered: {
    opacity: 0.8,
  },
  text: {
    flex:     1,
    minWidth: 0,
    gap:      1,
  },
  name: {
    fontFamily: font.bold,
    fontWeight: weight.bold,
    fontSize:   16,
    color:      neutral.text,
  },
  party: {
    fontFamily:    font.ui,
    fontWeight:    weight.semiBold,
    fontSize:      12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color:         neutral.textDim,
  },
  score: {
    flexDirection: 'row',
    alignItems:    'flex-end',
    gap:           2,
  },
  scoreValue: {
    fontFamily:    font.mono,
    fontSize:      16,
    lineHeight:    18,
    letterSpacing: -0.3,
  },
  scoreMax: {
    fontFamily:    font.ui,
    fontWeight:    weight.semiBold,
    fontSize:      12,
    letterSpacing: 0.8,
    color:         neutral.textDim,
  },
});
