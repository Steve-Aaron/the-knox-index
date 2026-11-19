/**
 * lib/xPosts.ts
 * --------------
 * Turns the `tweet` STRUCT from lib/xQueries.ts into TweetData, and signs its
 * media. Server-side only (signing uses the GCS client).
 *
 * One job: finish an X post for the client.
 */

import type { TweetData } from '@/data/types';
import { signGcsUrl } from '@/lib/gcs';

/** The `tweet` STRUCT exactly as BigQuery returns it. */
export interface RawTweet {
  authorName:   string;
  handle:       string;
  avatarUrl:    string | null;
  verified:     boolean;
  createdAt:    string;
  replyTo:      string | null;
  likes:        number;
  reposts:      number;
  replies:      number;
  quotes:       number;
  bookmarks:    number;
  views:        number;
  media:        { url: string; type: string }[] | null;
  linkUrl:      string | null;
  linkTitle:    string | null;
  linkDomain:   string | null;
  pollJson:     string | null;
  quoteHandle:  string | null;
  quoteName:    string | null;
  quoteAvatar:  string | null;
  quoteText:    string | null;
  quoteCreated: string | null;
}

interface RawPoll {
  question?:  string;
  is_closed?: boolean;
  answers?:   { answer: string; votes: number }[];
}

function parsePoll(json: string | null): TweetData['poll'] {
  if (!json || json === 'null') return undefined;
  const raw = JSON.parse(json) as RawPoll;
  if (!raw.answers?.length) return undefined;
  return {
    question: raw.question,
    closed:   !!raw.is_closed,
    options:  raw.answers.map(a => ({ label: a.answer, votes: a.votes ?? 0 })),
  };
}

export function toTweetData(raw: RawTweet): TweetData {
  return {
    authorName: raw.authorName,
    handle:     raw.handle,
    avatarUrl:  raw.avatarUrl ?? undefined,
    verified:   !!raw.verified,
    createdAt:  raw.createdAt,
    replyTo:    raw.replyTo ?? undefined,
    likes:      Number(raw.likes) || 0,
    reposts:    Number(raw.reposts) || 0,
    replies:    Number(raw.replies) || 0,
    quotes:     Number(raw.quotes) || 0,
    bookmarks:  Number(raw.bookmarks) || 0,
    views:      Number(raw.views) || 0,
    media:      raw.media ?? [],
    link:       raw.linkUrl ? { url: raw.linkUrl, title: raw.linkTitle ?? undefined, domain: raw.linkDomain ?? undefined } : undefined,
    poll:       parsePoll(raw.pollJson),
    quoted:     raw.quoteHandle
      ? { handle: raw.quoteHandle, name: raw.quoteName ?? undefined, avatarUrl: raw.quoteAvatar ?? undefined,
          text: raw.quoteText ?? '', createdAt: raw.quoteCreated ?? undefined }
      : undefined,
  };
}

/** Sign every media URL on a tweet. Twitter CDN URLs pass through unchanged. */
export async function signTweetMedia(tweet: TweetData | undefined): Promise<void> {
  if (!tweet) return;
  tweet.media = await Promise.all(tweet.media.map(async m => ({ ...m, url: await signGcsUrl(m.url) })));
}
