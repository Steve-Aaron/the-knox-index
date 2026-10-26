/**
 * tweetFormat
 * ------------
 * Date formatting for tweet cards: '22 Oct', or '22 Oct 2025' outside the
 * current year. British order, as the rest of the site.
 */

const dayMonth     = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const dayMonthYear = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export function formatTweetDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.getFullYear() === new Date().getFullYear() ? dayMonth.format(d) : dayMonthYear.format(d);
}
