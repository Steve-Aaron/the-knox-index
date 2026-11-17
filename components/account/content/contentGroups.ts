import type { ContentSlice } from '@/data/account/types';
import { MAX_NAMED_SLICES } from './contentPalette';

/**
 * Which slices the donut names and which it folds into "Other" (spec 7.2):
 *
 * 1. Slices at 5% or more are named, the rest go into "Other".
 * 2. While "Other" is above 10%, or bigger than the largest named slice, the
 *    largest slice in it is named, up to 8 named slices.
 * 3. A slice under 2% is never named: too thin to read. "Other" then stays
 *    above 10% and shows how many slices it holds.
 *
 * The table lists every slice either way; folded ones are drawn grey.
 */
export const OTHER_KEY = '__other__';

const NAMED_MIN  = 0.05;
const OTHER_MAX  = 0.10;
const PROMOTE_MIN = 0.02;

export interface SliceGroups {
  /** Slices with their own segment and colour, largest first. */
  named:     ContentSlice[];
  /** Keys of the slices folded into "Other". */
  otherKeys: Set<string>;
  /** The "Other" segment, or null when nothing is folded. */
  other:     { views: number; share: number; count: number } | null;
}

export function groupSlices(slices: ContentSlice[]): SliceGroups {
  // Slices arrive sorted by views, so the named ones are always a prefix.
  let n = 0;
  while (n < slices.length && n < MAX_NAMED_SLICES && slices[n].share >= NAMED_MIN) n++;

  const otherShare = () => slices.slice(n).reduce((s, x) => s + x.share, 0);
  while (
    n < slices.length
    && n < MAX_NAMED_SLICES
    && slices[n].share >= PROMOTE_MIN
    && (otherShare() > OTHER_MAX || otherShare() > (slices[0]?.share ?? 0))
  ) n++;

  // A lone leftover slice reads better as itself than as "Other (1)".
  if (slices.length - n === 1 && n < MAX_NAMED_SLICES) n++;

  const rest = slices.slice(n);
  return {
    named:     slices.slice(0, n),
    otherKeys: new Set(rest.map(s => s.key)),
    other:     rest.length
      ? {
          views: rest.reduce((s, x) => s + x.views, 0),
          share: rest.reduce((s, x) => s + x.share, 0),
          count: rest.length,
        }
      : null,
  };
}
