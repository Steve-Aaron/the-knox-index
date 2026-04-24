import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { neutral, party, PartyKey, glass } from '@/theme/colors';
import { type } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { formatters } from '@/components/primitives/CountUp';
import type { Politician } from '@/data/types';

/**
 * CardBack
 * ---------
 * The reverse side of a card. Shows recent posts strip and totals.
 * Pure presentational. One job.
 */
interface Props {
  politician: Politician;
}

export function CardBack({ politician }: Props) {
  const colour = party[politician.partyKey];

  return (
    <View style={styles.wrap}>
      <Text style={[styles.heading, { color: colour.glow }]}>RECENT POSTS</Text>
      <View style={styles.posts}>
        {politician.recentPosts.map(p => (
          <View key={p.postId} style={styles.post}>
            <Text style={styles.caption} numberOfLines={2}>
              {p.caption}
            </Text>
            <View style={styles.postStats}>
              <Text style={styles.stat}>{formatters.compact(p.views)} views</Text>
              <Text style={styles.dot}> · </Text>
              <Text style={styles.stat}>{formatters.compact(p.likes)} likes</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.divider} />

      <Text style={[styles.heading, { color: colour.glow }]}>TOTALS</Text>
      <View style={styles.totals}>
        <TotalCell label="Posts" value={formatters.compact(politician.totals.posts)} />
        <TotalCell label="Followers" value={formatters.compact(politician.totals.followers)} />
        <TotalCell label="Likes" value={formatters.compact(politician.totals.likes)} />
        <TotalCell label="24h views" value={formatters.compact(politician.totals.views24h)} />
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.button,
          { borderColor: colour.base, opacity: pressed ? 0.7 : 1 },
        ]}
        onPress={() => Linking.openURL(`https://tiktok.com/${politician.handle}`)}
      >
        <Text style={[styles.buttonText, { color: colour.glow }]}>OPEN PROFILE</Text>
      </Pressable>
    </View>
  );
}

function TotalCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.totalCell}>
      <Text style={styles.totalLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.totalValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    padding: spacing.lg,
    paddingLeft: spacing.lg + 6,
    gap: spacing.md,
  },
  heading: { ...type.caption, fontSize: 10 },
  posts: { gap: spacing.sm },
  post: {
    backgroundColor: glass.fill,
    borderWidth: 1,
    borderColor: glass.border,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  caption: { ...type.body, color: neutral.text, fontSize: 12 },
  postStats: { flexDirection: 'row', marginTop: 4 },
  stat: { ...type.numberSm, color: neutral.textMid, fontSize: 11 },
  dot: { color: neutral.textDim },
  divider: { height: 1, backgroundColor: glass.border, marginVertical: spacing.xs },
  totals: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  totalCell: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: glass.fill,
    borderWidth: 1,
    borderColor: glass.border,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  totalLabel: { ...type.caption, color: neutral.textDim, fontSize: 9 },
  totalValue: { ...type.numberMd, color: neutral.text, marginTop: 2 },
  button: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  buttonText: { ...type.caption, fontSize: 11 },
});
