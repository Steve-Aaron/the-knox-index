/**
 * lib/rising.ts
 * --------------
 * Which topics are rising: posts on a topic in the chosen period against the
 * period of the same length before it. The big topics are always the most
 * talked about, so this ranks by growth instead of size.
 *
 * One job: rank topic counts by how fast they are growing.
 */

export interface TopicPeriodCount {
  label: string;
  /** Posts in the chosen period. */
  cur:   number;
  /** Posts in the period before it. */
  prev:  number;
  /** Views on this period's posts, and on the period before's. */
  curViews?:  number;
  prevViews?: number;
}

export interface RisingTopic extends TopicPeriodCount {
  /** cur - prev. */
  gain:  number;
  /** cur / prev, or null when the topic is new this period. */
  ratio: number | null;
  /** Posts this period, on the impact ranking (cur and prev are views per post there). */
  posts?: number;
}

/** A topic needs at least this many posts this period to count as rising. */
export const RISING_MIN_POSTS = 8;
/** ...and at least this many more posts than last period. */
export const RISING_MIN_GAIN = 5;

/**
 * For impact (views per post), a topic needs this many posts in BOTH periods,
 * so the average is a real one and not one viral post or a near-empty week.
 */
export const IMPACT_MIN_POSTS_CUR  = 8;
export const IMPACT_MIN_POSTS_PREV = 5;
/** ...and an average at least this many times the period before's. */
export const IMPACT_MIN_RATIO = 1.3;

/** Same label on several platforms → one row, counts added. */
export function mergeCounts(rows: TopicPeriodCount[]): TopicPeriodCount[] {
  const byLabel = new Map<string, TopicPeriodCount>();
  for (const r of rows) {
    const label = String(r.label ?? '').trim();
    if (!label) continue;
    const t = byLabel.get(label) ?? { label, cur: 0, prev: 0, curViews: 0, prevViews: 0 };
    t.cur       += Number(r.cur ?? 0);
    t.prev      += Number(r.prev ?? 0);
    t.curViews! += Number(r.curViews ?? 0);
    t.prevViews!+= Number(r.prevViews ?? 0);
    byLabel.set(label, t);
  }
  return [...byLabel.values()];
}

export function rankRising(rows: TopicPeriodCount[], limit = 12): RisingTopic[] {
  return mergeCounts(rows)
    .filter(r => r.cur >= RISING_MIN_POSTS && r.cur - r.prev >= RISING_MIN_GAIN)
    .map(r => ({
      ...r,
      gain:  r.cur - r.prev,
      ratio: r.prev > 0 ? r.cur / r.prev : null,
    }))
    // Ranked by the multiplier the card shows; a new topic counts as cur / 1
    .sort((a, b) => (b.ratio ?? b.cur) - (a.ratio ?? a.cur) || b.gain - a.gain)
    .slice(0, limit);
}

/**
 * Topics whose posts are landing harder than before: average views per post
 * this period against the period before. This is apart from how much a topic
 * is posted about, so a topic can rise here with the same number of posts.
 * { cur, prev } are the averages, so the card reads them the same way.
 */
export function rankRisingImpact(rows: TopicPeriodCount[], limit = 12): RisingTopic[] {
  return mergeCounts(rows)
    .filter(r => r.cur >= IMPACT_MIN_POSTS_CUR && r.prev >= IMPACT_MIN_POSTS_PREV)
    .map(r => {
      const cur = (r.curViews ?? 0) / r.cur;
      const prev = (r.prevViews ?? 0) / r.prev;
      return { label: r.label, cur, prev, posts: r.cur, gain: cur - prev, ratio: prev > 0 ? cur / prev : null };
    })
    .filter(r => r.ratio != null && r.ratio >= IMPACT_MIN_RATIO)
    .sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0) || b.gain - a.gain)
    .slice(0, limit);
}
