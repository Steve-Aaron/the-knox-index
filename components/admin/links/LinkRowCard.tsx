import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { DevLabel } from '@/components/primitives/DevLabel';
import { LinkSide } from './LinkSide';
import { ConfidenceChip } from './ConfidenceChip';
import { CreatePersonForm, type NewPersonDraft } from './CreatePersonForm';
import { fmtCount } from '@/lib/format';
import type { LinkRow, LinkStatus, PersonOption } from '@/lib/accountLinks';
import type { Country } from '@/lib/people';
import { neutral, knox, party } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';

/**
 * LinkRowCard
 * ------------
 * One proposed tie-in, laid out as two identities side by side with the
 * matcher's reasoning between them, so the reviewer can answer 'same person?'
 * from the photos and names alone.
 *
 * Confirm and reject are the two primary actions. 'Attach someone else' is the
 * escape hatch for the ambiguous ones. 'New person' is the last resort: the
 * account belongs to somebody we do not have at all, so there is nothing to
 * attach until one is created.
 *
 * One job: present one decision.
 */

interface Props {
  row:       LinkRow;
  people:    readonly PersonOption[];
  countries: readonly Country[];
  busy:      boolean;
  onDecide:  (linkId: string, status: LinkStatus, personId?: string | null) => void;
  onCreate:  (row: LinkRow, draft: NewPersonDraft) => void;
}

const STATUS_TONE: Record<LinkStatus, string> = {
  confirmed: party.green.base,
  rejected:  party.labour.base,
  proposed:  neutral.stroke,
};

