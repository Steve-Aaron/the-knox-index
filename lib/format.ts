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
 * Number formatter: compact notation for large counts.
 * 1234 → '1.2k', 1_200_000 → '1.2M'
 */
export function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
