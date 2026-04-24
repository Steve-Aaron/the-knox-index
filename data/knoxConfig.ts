/**
 * data/knoxConfig.ts
 * -------------------
 * Knox Factor formula configuration.
 *
 * Knox Factor is Ariadne's composite performance score (0–100) that combines
 * four normalised metrics into a single headline number per politician.
 *
 * To change the formula:
 *   1. Adjust the weights below (they are automatically normalised to sum to 1,
 *      so you only need to think about their relative importance).
 *   2. Change FORMULA if you want a different aggregation (e.g. geometric mean).
 *
 * The calculated score is passed to the RankBoard and RadialScoreChart.
 */

export interface KnoxWeights {
  views:      number;   // avg post view count
  engagement: number;   // (likes + comments + shares) / views rate
  frequency:  number;   // posts published this week
  followers:  number;   // total follower count
}

/** Relative weights — edit these to rebalance the score. */
export const KNOX_WEIGHTS: KnoxWeights = {
  views:      1,    // view reach matters most
  engagement: 1,    // engagement quality equally important
  frequency:  1,    // posting regularly keeps accounts active
  followers:  1,    // audience size — equal weight for now
};

/**
 * Compute Knox Factor from four normalised scores (each 0–100).
 * Returns a rounded integer 0–100.
 *
 * Default: weighted average of all four axes.
 * Change KNOX_WEIGHTS above to shift emphasis, or replace this
 * function body entirely with a custom formula.
 */
export function computeKnoxFactor(
  views:      number,
  engagement: number,
  frequency:  number,
  followers:  number,
): number {
  const w  = KNOX_WEIGHTS;
  const total = w.views + w.engagement + w.frequency + w.followers;
  if (total === 0) return 0;

  const weighted =
    views      * w.views      +
    engagement * w.engagement +
    frequency  * w.frequency  +
    followers  * w.followers;

  return Math.round(weighted / total);
}
