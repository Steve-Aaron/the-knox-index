import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { DevLabel } from '@/components/primitives/DevLabel';
import { FilterChips, type ChipOption } from './links/FilterChips';
import { LinkRowCard } from './links/LinkRowCard';
import type { NewPersonDraft } from './links/CreatePersonForm';
import type {
  LinkRow, LinkCounts, LinkStatus, LinkPlatform, LinkConfidence, PersonOption,
} from '@/lib/accountLinks';
import type { Country } from '@/lib/people';
import { neutral } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

/**
 * AccountLinkPanel
 * -----------------
 * The tie-in review queue. Every account we track on a platform is offered
 * against the person the matcher thinks it belongs to, and a human confirms or
 * rejects it one row at a time.
 *
 * Nothing downstream reads a link until it is confirmed here, so the matcher's
 * guesses are inert until somebody agrees with them. The decision is written
 * straight through to BigQuery and the row is removed from the queue, so a
 * long review session never shows the same row twice.
 *
 * One job: turn proposed links into decided ones.
 */

const PLATFORMS: ReadonlyArray<ChipOption<LinkPlatform>>   = [
  { value: 'x',      label: 'X' },
  { value: 'tiktok', label: 'TikTok' },
];
const STATUSES: ReadonlyArray<ChipOption<LinkStatus>>      = [
  { value: 'proposed',  label: 'To review' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'rejected',  label: 'Rejected' },
];
const CONFIDENCES: ReadonlyArray<ChipOption<LinkConfidence>> = [
  { value: 'exact',     label: 'Handle' },
  { value: 'high',      label: 'Name' },
  { value: 'medium',    label: 'Close' },
  { value: 'low',       label: 'Surname' },
  { value: 'ambiguous', label: 'Ambiguous' },
  { value: 'none',      label: 'No match' },
];

interface Payload {
  rows:   LinkRow[];
  counts: LinkCounts[];
  people: PersonOption[];
}

export function AccountLinkPanel() {
  const [platform,   setPlatform]   = useState<LinkPlatform | null>('x');
  const [status,     setStatus]     = useState<LinkStatus | null>('proposed');
  const [confidence, setConfidence] = useState<LinkConfidence | null>(null);

  const [data,      setData]      = useState<Payload | null>(null);
  const [countries, setCountries] = useState<readonly Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [busyId,  setBusyId]  = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (platform)   q.set('platform', platform);
      if (status)     q.set('status', status);
      if (confidence) q.set('confidence', confidence);

      const res  = await fetch(`/api/admin/links?${q}`, { credentials: 'include' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
      setData(body as Payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the review queue');
    } finally {
      setLoading(false);
    }
  }, [platform, status, confidence]);

  useEffect(() => { void load(); }, [load]);

  // The country reference never changes, so it is fetched once rather than on
  // every filter change.
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/people', { credentials: 'include' });
        if (res.ok) setCountries((await res.json()).countries ?? []);
      } catch { /* the form warns when the list is empty */ }
    })();
  }, []);

  /**
   * Save the decision, then drop the row from the list rather than reloading:
   * a reload would reshuffle everything under the reviewer's cursor.
   */
  const decide = useCallback(async (linkId: string, next: LinkStatus, personId?: string | null) => {
    setBusyId(linkId);
    try {
      const res  = await fetch('/api/admin/links', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ linkId, status: next, personId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `Save failed (${res.status})`);

      setData(prev => prev && { ...prev, rows: prev.rows.filter(r => r.linkId !== linkId) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that decision');
    } finally {
      setBusyId(null);
    }
  }, []);

  /**
   * Create the person this account belongs to, then drop the row: the API
   * confirms the link in the same call, so there is nothing left to decide.
   */
  const createPerson = useCallback(async (row: LinkRow, draft: NewPersonDraft) => {
    setBusyId(row.linkId);
    try {
      const res = await fetch('/api/admin/people', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({
          ...draft,
          linkId:    row.linkId,
          platform:  row.platform,
          accountId: row.accountId,
          handle:    row.handle,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `Create failed (${res.status})`);

      setData(prev => prev && {
        ...prev,
        rows:   prev.rows.filter(r => r.linkId !== row.linkId),
        // The new person joins the picker, so the next row can attach them too.
        people: [...prev.people, {
          person_id: body.person.personId,
          name:      draft.name,
          title:     draft.displayJobTitle || null,
          country:   null,
        }].sort((a, b) => a.name.localeCompare(b.name)),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create that person');
    } finally {
      setBusyId(null);
    }
  }, []);

  /** Counts for the chips, narrowed by whatever the other filters already say. */
  const countFor = useCallback((key: keyof LinkCounts, value: string): number =>
    (data?.counts ?? [])
      .filter(c =>
        c[key] === value &&
        (key === 'platform'   || !platform   || c.platform   === platform) &&
        (key === 'status'     || !status     || c.status     === status) &&
        (key === 'confidence' || !confidence || c.confidence === confidence))
      .reduce((n, c) => n + Number(c.n), 0),
  [data, platform, status, confidence]);

  const withCounts = <T extends string>(opts: ReadonlyArray<ChipOption<T>>, key: keyof LinkCounts) =>
    opts.map(o => ({ ...o, count: countFor(key, o.value) }));

  const platformChips   = useMemo(() => withCounts(PLATFORMS,   'platform'),   [countFor]);
  const statusChips     = useMemo(() => withCounts(STATUSES,    'status'),     [countFor]);
  const confidenceChips = useMemo(() => withCounts(CONFIDENCES, 'confidence'), [countFor]);

  return (
    <View style={styles.panel}>
      <DevLabel name="AccountLinkPanel" />

      <View style={styles.head}>
        <Text style={styles.blurb}>
          Each row asks one question: is this account the same person? Confirm it and the
          link becomes real — the photo view and the platform tables both follow from it.
        </Text>
      </View>

      <View style={styles.filters}>
        <FilterChips label="Platform"   options={platformChips}   value={platform}   onChange={setPlatform} />
        <FilterChips label="Status"     options={statusChips}     value={status}     onChange={setStatus} />
        <FilterChips label="Confidence" options={confidenceChips} value={confidence} onChange={setConfidence} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator color={neutral.textMid} style={styles.spinner} />
      ) : (data?.rows.length ?? 0) === 0 ? (
        <Text style={styles.empty}>Nothing here. Either it is all reviewed, or the filters are too narrow.</Text>
      ) : (
        <View style={styles.list}>
          {data!.rows.map(row => (
            <LinkRowCard
              key={row.linkId}
              row={row}
              people={data!.people}
              countries={countries}
              busy={busyId === row.linkId}
              onDecide={decide}
              onCreate={createPerson}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel:   { gap: spacing.base },
  head:    { gap: spacing.xs },
  blurb:   { color: neutral.textMid, fontSize: 13, maxWidth: 640 },
  filters: { gap: spacing.sm },
  list:    { gap: spacing.md },
  spinner: { marginVertical: spacing.xxl },
  empty:   { color: neutral.textMid, fontSize: 14, marginVertical: spacing.xl },
  error:   { color: '#FF6B6B', fontSize: 13 },
});
