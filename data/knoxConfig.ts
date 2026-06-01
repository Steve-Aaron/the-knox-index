/**
 * data/knoxConfig.ts
 * -------------------
 * Knox Factor formula configuration — single file to control all scoring.
 *
 * Knox Factor is The Knox Index's composite performance score (0–100) that
 * combines four normalised metrics into a single headline number.
 *
 * ## Model: per-axis contribution caps
 *
 *   Each axis is normalised 0–100 upstream, then contributes UP TO its
 *   cap value to the final score. Caps are absolute point ceilings, not
 *   weights — they do not auto-normalise.
 *
 *   The caps deliberately sum to MORE than 100 (currently 140) so that
 *   different shapes of strength can each reach the ceiling:
 *     - Pure virality + engagement maxes at 50 + 50 = 100
 *     - Pure frequency + followers maxes at 20 + 20 = 40
 *     - A well-rounded account hits 100 easily
 *   The raw composite is then clamped to 100.
 *
 * ## How to tune the score:
 *
 *   caps           — Maximum point contribution per axis. Edit ratios to
 *                    shift emphasis; the sum may exceed 100 by design.
 *
 *   curveStrength  — Exponent on the Moz-DA-style compression curve, which
 *                    pulls displayed scores toward the 50 pivot.
 *                      > 1  → slight reward below 50, slight punishment above
 *                      = 1  → linear (no curve)
 *                      < 1  → opposite (rewards extremes — not usually wanted)
 *
 *   minScore       — Floor score for any account that has posted at all,
 *                    so accounts with marginal activity don't render as 0.
 *
 * ## Current defaults:
 *   virality 50, engagement 50, frequency 20, followers 20  (caps sum 140)
 *   curveStrength 1.3 → raw 30 ≈ 35, raw 50 = 50, raw 70 ≈ 65, raw 90 ≈ 87
 */

export interface KnoxCaps {
  virality:    number;   // avg post views relative to followers
  engagement:  number;   // (likes + comments + shares) / views
  followers:   number;   // total follower count
  frequency:   number;   // posts published this week
}

/** ─── EDIT THESE TO REBALANCE THE SCORE ─────────────────────────────────── */
export const KNOX_OPTIONS = {

  /**
   * Per-axis point caps. Each axis contributes up to its cap value to the
   * composite. Caps may sum to more than 100 by design — final total is
   * clamped to 100 so multiple shapes of strength can hit the ceiling.
   */
  caps: {
    virality:    50,   // TikTok virality is a primary signal
    engagement:  50,   // Quality interaction per view, equally weighted
    frequency:   20,   // Posting consistency — secondary
    followers:   20,   // Audience size — secondary
  } satisfies KnoxCaps,

  /**
   * Moz-DA-style compression curve. Pulls displayed scores toward 50.
   *
   * curveStrength 1.3 produces these example mappings:
   *   raw 10  → displayed 13   (+3 boost)
   *   raw 30  → displayed 35   (+5 boost)
   *   raw 50  → displayed 50   (pivot)
   *   raw 70  → displayed 65   (-5 punishment)
   *   raw 90  → displayed 87   (-3 punishment)
   *   raw 100 → displayed 100
   */
  curveStrength: 1.3,

  /** Minimum displayed score for any account with ≥1 post this week. */
  minScore: 5,

} as const;

/** ─────────────────────────────────────────────────────────────────────────── */

/**
 * Compute Knox Factor from four normalised component scores (each 0–100).
 * Returns a rounded integer 0–100.
 *
 * Step 1: sum per-axis contributions, where each contribution = (axis/100) · cap.
 * Step 2: clamp composite to 100.
 * Step 3: apply compression curve around the 50 pivot (Moz-DA-style).
 * Step 4: apply minScore floor if any axis has signal.
 */
export function computeKnoxFactor(
  virality:    number,   // normalised 0–100
  engagement:  number,   // normalised 0–100
  followers:   number,   // normalised 0–100
  frequency:   number,   // normalised 0–100
): number {
  const c = KNOX_OPTIONS.caps;

  // Each axis contributes up to its cap. Sum may exceed 100 — that's intentional.
  const composite =
    (virality   / 100) * c.virality   +
    (engagement / 100) * c.engagement +
    (followers  / 100) * c.followers  +
    (frequency  / 100) * c.frequency;

  // Clamp to 0..100 before the curve so the pivot maths stays well-defined.
  const clamped = Math.min(100, Math.max(0, composite));

  // Compress toward 50 — slight reward below pivot, slight punishment above.
  // f(x) = 50 + sign(x − 50) · 50 · |(x − 50) / 50|^curveStrength
  const PIVOT = 50;
  const delta = clamped - PIVOT;
  const normDelta = Math.abs(delta) / PIVOT;                    // 0..1
  const compressed = Math.pow(normDelta, KNOX_OPTIONS.curveStrength) * PIVOT;
  const curved = PIVOT + Math.sign(delta) * compressed;

  // Apply floor only when at least one axis has any signal
  const hasActivity = virality + engagement + followers + frequency > 0;
  const floored = hasActivity ? Math.max(curved, KNOX_OPTIONS.minScore) : curved;

  return Math.round(Math.min(100, Math.max(0, floored)));
}
