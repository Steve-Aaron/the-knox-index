/**
 * lib/postMetrics.ts
 * -------------------
 * Per-post derived numbers shared by every post surface (Recent posts card,
 * Post Feed card, account Best posts, post insight modal).
 *
 * One job: keep post maths in one place so every surface shows the same value.
 */

interface EngagementInput {
  views:    number;
  likes:    number;
  comments: number;
  shares:   number;
  saves?:   number;
}

/**
 * Engagement rate in percent, rounded to 2 dp:
 * (likes + comments + saves + shares) / views × 100. 0 when there are no views.
 */
export function postEngagementRate(p: EngagementInput): number {
  return p.views > 0
    ? +(((p.likes + p.comments + (p.saves ?? 0) + p.shares) / p.views) * 100).toFixed(2)
    : 0;
}
