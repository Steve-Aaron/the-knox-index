/**
 * lib/search.ts
 * --------------
 * The header search: the index shape /api/search returns, and the matcher the
 * client runs over it on every keystroke. Isomorphic — no server imports.
 *
 * The index is the whole tenant's searchable set (a few hundred rows), so it
 * is fetched once and filtered locally instead of querying per keystroke.
 *
 * One job: turn a query into the ranked hits the dropdown shows.
 */

import type { GroupKey } from '@/theme/colors';

/** One searchable account. */
export interface SearchPerson {
  id:             string;
  name:           string;
  /** Bare handle, no '@' — the /account/[handle] route segment. */
  handle:         string;
  groupKey:       GroupKey;
  /** Always the real party, whatever the tenant groups by. */
  partyLabel:     string;
  avatarInitials: string;
  avatarUrl?:     string;
  /** Outside the guest leaderboard's top 5 — opens only for signed-in users. */
  locked:         boolean;
}

/** One searchable group: a party on The Knox Index, a region on World Leaders. */
export interface SearchGroup {
  key:   GroupKey;
  label: string;
}

export interface SearchIndex {
  people: SearchPerson[];
  groups: SearchGroup[];
}

export type SearchHit =
  | { type: 'person'; person: SearchPerson }
  | { type: 'group';  group:  SearchGroup };

/** Most hits the dropdown shows. */
export const SEARCH_LIMIT = 5;

/**
 * How well `text` matches `q` (both lowercased): 3 = starts with it, 2 = a
 * word starts with it, 1 = contains it, 0 = no match.
 */
function matchScore(text: string, q: string): number {
  const t = text.toLowerCase();
  if (t.startsWith(q)) return 3;
  if (t.split(/[\s\-_.']+/).some(w => w.startsWith(q))) return 2;
  return t.includes(q) ? 1 : 0;
}

/**
 * Ranked hits for `query`: best match first, groups before people on a tie
 * (there are few groups, so an exact party name should not be buried under
 * its members), then alphabetical. Empty query → no hits.
 */
export function searchIndex(index: SearchIndex, query: string, limit = SEARCH_LIMIT): SearchHit[] {
  const q = query.trim().toLowerCase().replace(/^@+/, '');
  if (!q) return [];

  const scored: { hit: SearchHit; score: number; label: string; tie: number }[] = [];

  for (const group of index.groups) {
    const score = matchScore(group.label, q);
    if (score) scored.push({ hit: { type: 'group', group }, score, label: group.label, tie: 0 });
  }
  for (const person of index.people) {
    const score = Math.max(matchScore(person.name, q), matchScore(person.handle, q));
    if (score) scored.push({ hit: { type: 'person', person }, score, label: person.name, tie: 1 });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.tie - b.tie || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map(s => s.hit);
}
