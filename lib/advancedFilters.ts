/**
 * lib/advancedFilters.ts
 * -----------------------
 * Type-safe advanced filter model for the Post Feed. Each rule is
 * { field, op, value } and rules combine with AND. Drives the
 * <AdvancedFilterPanel /> UI and the applyAdvancedFilter() runtime.
 *
 * Adding a new filter column:
 *   1. Add the id to FieldId
 *   2. Add metadata to FIELD_META (label + type)
 *   3. applyAdvancedFilter handles it automatically
 */

import type { PostRecord } from '@/data/types';

// ── Field IDs — must match keys on PostRecord (or be aliases for derived values) ──

export type FieldId =
  | 'caption'
  | 'politicianName'
  | 'profile'
  | 'partyKey'
  | 'views'
  | 'likes'
  | 'comments'
  | 'shares'
  | 'saves'
  | 'engagementRate'
  | 'postDate';

export type FieldType = 'string' | 'number' | 'date';

export interface FieldMeta {
  label: string;
  type:  FieldType;
}

export const FIELD_META: Record<FieldId, FieldMeta> = {
  caption:        { label: 'Caption',         type: 'string' },
  politicianName: { label: 'Politician name', type: 'string' },
  profile:        { label: 'Handle',          type: 'string' },
  partyKey:       { label: 'Party',           type: 'string' },
  views:          { label: 'Views',           type: 'number' },
  likes:          { label: 'Likes',           type: 'number' },
  comments:       { label: 'Comments',        type: 'number' },
  shares:         { label: 'Shares',          type: 'number' },
  saves:          { label: 'Saves',           type: 'number' },
  engagementRate: { label: 'Engagement %',    type: 'number' },
  postDate:       { label: 'Post date',       type: 'date'   },
};

export const FIELD_OPTIONS: { id: FieldId; label: string }[] =
  (Object.keys(FIELD_META) as FieldId[]).map(id => ({ id, label: FIELD_META[id].label }));

// ── Operators ─────────────────────────────────────────────────────────────────

export type StringOp = 'contains' | 'equals' | 'startsWith' | 'notContains' | 'matches';
export type NumberOp = 'eq' | 'lt' | 'lte' | 'gt' | 'gte' | 'between';
export type DateOp   = 'on' | 'before' | 'after' | 'between';

export type AnyOp = StringOp | NumberOp | DateOp;

const STRING_OPS: { id: StringOp; label: string }[] = [
  { id: 'contains',    label: 'contains'     },
  { id: 'notContains', label: 'does not contain' },
  { id: 'equals',      label: 'equals'       },
  { id: 'startsWith',  label: 'starts with'  },
  { id: 'matches',     label: 'matches regex' },
];

const NUMBER_OPS: { id: NumberOp; label: string }[] = [
  { id: 'eq',      label: '='        },
  { id: 'gt',      label: '>'        },
  { id: 'gte',     label: '≥'        },
  { id: 'lt',      label: '<'        },
  { id: 'lte',     label: '≤'        },
  { id: 'between', label: 'between'  },
];

const DATE_OPS: { id: DateOp; label: string }[] = [
  { id: 'on',      label: 'on'       },
  { id: 'before',  label: 'before'   },
  { id: 'after',   label: 'after'    },
  { id: 'between', label: 'between'  },
];

export function opsForField(field: FieldId): { id: AnyOp; label: string }[] {
  switch (FIELD_META[field].type) {
    case 'string': return STRING_OPS;
    case 'number': return NUMBER_OPS;
    case 'date':   return DATE_OPS;
  }
}

export function defaultOpForField(field: FieldId): AnyOp {
  switch (FIELD_META[field].type) {
    case 'string': return 'contains';
    case 'number': return 'gte';
    case 'date':   return 'after';
  }
}

// ── Rule shape ────────────────────────────────────────────────────────────────

export interface Rule {
  /** UUID-style key for React lists — generated on creation. */
  id:     string;
  field:  FieldId;
  op:     AnyOp;
  /** Primary value (free-text from the user). Parsed per field type at evaluation time. */
  value:  string;
  /** Second value, only used when op === 'between'. */
  value2?: string;
}

export type AdvancedFilter = Rule[];

