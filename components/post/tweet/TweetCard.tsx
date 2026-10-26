import React, { useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import type { TweetData } from '@/data/types';
import { CardAvatar } from '@/components/card/CardAvatar';
import { formatters } from '@/components/primitives/CountUp';
import { brand, glass, knox, neutral } from '@/theme/colors';
import type { GroupKey } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { font } from '@/theme/typography';
import { LinearGradient } from 'expo-linear-gradient';
import { TweetText, cleanTweetText } from './TweetText';
import { TweetMedia } from './TweetMedia';
import { LinkCard, QuotedTweet, TweetPoll } from './TweetEmbeds';
import { VerifiedBadge } from './VerifiedBadge';
import { formatTweetDate } from './tweetFormat';

/**
 * TweetCard
 * ----------
 * An X post rebuilt in the shape people know from X — header, 'Replying to',
 * text, media, link card, poll, quoted tweet and the action row — in Knox
 * branding: Knox surfaces and Figtree, the brand gradient for the verified
 * badge, play button and poll leader, Knox orange for links, and the avatar
 * ringed in the leader's region colours.
 *
 * Fills the space a 9:16 TikTok cover takes in the post detail. Taller tweets
 * scroll inside it; long text collapses behind 'Show more' as on X.
 *
 * One job: draw one tweet.
 */

const STILLS = ['photo', 'videoThumbnail', 'gifThumbnail', 'liveThumbnail'];
/** X collapses anything past a standard post's length behind 'Show more'. */
const LONG_POST = 280;

interface Props {
  tweet:    TweetData;
  /** The post's words (the shared `caption` field). */
  text:     string;
  groupKey: GroupKey;
  postUrl:  string;
  width?:   number | string;
  height?:  number;
}

export function TweetCard({ tweet, text: rawText, groupKey, postUrl, width = '100%', height }: Props) {
  const [expanded, setExpanded] = useState(false);

  const hasStills   = tweet.media.some(m => STILLS.includes(m.type));
  const linkPreview = tweet.media.find(m => m.type === 'linkPreview')?.url;
  const text = cleanTweetText(rawText, {
    isReply:       !!tweet.replyTo,
    hasAttachment: hasStills || !!tweet.link || !!tweet.quoted,
  });
  const isLong = text.length > LONG_POST;

  return (
    <View
      style={[styles.card, { width: width as any }, height ? { height } : null]}
      {...(Platform.OS === 'web' ? { 'data-component': 'tweetCard' } as any : {})}
    >
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <CardAvatar groupKey={groupKey} initials={initials(tweet.authorName)} avatarUrl={tweet.avatarUrl} size={44} />
          <View style={styles.who}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>{tweet.authorName}</Text>
              {tweet.verified && <VerifiedBadge size={16} />}
            </View>
            <Text style={styles.handle} numberOfLines={1}>@{tweet.handle} · {formatTweetDate(tweet.createdAt)}</Text>
          </View>
          <Pressable onPress={() => Linking.openURL(postUrl)} hitSlop={8} accessibilityLabel="View on X">
            <FontAwesome6 name="x-twitter" size={16} color={neutral.textMid} />
          </Pressable>
        </View>

        {tweet.replyTo ? (
          <Text style={styles.replyTo}>Replying to <Text style={styles.replyHandle}>@{tweet.replyTo}</Text></Text>
        ) : null}

        {text ? <TweetText text={text} linkDomain={tweet.link?.domain} numberOfLines={isLong && !expanded ? 6 : undefined} /> : null}
        {isLong && (
          <Pressable onPress={() => setExpanded(e => !e)} style={styles.moreBtn}>
            <Text style={styles.more}>{expanded ? 'Show less' : 'Show more'}</Text>
          </Pressable>
        )}

        <TweetMedia media={tweet.media} />
        {tweet.poll && <TweetPoll poll={tweet.poll} />}
        {tweet.link && !hasStills && !tweet.quoted && <LinkCard link={tweet.link} image={linkPreview} />}
        {tweet.quoted && <QuotedTweet quoted={tweet.quoted} groupKey={groupKey} />}

        <View style={styles.actions}>
          <Action icon="comment"      value={tweet.replies}   label="replies" />
          <Action icon="retweet"      value={tweet.reposts}   label="reposts" />
          <Action icon="heart"        value={tweet.likes}     label="likes" />
          <Action icon="chart-simple" value={tweet.views}     label="views" />
          <Action icon="bookmark"     value={tweet.bookmarks} label="bookmarks" />
        </View>
      </ScrollView>
      {/* Knox signature edge: the brand gradient along the foot of the card */}
      <LinearGradient colors={brand.gradient as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.edge} />
    </View>
  );
}

function Action({ icon, value, label }: { icon: string; value: number; label: string }) {
  return (
    <View style={styles.action} accessibilityLabel={`${value} ${label}`}>
      <FontAwesome6 name={icon as any} size={14} color={neutral.textMid} />
      <Text style={styles.actionValue}>{formatters.compact(value)}</Text>
    </View>
  );
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

const styles = StyleSheet.create({
  card: {
    flexShrink: 0,
    backgroundColor: neutral.felt,
    overflow: 'hidden',
    position: 'relative',
  },
  body:    { padding: spacing.base, gap: spacing.md },
  head:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  who:     { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name:    { fontFamily: font.ui, fontWeight: '800', fontSize: 15, color: neutral.text, flexShrink: 1 },
  handle:  { fontFamily: font.ui, fontSize: 14, color: neutral.textMid },
  replyTo: { fontFamily: font.ui, fontSize: 14, color: neutral.textMid, marginTop: -6 },
  replyHandle: { color: knox.primaryOrange },
  moreBtn: { marginTop: -8, alignSelf: 'flex-start' },
  more:    { fontFamily: font.ui, fontWeight: '600', fontSize: 14, color: knox.primaryOrange },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: glass.border,
    paddingHorizontal: spacing.xs,
    marginTop: spacing.xs,
  },
  action:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: spacing.sm },
  actionValue: { fontFamily: font.mono, fontSize: 13, color: neutral.textMid },
  edge:        { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3 },
});
