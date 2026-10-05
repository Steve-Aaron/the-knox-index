/**
 * lib/format.ts
 * --------------
 * Shared label-formatting helpers. Applied wherever raw DB values
 * (snake_case party names, account types, style tags, topics) are
 * rendered as visible UI text.
 *
 * One job: turn machine strings into human-readable labels.
 */

/**
 * Convert a snake_case or raw DB string into a title-cased label.
 * 'lib_dem'              → 'Lib Dem'
 * 'member_of_parliament' → 'Member Of Parliament'
 * 'talking_head'         → 'Talking Head'
 * Already-spaced strings pass through unmodified aside from capitalisation.
 */
export function fmtLabel(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Singularise a party label for inline copy by dropping a trailing 's'.
 * 'Liberal Democrats' → 'Liberal Democrat', 'Greens' → 'Green'.
 * Only strips a lowercase trailing 's', so acronyms and non-plural names
 * ('SNP', 'Labour', 'Plaid Cymru', 'Reform UK') are left untouched.
 */
export function fmtSingular(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/s$/, '');
}

/**
 * Date formatter: render a date as DD-MM-YYYY.
 * Accepts an ISO string or 'YYYY-MM-DD' (anything where the first 10
 * chars are the date). '2026-05-20' → '20-05-2026'. Empty/invalid → ''.
 */
export function fmtDate(s: string | null | undefined): string {
  if (!s) return '';
  const iso = s.slice(0, 10);
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}

/**
 * THE compact number formatter. Every abbreviated count in the app comes
 * through here, so a billion reads as 1B rather than 1000M.
 *
 *   999          → '999'
 *   1_234        → '1.2K'
 *   1_200_000    → '1.2M'
 *   1_000_000_000 → '1B'
 *   2_500_000_000_000 → '2.5T'
 *
 * Rules that keep the output short and stable:
 *   - one decimal, dropped when it is a trailing zero ('1B', not '1.0B')
 *   - rounding that would fill the unit promotes it (999_960_000 → '1B')
 *   - negatives keep their sign; non-finite input degrades to '0'
 *
 * @param suffix Optional override of the unit letters, lower-case 'k' style
 *               included for callers that want it.
 */
const COMPACT_UNITS = [
  { value: 1e12, symbol: 'T' },
  { value: 1e9,  symbol: 'B' },
  { value: 1e6,  symbol: 'M' },
  { value: 1e3,  symbol: 'K' },
] as const;

export function fmtCount(n: number): string {
  if (!Number.isFinite(n)) return '0';

  const sign = n < 0 ? '-' : '';
  const abs  = Math.abs(n);

  for (let i = 0; i < COMPACT_UNITS.length; i++) {
    const unit = COMPACT_UNITS[i];
    if (abs < unit.value) continue;

    const scaled = abs / unit.value;

    // 999.96M would print as '1000.0M' — a thousand of the wrong unit. Promote
    // to the next one up instead, when there is one.
    if (Number(scaled.toFixed(1)) >= 1000 && i > 0) {
      const bigger = COMPACT_UNITS[i - 1];
      return `${sign}${trimDecimal(abs / bigger.value)}${bigger.symbol}`;
    }

    return `${sign}${trimDecimal(scaled)}${unit.symbol}`;
  }

  return `${sign}${Math.round(abs)}`;
}

/** One decimal place, with a trailing '.0' removed. */
function trimDecimal(n: number): string {
  const fixed = n.toFixed(1);
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed;
}
