import React from 'react';
import { Linking, StyleSheet, Text } from 'react-native';
import { knox, neutral } from '@/theme/colors';
import { font } from '@/theme/typography';

/**
 * TweetText
 * ----------
 * Tweet text the way X shows it: mentions, hashtags and links picked out in
 * Knox orange, the leading @mentions of a reply hidden (the card shows
 * 'Replying to' instead), and the trailing t.co link dropped when it only
 * points at attached media, a link card or a quoted tweet.
 *
 * One job: render the words of a tweet.
 */

const TOKEN = /(https?:\/\/\S+|@\w{1,15}|#[\p{L}\p{N}_]+)/gu;

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

export function cleanTweetText(text: string, opts: { isReply: boolean; hasAttachment: boolean }): string {
  let t = decode(text);
  if (opts.isReply) t = t.replace(/^(@\w{1,15}\s+)+/, '');
  if (opts.hasAttachment) t = t.replace(/\s*https:\/\/t\.co\/\w+\s*$/, '');
  return t.trim();
}

interface Props {
  text:          string;
  /** Shown in place of a bare t.co link when the tweet has a link card. */
  linkDomain?:   string;
  numberOfLines?: number;
  size?:         number;
}

export function TweetText({ text, linkDomain, numberOfLines, size = 15 }: Props) {
  const parts = text.split(TOKEN);
  return (
    <Text style={[styles.text, { fontSize: size, lineHeight: Math.round(size * 1.4) }]} numberOfLines={numberOfLines}>
      {parts.map((part, i) => {
        if (i % 2 === 0) return part;
        const href = part.startsWith('http')
          ? part
          : part.startsWith('@')
            ? `https://x.com/${part.slice(1)}`
            : `https://x.com/hashtag/${encodeURIComponent(part.slice(1))}`;
        const label = part.startsWith('http')
          ? part.includes('t.co/') ? (linkDomain ?? part.replace(/^https?:\/\//, '')) : part.replace(/^https?:\/\/(www\.)?/, '')
          : part;
        return (
          <Text key={i} style={styles.entity} onPress={() => Linking.openURL(href)}>
            {label}
          </Text>
        );
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: font.ui,
    fontWeight: '500',
    color: neutral.text,
  },
  entity: {
    color: knox.primaryOrange,
  },
});
