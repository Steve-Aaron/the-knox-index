import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { neutral, glass, status as statusColour } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { font } from '@/theme/typography';
import { REGION_LABELS, type RegionKey } from '@/lib/regions';

/**
 * AccessRequestCard
 * ------------------
 * One person in the World Leaders access panel: who they are, what they told
 * us, when they asked and who decided, plus the actions that fit their status.
 *
 * One job: show one access record and its actions.
 */

export type AccessStatus = 'approved' | 'pending' | 'denied';

export interface AccessRecord {
  email:           string;
  status:          AccessStatus;
  requestedAt:     string | null;
  decidedAt:       string | null;
  decidedBy:       string | null;
  requesterName:   string | null;
  organisation:    string | null;
  jobRole:         string | null;
  reason:          string | null;
  areasOfInterest: string | null;
  referralSource:  string | null;
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

function areas(raw: string | null): string | null {
  if (!raw) return null;
  return raw.split(',').map(r => r.trim()).filter(Boolean)
    .map(r => REGION_LABELS[r as RegionKey] ?? r).join(', ') || null;
}

export function AccessRequestCard({ record: r, actions, busy }: Props) {
  const who = [r.requesterName, r.jobRole, r.organisation].filter(Boolean).join(' · ');
  const details: [string, string | null][] = [
    ['Interested in', areas(r.areasOfInterest)],
    ['Heard via',     r.referralSource],
  ];
  const asked   = day(r.requestedAt);
  const decided = day(r.decidedAt);

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.identity}>
          <Text style={styles.email} selectable>{r.email}</Text>
          {who ? <Text style={styles.who}>{who}</Text> : null}
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

      {/* 'Wants to: …' and LinkedIn from the waitlist form (older requests: a free-text reason) */}
      {r.reason ? <Text style={styles.reason} selectable>{r.reason}</Text> : null}

      <View style={styles.meta}>
        {details.filter(([, v]) => v).map(([label, value]) => (
          <Text key={label} style={styles.metaText}>
            <Text style={styles.metaLabel}>{label}: </Text>{value}
          </Text>
        ))}
        {asked ? <Text style={styles.metaText}><Text style={styles.metaLabel}>Asked: </Text>{asked}</Text> : null}
        {decided && r.status !== 'pending' ? (
          <Text style={styles.metaText}>
            <Text style={styles.metaLabel}>{r.status === 'approved' ? 'Approved' : 'Refused'}: </Text>
            {decided}{r.decidedBy ? ` by ${r.decidedBy}` : ''}
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
  who:      { fontFamily: font.ui, fontSize: 12, color: neutral.textMid },
  reason:   { fontFamily: font.ui, fontSize: 13, lineHeight: 19, color: neutral.text },
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
