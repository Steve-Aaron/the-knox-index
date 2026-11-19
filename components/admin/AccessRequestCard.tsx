import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { neutral, glass, status as statusColour } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { font } from '@/theme/typography';

/**
 * AccessRequestCard
 * ------------------
 * One person in the World Leaders access panel: their email (read live from
 * Firebase Auth — the access store holds no identifying fields), when they
 * asked, who decided, and the actions that fit their status.
 *
 * Name, company and the rest live in Brevo, tied to this person by their
 * Firebase uid. This card shows who and when; the detail is a click away in
 * Brevo.
 *
 * One job: show one access record and its actions.
 */

export type AccessStatus = 'approved' | 'pending' | 'denied';

export interface AccessRecord {
  firebaseUid: string;
  /** Read live from Firebase Auth; null if the account has since gone. */
  email:         string | null;
  status:        AccessStatus;
  requestedAt:   string | null;
  decidedAt:     string | null;
  /** The deciding admin's uid. */
  decidedBy:     string | null;
  /** That admin's email, resolved for display. */
  decidedByEmail?: string | null;
}

export interface CardAction {
  label:   string;
  tone:    'good' | 'bad' | 'plain';
  onPress: () => void;
}

interface Props {
  record:  AccessRecord;
  actions: CardAction[];
  /** True while any action on this card is in flight. */
  busy:    boolean;
}

function day(raw: string | null): string | null {
  return raw ? raw.slice(0, 10).split('-').reverse().join('-') : null;
}

export function AccessRequestCard({ record: r, actions, busy }: Props) {
  const asked   = day(r.requestedAt);
  const decided = day(r.decidedAt);
  const decider = r.decidedByEmail || r.decidedBy;

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.identity}>
          <Text style={styles.email} selectable>{r.email ?? '(no email on file)'}</Text>
          <Text style={styles.hint}>Full details in Brevo</Text>
        </View>
        <View style={styles.actions}>
          {actions.map(a => (
            <Pressable
              key={a.label}
              onPress={a.onPress}
              disabled={busy}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.btn,
                a.tone === 'good' && styles.btnGood,
                a.tone === 'bad'  && styles.btnBad,
                (busy || pressed) && { opacity: 0.6 },
              ]}
            >
              <Text style={[styles.btnText, a.tone === 'good' && styles.btnTextGood]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.meta}>
        {asked ? <Text style={styles.metaText}><Text style={styles.metaLabel}>Asked: </Text>{asked}</Text> : null}
        {decided && r.status !== 'pending' ? (
          <Text style={styles.metaText}>
            <Text style={styles.metaLabel}>{r.status === 'approved' ? 'Approved' : 'Refused'}: </Text>
            {decided}{decider ? ` by ${decider}` : ''}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding:         spacing.md,
    borderRadius:    radius.md,
    borderWidth:     1,
    borderColor:     glass.border,
    backgroundColor: glass.fill,
    gap:             spacing.xs,
  },
  top: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    gap:            spacing.sm,
  },
  identity: { flexShrink: 1, minWidth: 200, gap: 2 },
  email:    { fontFamily: font.bold, fontSize: 14, color: neutral.text },
  hint:     { fontFamily: font.ui, fontSize: 11, color: neutral.textMid },
  meta:     { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: 2 },
  metaText: { fontFamily: font.ui, fontSize: 11, color: neutral.textMid },
  metaLabel: { fontFamily: font.bold, color: neutral.textMid },
  actions:  { flexDirection: 'row', gap: spacing.xs },
  btn: {
    paddingHorizontal: spacing.md,
    paddingVertical:   7,
    borderRadius:      radius.pill,
    borderWidth:       1,
    borderColor:       glass.borderHi,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  btnGood:     { backgroundColor: statusColour.good, borderColor: statusColour.good },
  btnBad:      { borderColor: statusColour.bad },
  btnText:     { fontFamily: font.bold, fontSize: 12, color: neutral.text },
  btnTextGood: { color: '#0B0B10' },
});
