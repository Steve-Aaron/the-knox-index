/**
 * lib/linkedin.ts
 * ----------------
 * LinkedIn handle utilities — shared by the /preferences page and the signup
 * ProfilingModal so handle extraction stays identical in both flows.
 *
 *   extractLinkedinHandle(input) — normalises any common pasted shape
 *     (full URL, www.-prefixed, regional subdomain, @-handle, plain handle,
 *     with or without trailing slash / query string) down to just the handle.
 *
 *   buildLinkedinUrl(handle) — rebuilds the canonical full URL for storage
 *     and downstream consumers (Brevo's LINKEDIN attribute, email templates).
 */

export const LINKEDIN_PREFIX = 'https://www.linkedin.com/in/';

export function extractLinkedinHandle(input: string): string {
  let s = (input ?? '').trim();
  if (!s) return '';
  s = s.replace(/^https?:\/\//i, '');                            // strip protocol
  s = s.replace(/^www\./i, '');                                  // strip www.
  s = s.replace(/^([a-z]{2,3}\.)?linkedin\.com\/(in\/|pub\/)?/i, ''); // host + /in/ or /pub/
  s = s.replace(/^@/, '');                                       // leading @
  s = s.replace(/[?\/].*$/, '');                                 // trailing slash + query/path
  return s;
}

export function buildLinkedinUrl(handle: string): string {
  const clean = extractLinkedinHandle(handle);
  return clean ? `${LINKEDIN_PREFIX}${clean}` : '';
}
