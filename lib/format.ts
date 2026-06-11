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
 * Number formatter: compact notation for large counts.
 * 1234 → '1.2k', 1_200_000 → '1.2M'
 */
export function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
