import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { DevLabel } from '@/components/primitives/DevLabel';
import { AccessRequestCard, type AccessRecord, type AccessStatus, type CardAction } from '@/components/admin/AccessRequestCard';
import { tenantById } from '@/lib/tenants';
import { neutral, glass, status as statusColour } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { font } from '@/theme/typography';

/**
 * WorldLeadersAccess
 * -------------------
 * The admin panel's one job: who may see the full World Leaders dashboard.
 *
 *   Waiting      requests from the waitlist → Approve / Refuse
 *   Has access   approved people            → Revoke
 *   Refused      refused or revoked people  → Approve
 *
 * Approving emails the person a link that signs them straight in. Refusing
 * and revoking send nothing. Knox addresses get in automatically and never
 * appear here. Reads and writes go through /api/admin/tenant-access, which
 * checks the admin allowlist on every call.
 *
 * Calls onForbidden when the server says this session is not an admin.
 */

const WORLD = tenantById('world');

type Busy = string | null;

interface Props {
  onForbidden: () => void;
}

export function WorldLeadersAccess({ onForbidden }: Props) {
  const [records, setRecords] = useState<AccessRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [notice,  setNotice]  = useState<string | null>(null);
  const [busy,    setBusy]    = useState<Busy>(null);
  const [grantEmail, setGrantEmail] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/tenant-access?tenant=${WORLD.dashboardId}`, { credentials: 'same-origin', cache: 'no-store' });
      if (res.status === 403) { onForbidden(); return; }
      if (!res.ok) throw new Error(`Could not load requests (${res.status})`);
      const data = await res.json();
      setRecords(Array.isArray(data.records) ? data.records : []);
    } catch (err: any) {
      setError(err?.message ?? 'Could not load requests');
    } finally {
      setLoading(false);
    }
  }, [onForbidden]);

  useEffect(() => { void load(); }, [load]);

  /** Approve emails the person; refuse and revoke are silent. */
  const decide = useCallback(async (email: string, next: AccessStatus, done: string) => {
    setBusy(email);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/tenant-access', {
        method:      'POST',
        credentials: 'same-origin',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ email, tenant: WORLD.dashboardId, status: next, notify: next === 'approved' }),
      });
      if (res.status === 403) { onForbidden(); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `Update failed (${res.status})`);
      setNotice(next === 'approved' && data?.emailed === false
        ? `${done} The approval email could not be sent, so let them know yourself.`
        : done);
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'Could not update access');
    } finally {
      setBusy(null);
    }
  }, [load, onForbidden]);

  const confirmThen = useCallback((message: string, run: () => void) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && !window.confirm(message)) return;
    run();
  }, []);

  const approve = (email: string) => decide(email, 'approved', `${email} now has access and has been emailed a sign-in link.`);
  const refuse  = (email: string) => confirmThen(`Refuse ${email}? They won't be emailed.`, () => { void decide(email, 'denied', `${email} was refused.`); });
  const revoke  = (email: string) => confirmThen(`Revoke access for ${email}? They lose the full view within a minute and won't be emailed.`, () => { void decide(email, 'denied', `${email} no longer has access.`); });

  const grant = useCallback(() => {
    const email = grantEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid email address'); return; }
    if (WORLD.access.allowedDomains.some(d => email.endsWith(`@${d}`))) {
      setNotice(`${email} is a Knox address, so it already gets in by signing in.`);
      return;
    }
    void decide(email, 'approved', `${email} now has access and has been emailed a sign-in link.`).then(() => setGrantEmail(''));
  }, [grantEmail, decide]);

  const groups = useMemo(() => ({
    pending:  records.filter(r => r.status === 'pending'),
    approved: records.filter(r => r.status === 'approved'),
    denied:   records.filter(r => r.status === 'denied'),
  }), [records]);

  const actionsFor = (r: AccessRecord): CardAction[] => {
    if (r.status === 'pending')  return [
      { label: 'Approve', tone: 'good', onPress: () => { void approve(r.email); } },
      { label: 'Refuse',  tone: 'bad',  onPress: () => refuse(r.email) },
    ];
    if (r.status === 'approved') return [{ label: 'Revoke', tone: 'bad', onPress: () => revoke(r.email) }];
    return [{ label: 'Approve', tone: 'good', onPress: () => { void approve(r.email); } }];
  };

  if (loading) {
    return <View style={styles.centre}><ActivityIndicator color={neutral.textMid} /></View>;
  }

  return (
    <View style={styles.wrap}>
      <DevLabel name="WorldLeadersAccess" />

      <Text style={styles.note}>
        Anyone with an {WORLD.access.allowedDomains.map(d => `@${d}`).join(' or ')} address gets in by signing in and isn't listed here.
      </Text>

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {error  ? <Text style={styles.error}>{error}</Text> : null}

      <Section title="Waiting for approval" count={groups.pending.length} empty="No one is waiting.">
        {groups.pending.map(r => (
          <AccessRequestCard key={r.email} record={r} actions={actionsFor(r)} busy={busy === r.email} />
        ))}
      </Section>

      <Section title="Has access" count={groups.approved.length} empty="No one has been approved yet.">
        <View style={styles.grantRow}>
          <TextInput
            value={grantEmail}
            onChangeText={setGrantEmail}
            onSubmitEditing={grant}
            placeholder="Give someone access: name@example.com"
            placeholderTextColor={neutral.textMid}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />
          <Pressable onPress={grant} disabled={busy !== null} style={({ pressed }) => [styles.grantBtn, (pressed || busy !== null) && { opacity: 0.7 }]}>
            <Text style={styles.grantBtnText}>Give access</Text>
          </Pressable>
        </View>
        {groups.approved.map(r => (
          <AccessRequestCard key={r.email} record={r} actions={actionsFor(r)} busy={busy === r.email} />
        ))}
      </Section>

      {groups.denied.length > 0 ? (
        <Section title="Refused or revoked" count={groups.denied.length} empty="">
          {groups.denied.map(r => (
            <AccessRequestCard key={r.email} record={r} actions={actionsFor(r)} busy={busy === r.email} />
          ))}
        </Section>
      ) : null}
    </View>
  );
}

function Section({ title, count, empty, children }: {
  title: string; count: number; empty: string; children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}<Text style={styles.count}>  {count}</Text></Text>
      {count === 0 && empty ? <Text style={styles.note}>{empty}</Text> : null}
      <View style={styles.list}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:    { gap: spacing.lg },
  centre:  { paddingVertical: spacing.xl, alignItems: 'center' },
  note:    { fontFamily: font.ui, fontSize: 12, color: neutral.textMid },
  notice:  { fontFamily: font.ui, fontSize: 13, color: statusColour.good },
  error:   { fontFamily: font.ui, fontSize: 13, color: statusColour.bad },
  section: { gap: spacing.sm },
  sectionTitle: { fontFamily: font.bold, fontSize: 16, color: neutral.text },
  count:   { fontFamily: font.ui, fontSize: 14, color: neutral.textMid },
  list:    { gap: spacing.sm },
  grantRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  input: {
    flex:              1,
    minWidth:          220,
    paddingHorizontal: spacing.sm,
    paddingVertical:   9,
    borderRadius:      radius.md,
    borderWidth:       1,
    borderColor:       glass.border,
    backgroundColor:   glass.fill,
    color:             neutral.text,
    fontFamily:        font.ui,
    fontSize:          13,
    ...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} }),
  },
  grantBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical:   9,
    borderRadius:      radius.pill,
    backgroundColor:   statusColour.good,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  grantBtnText: { fontFamily: font.bold, fontSize: 12, color: '#0B0B10' },
});