export function LinkRowCard({ row, people, countries, busy, onDecide, onCreate }: Props) {
  const [picking,  setPicking]  = useState(false);
  const [creating, setCreating] = useState(false);
  const [search,   setSearch]   = useState('');

  const handleOf = (h: string | null) =>
    !h ? null : row.platform === 'x' ? `@${h.replace(/^@/, '')}` : h;

  const attach = useCallback((personId: string) => {
    setPicking(false);
    setSearch('');
    onDecide(row.linkId, 'confirmed', personId);
  }, [onDecide, row.linkId]);

  const create = useCallback((draft: NewPersonDraft) => {
    setCreating(false);
    onCreate(row, draft);
  }, [onCreate, row]);

  /** Only one panel open at a time, so the card never grows two forms deep. */
  const togglePicking  = useCallback(() => { setCreating(false); setPicking(v => !v); }, []);
  const toggleCreating = useCallback(() => { setPicking(false);  setCreating(v => !v); }, []);

  // Show the matcher's own runners-up first: they are the likely answer when a
  // row is ambiguous. Free search is there for everything else.
  const term    = search.trim().toLowerCase();
  const results = term
    ? people.filter(p => p.name.toLowerCase().includes(term)).slice(0, 8)
    : row.alternatives.map(a => people.find(p => p.person_id === a.person_id)).filter(Boolean).slice(0, 8) as PersonOption[];

  return (
    <View style={[styles.card, { borderLeftColor: STATUS_TONE[row.status], borderLeftWidth: 3 }]}>
      <DevLabel name="LinkRowCard" />

      <View style={styles.sides}>
        <LinkSide
          label={row.platform === 'x' ? 'X account' : 'TikTok account'}
          name={row.accountName}
          photo={row.accountPhoto}
          handle={handleOf(row.handle)}
          meta={[
            row.followers ? `${fmtCount(row.followers)} followers` : null,
            row.bio?.slice(0, 70),
          ]}
        />
        <Text style={styles.arrow}>→</Text>
        <LinkSide
          label="Person"
          name={row.personName}
          photo={row.personPhoto}
          muted={!row.personId}
          meta={[row.personTitle, row.personCountry]}
        />
      </View>

      <View style={styles.footer}>
        <ConfidenceChip confidence={row.confidence} score={row.score} method={row.method} />
        {row.matchedOn ? <Text style={styles.matchedOn}>matched on “{row.matchedOn}”</Text> : null}
        {row.reviewedBy ? <Text style={styles.matchedOn}>{row.status} by {row.reviewedBy}</Text> : null}

        <View style={styles.actions}>
          {row.personId ? (
            <Pressable
              disabled={busy}
              onPress={() => onDecide(row.linkId, 'confirmed')}
              style={[styles.btn, styles.btnConfirm, busy && styles.btnBusy]}
            >
              <Text style={styles.btnConfirmText}>Same person</Text>
            </Pressable>
          ) : null}
          <Pressable
            disabled={busy}
            onPress={() => onDecide(row.linkId, 'rejected', null)}
            style={[styles.btn, busy && styles.btnBusy]}
          >
            <Text style={styles.btnText}>Not a match</Text>
          </Pressable>
          <Pressable disabled={busy} onPress={togglePicking} style={[styles.btn, busy && styles.btnBusy]}>
            <Text style={styles.btnText}>{picking ? 'Cancel' : 'Attach someone else'}</Text>
          </Pressable>
          <Pressable disabled={busy} onPress={toggleCreating} style={[styles.btn, busy && styles.btnBusy]}>
            <Text style={styles.btnText}>{creating ? 'Cancel' : 'New person'}</Text>
          </Pressable>
        </View>
      </View>

      {picking ? (
        <View style={styles.picker}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search people by name"
            placeholderTextColor={neutral.textMid}
            style={styles.search}
            autoFocus
          />
          {results.length === 0 ? (
            <Pressable onPress={toggleCreating} style={styles.result}>
              <Text style={styles.empty}>
                {term ? `Nobody called '${search.trim()}'. Create them?` : 'No runners-up — search for a name, or create a new person'}
              </Text>
            </Pressable>
          ) : results.map(p => (
            <Pressable key={p.person_id} onPress={() => attach(p.person_id)} style={styles.result}>
              <Text style={styles.resultName}>{p.name}</Text>
              <Text style={styles.resultMeta}>{[p.title, p.country].filter(Boolean).join(' · ')}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {creating ? (
        <CreatePersonForm
          accountName={row.accountName}
          accountBio={row.bio}
          countries={countries}
          busy={busy}
          onCancel={() => setCreating(false)}
          onCreate={create}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: neutral.ink, borderRadius: radius.md,
    borderWidth: 1, borderColor: neutral.stroke,
    padding: spacing.base, gap: spacing.md,
  },
  sides:      { flexDirection: 'row', alignItems: 'center', gap: spacing.base, flexWrap: 'wrap' },
  arrow:      { color: neutral.textMid, fontSize: 18 },
  footer:     { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.md },
  matchedOn:  { color: neutral.textMid, fontSize: 12 },
  actions:    { flexDirection: 'row', gap: spacing.sm, marginLeft: 'auto', flexWrap: 'wrap' },
  btn: {
    paddingVertical: spacing.sm, paddingHorizontal: spacing.base,
    borderRadius: radius.pill, borderWidth: 1, borderColor: neutral.stroke,
  },
  btnBusy:         { opacity: 0.4 },
  btnConfirm:      { borderColor: knox.primaryOrange, backgroundColor: 'rgba(255, 147, 99, 0.12)' },
  btnText:         { color: neutral.textMid, fontSize: 13 },
  btnConfirmText:  { color: neutral.text, fontSize: 13, fontWeight: '600' },
  picker:     { gap: spacing.xs, borderTopWidth: 1, borderTopColor: neutral.stroke, paddingTop: spacing.md },
  search: {
    backgroundColor: neutral.felt, color: neutral.text,
    borderWidth: 1, borderColor: neutral.stroke, borderRadius: radius.sm,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md, fontSize: 14,
  },
  empty:      { color: neutral.textMid, fontSize: 12, paddingVertical: spacing.sm },
  result:     { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.sm },
  resultName: { color: neutral.text, fontSize: 14 },
  resultMeta: { color: neutral.textMid, fontSize: 12 },
});
