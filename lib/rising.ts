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
}

export interface RisingTopic extends TopicPeriodCount {
  /** cur - prev. */
  gain:  number;
  /** cur / prev, or null when the topic is new this period. */
  ratio: number | null;
}

/** A topic needs at least this many posts this period to count as rising. */
export const RISING_MIN_POSTS = 8;
/** ...and at least this many more posts than last period. */
export const RISING_MIN_GAIN = 5;

/** Same label on several platforms → one row, counts added. */
export function mergeCounts(rows: TopicPeriodCount[]): TopicPeriodCount[] {
  const byLabel = new Map<string, TopicPeriodCount>();
  for (const r of rows) {
    const label = String(r.label ?? '').trim();
    if (!label) continue;
    const t = byLabel.get(label) ?? { label, cur: 0, prev: 0 };
    t.cur  += Number(r.cur ?? 0);
    t.prev += Number(r.prev ?? 0);
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
