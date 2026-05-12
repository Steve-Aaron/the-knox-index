/**
 * data/knoxConfig.ts
 * -------------------
 * Knox Factor formula configuration — single file to control all scoring.
 *
 * Knox Factor is The Knox Index's composite performance score (0–100) that
 * combines four normalised metrics into a single headline number.
 *
 * ## How to tune the score:
 *
 *   weights      — Relative importance of each axis. They are normalised
 *                  to sum to 1 before averaging, so only the ratios matter.
 *                  Increase virality to reward reach; increase engagement
 *                  to reward quality interaction; etc.
 *
 *   scorePower   — Exponent applied after the weighted average.
 *                  < 1 → boosts top performers into the 80s–90s (default 0.65)
 *                  = 1 → linear (no curve)
 *                  > 1 → punishes mid-range performers
 *
 *   minScore     — Floor score for any account that has posted at all, so
 *                  inactive accounts that have any activity aren't shown as 0.
 *
 * ## Current defaults:
 *   virality x3, engagement x2.5, followers x1.5, frequency x1
 *   Power curve 0.65 → linear 50 → displayed ~61, linear 90 → displayed ~93
 */

export interface KnoxWeights {
  virality:    number;   // avg post views relative to followers
  engagement:  number;   // (likes + comments + shares) / views
  followers:   number;   // total follower count
  frequency:   number;   // posts published this week
}

/** ─── EDIT THESE TO REBALANCE THE SCORE ─────────────────────────────────── */
export const KNOX_OPTIONS = {

  /** Relative weights — only ratios matter, they are auto-normalised. */
  weights: {
    virality:    3.0,   // TikTok virality is the primary signal
    engagement:  2.5,   // Quality interaction per view
    followers:   1.5,   // Audience size matters but is slower-moving
    frequency:   1.0,   // Posting consistency
  } satisfies KnoxWeights,

  /**
   * Power curve exponent applied to the 0–100 weighted average.
   * 0.65 produces these example mappings:
   *   raw 30  → displayed 42
   *   raw 50  → displayed 61
   *   raw 70  → displayed 77
   *   raw 90  → displayed 93
   *   raw 100 → displayed 100
   */
  scorePower: 0.65,

  /** Minimum displayed score for any account with ≥1 post this week. */
  minScore: 5,

} as const;

/** ─────────────────────────────────────────────────────────────────────────── */

/**
 * Compute Knox Factor from four normalised component scores (each 0–100).
 * Returns a rounded integer 0–100.
 *
 * Step 1: weighted average of four axes.
 * Step 2: apply power curve to push top performers into the 80s–90s.
 * Step 3: apply minScore floor if any axis is non-zero.
 */
export function computeKnoxFactor(
  virality:    number,   // normalised 0–100
  engagement:  number,   // normalised 0–100
  followers:   number,   // normalised 0–100
  frequency:   number,   // normalised 0–100
): number {
  const w = KNOX_OPTIONS.weights;
  const totalWeight = w.virality + w.engagement + w.followers + w.frequency;
  if (totalWeight === 0) return 0;

  const weighted = (
    virality   * w.virality   +
    engagement * w.engagement +
    followers  * w.followers  +
    frequency  * w.frequency
  ) / totalWeight;

  // Apply power curve — boosts top performers while keeping the scale 0–100
  const curved = Math.pow(weighted / 100, KNOX_OPTIONS.scorePower) * 100;

  // Apply floor only when at least one axis has any signal
  const hasActivity = virality + engagement + followers + frequency > 0;
  const floored = hasActivity ? Math.max(curved, KNOX_OPTIONS.minScore) : curved;

  return Math.round(Math.min(100, floored));
}
