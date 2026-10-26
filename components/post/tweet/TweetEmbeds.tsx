import React from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { TweetData } from '@/data/types';
import { CardAvatar } from '@/components/card/CardAvatar';
import { formatters } from '@/components/primitives/CountUp';
import { brand, glass, neutral } from '@/theme/colors';
import type { GroupKey } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { font } from '@/theme/typography';
import { LinearGradient } from 'expo-linear-gradient';
import { TweetText, cleanTweetText } from './TweetText';
import { formatTweetDate } from './tweetFormat';

/**
 * TweetEmbeds
 * ------------
 * The three things a tweet can carry under its text, each in X's shape:
 *   LinkCard   — preview image, domain, title
 *   TweetPoll  — options as bars, the leader in the Knox gradient
 *   QuotedTweet — the quoted post in a bordered box
 *
 * One job each; kept in one file because they share the embed frame.
 */

export function LinkCard({ link, image }: { link: NonNullable<TweetData['link']>; image?: string }) {
  const domain = link.domain ?? link.url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  return (
    <Pressable style={styles.frame} onPress={() => Linking.openURL(link.url)}>
      {image ? <Image source={{ uri: image }} style={styles.linkImage} resizeMode="cover" /> : null}
      <View style={styles.linkText}>
        <Text style={styles.muted} numberOfLines={1}>{domain}</Text>
        {link.title ? <Text style={styles.linkTitle} numberOfLines={2}>{link.title}</Text> : null}
      </View>
    </Pressable>
  );
}

export function TweetPoll({ poll }: { poll: NonNullable<TweetData['poll']> }) {
  const total = poll.options.reduce((t, o) => t + o.votes, 0) || 1;
  const top = Math.max(...poll.options.map(o => o.votes));
  return (
    <View style={styles.poll}>
      {poll.options.map(o => {
        const pct = (o.votes / total) * 100;
        const isTop = o.votes === top;
        return (
          <View key={o.label} style={styles.pollRow}>
            {isTop ? (
              <LinearGradient colors={brand.gradient as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[styles.pollFill, { width: `${pct}%` as any, opacity: 0.55 }]} />
            ) : (
              <View style={[styles.pollFill, { width: `${pct}%` as any, backgroundColor: glass.borderHi }]} />
            )}
            <Text style={[styles.pollLabel, isTop && styles.bold]} numberOfLines={1}>{o.label}</Text>
            <Text style={[styles.pollPct, isTop && styles.bold]}>{Math.round(pct)}%</Text>
          </View>
        );
      })}
      <Text style={styles.muted}>
        {formatters.compact(total)} votes · {poll.closed ? 'Final results' : 'Open'}
      </Text>
    </View>
  );
}

export function QuotedTweet({ quoted, groupKey }: { quoted: NonNullable<TweetData['quoted']>; groupKey: GroupKey }) {
  const name = quoted.name ?? quoted.handle;
  return (
    <View style={[styles.frame, styles.quote]}>
      <View style={styles.quoteHead}>
        <CardAvatar groupKey={groupKey} initials={name.slice(0, 2).toUpperCase()} avatarUrl={quoted.avatarUrl} size={22} />
        <Text style={styles.quoteName} numberOfLines={1}>{name}</Text>
        <Text style={styles.muted} numberOfLines={1}>
          @{quoted.handle}{quoted.createdAt ? ` · ${formatTweetDate(quoted.createdAt)}` : ''}
        </Text>
      </View>
      <TweetText text={cleanTweetText(quoted.text, { isReply: false, hasAttachment: true })} numberOfLines={4} size={14} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: 1,
    borderColor: glass.borderHi,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  muted: { fontFamily: font.ui, fontSize: 13, color: neutral.textMid },
  bold:  { fontWeight: '800' },
  linkImage: { width: '100%' as any, aspectRatio: 1.91 },
  linkText:  { paddingHorizontal: spacing.md, paddingVertical: 10, gap: 2 },
  linkTitle: { fontFamily: font.ui, fontSize: 15, color: neutral.text },
  poll:    { gap: 6 },
  pollRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    overflow: 'hidden',
  },
  pollFill:  { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 6 },
  pollLabel: { fontFamily: font.ui, fontSize: 14, color: neutral.text, flex: 1 },
  pollPct:   { fontFamily: font.mono, fontSize: 14, color: neutral.text },
  quote:     { padding: spacing.md, gap: 6 },
  quoteHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quoteName: { fontFamily: font.ui, fontWeight: '700', fontSize: 14, color: neutral.text, flexShrink: 1 },
});
