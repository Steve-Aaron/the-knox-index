import type { TimeRange } from './types';

/**
 * Comparison wording for deltas ('+1.9pp vs prev. week'). Lifetime has no
 * previous period, so callers hide the delta column when this returns null.
 */
const PREV_PERIOD_LABEL: Record<TimeRange, string | null> = {
  yesterday: 'vs prev. day',
  week:      'vs prev. week',
  month:     'vs prev. month',
  year:      'vs prev. year',
  lifetime:  null,
};

export function prevPeriodLabel(range: TimeRange): string | null {
  return PREV_PERIOD_LABEL[range];
}