let _ruleIdCounter = 0;
export function newRuleId(): string {
  _ruleIdCounter += 1;
  return `rule-${Date.now()}-${_ruleIdCounter}`;
}

export function newRule(field: FieldId = 'caption'): Rule {
  return {
    id:    newRuleId(),
    field,
    op:    defaultOpForField(field),
    value: '',
  };
}

// ── Runtime evaluation ────────────────────────────────────────────────────────

/** Extract the raw value of a field off a PostRecord. engagementRate is derived. */
function getValue(post: PostRecord, field: FieldId): unknown {
  if (field === 'engagementRate') {
    return post.views > 0
      ? ((post.likes + post.comments + post.saves + post.shares) / post.views) * 100
      : 0;
  }
  return (post as unknown as Record<string, unknown>)[field];
}

function matchString(postValue: unknown, op: StringOp, target: string): boolean {
  if (postValue == null) return false;
  const raw = String(postValue);
  const t   = target.trim();
  if (t === '') return true;   // empty input acts as 'no constraint'

  // Regex operator: treat the input as a JS regular expression, case-insensitive.
  // Match against the RAW value (not lowercased) — lowercasing would corrupt
  // escapes such as \D \W \S \B. An invalid pattern matches nothing rather than
  // throwing, so a half-typed regex never breaks the feed.
  if (op === 'matches') {
    try {
      return new RegExp(t, 'i').test(raw);
    } catch {
      return false;
    }
  }

  const a = raw.toLowerCase();
  const b = t.toLowerCase();
  switch (op) {
    case 'contains':    return a.includes(b);
    case 'notContains': return !a.includes(b);
    case 'equals':      return a === b;
    case 'startsWith':  return a.startsWith(b);
  }
}

function matchNumber(postValue: unknown, op: NumberOp, a: string, b: string | undefined): boolean {
  const v  = Number(postValue);
  const t1 = Number(a);
  if (Number.isNaN(v) || Number.isNaN(t1)) return false;
  if (op === 'between') {
    const t2 = Number(b ?? '');
    if (Number.isNaN(t2)) return false;
    const lo = Math.min(t1, t2);
    const hi = Math.max(t1, t2);
    return v >= lo && v <= hi;
  }
  switch (op) {
    case 'eq':  return v === t1;
    case 'gt':  return v >  t1;
    case 'gte': return v >= t1;
    case 'lt':  return v <  t1;
    case 'lte': return v <= t1;
  }
}

function matchDate(postValue: unknown, op: DateOp, a: string, b: string | undefined): boolean {
  if (postValue == null) return false;
  // Compare ISO date strings as lex strings (YYYY-MM-DD comparison is correct).
  const v  = String(postValue).slice(0, 10);
  const t1 = a.trim().slice(0, 10);
  if (!v || !t1) return false;
  if (op === 'between') {
    const t2 = (b ?? '').trim().slice(0, 10);
    if (!t2) return false;
    const lo = t1 <= t2 ? t1 : t2;
    const hi = t1 <= t2 ? t2 : t1;
    return v >= lo && v <= hi;
  }
  switch (op) {
    case 'on':     return v === t1;
    case 'before': return v <  t1;
    case 'after':  return v >  t1;
  }
}

/**
 * Apply all rules to the post list. Rules are AND-combined.
 * Rules with empty value (or invalid types) silently match all posts —
 * better UX than dropping every result while the user is mid-typing.
 */
export function applyAdvancedFilter(posts: PostRecord[], rules: AdvancedFilter): PostRecord[] {
  if (rules.length === 0) return posts;

  // Pre-validate each rule once: filter out incomplete rules so empty input
  // doesn't cause every post to be evaluated and rejected mid-typing.
  const liveRules = rules.filter(r => {
    if (r.value.trim() === '' && (r.op !== 'between' || (r.value2 ?? '').trim() === '')) {
      return false;
    }
    return true;
  });

  if (liveRules.length === 0) return posts;

  return posts.filter(post =>
    liveRules.every(rule => {
      const v = getValue(post, rule.field);
      const type = FIELD_META[rule.field].type;
      if (type === 'string') return matchString(v, rule.op as StringOp, rule.value);
      if (type === 'number') return matchNumber(v, rule.op as NumberOp, rule.value, rule.value2);
      return matchDate(v, rule.op as DateOp, rule.value, rule.value2);
    })
  );
}
