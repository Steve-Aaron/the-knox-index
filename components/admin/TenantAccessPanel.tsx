import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { DevLabel } from '@/components/primitives/DevLabel';
import { neutral, glass, accent, knox } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { font } from '@/theme/typography';
import { TENANTS } from '@/lib/tenants';
import { REGION_LABELS, type RegionKey } from '@/lib/regions';

/**
 * TenantAccessPanel
 * ------------------
 * Admin control for gated dashboards: who has asked for access, who has been
 * approved, and the ability to approve, deny or pre-approve an address.
 *
 * Users whose email domain is on a tenant's allowlist (see lib/tenants.ts)
 * never appear here — they are admitted without a record.
 *
 * One job: manage tenant_access rows.
 */

type Status = 'approved' | 'pending' | 'denied';

interface AccessRecord {
  email:       string;
  tenantId:    string;
  status:      Status;
  requestedAt: string | null;
  decidedAt:   string | null;
  decidedBy:   string | null;
  note:        string | null;
  requesterName:  string | null;
  organisation:   string | null;
  jobRole:        string | null;
  reason:         string | null;
  areasOfInterest: string | null;
  referralSource: string | null;
}

const GATED_TENANTS = TENANTS.filter(t => t.access.mode !== 'public');

const STATUS_COLOUR: Record<Status, string> = {
  approved: accent.mint,
  pending:  accent.amber,
  denied:   knox.primaryPink,
};

function shortDate(raw: string | null): string {
  if (!raw) return '—';
  return raw.slice(0, 10);
}

export function TenantAccessPanel() {
  // Identified by dashboard id — the same value the data is keyed by.
  const [dashboardId, setDashboardId] = useState<number>(GATED_TENANTS[0]?.dashboardId ?? 0);
  const [records,  setRecords]  = useState<AccessRecord[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [busy,     setBusy]     = useState<string | null>(null);
  const [openRow,  setOpenRow]  = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!dashboardId) return;
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/admin/tenant-access?tenant=${dashboardId}`, { credentials: 'same-origin', cache: 'no-store' });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      setRecords(Array.isArray(data.records) ? data.records : []);
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Could not load access records');
    } finally {
      setLoading(false);
    }
  }, [dashboardId]);

  useEffect(() => { void load(); }, [load]);

  const decide = useCallback(async (email: string, status: Status) => {
    setBusy(`${email}:${status}`);
    setError(null);
    try {
      const res = await fetch('/api/admin/tenant-access', {
        method:      'POST',
        credentials: 'same-origin',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ email, tenant: dashboardId, status }),
      });
      if (!res.ok) throw new Error(`Update failed (${res.status})`);
      await load();
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Could not update access');
    } finally {
      setBusy(null);
    }
  }, [dashboardId, load]);

  const addApproved = useCallback(async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email.includes('@')) { setError('Enter a valid email address'); return; }
    await decide(email, 'approved');
    setNewEmail('');
  }, [newEmail, decide]);

  const pending = useMemo(() => records.filter(r => r.status === 'pending').length, [records]);

  const areaLabels = useCallback((areas: string | null) => {
    if (!areas) return '—';
    return areas.split(',').map(r => r.trim()).filter(Boolean)
      .map(r => REGION_LABELS[r as RegionKey] ?? r).join(', ') || '—';
  }, []);

  if (GATED_TENANTS.length === 0) return null;

  return (
    <View style={styles.section}>
      <DevLabel name="TenantAccessPanel" />

      <View style={styles.headerRow}>
        <Text style={styles.title}>
          Dashboard access{pending > 0 ? `  ·  ${pending} awaiting` : ''}
        </Text>
        <View style={styles.tenantChips}>
          {GATED_TENANTS.map(t => (
            <Pressable
              key={t.dashboardId}
              onPress={() => setDashboardId(t.dashboardId)}
              style={[styles.chip, dashboardId === t.dashboardId && styles.chipActive]}
            >
              <Text style={[styles.chipText, dashboardId === t.dashboardId && styles.chipTextActive]}>
                {t.brand.nameShort} · {t.dashboardId}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Text style={styles.note}>
        Anyone signing in from {GATED_TENANTS.find(t => t.dashboardId === dashboardId)?.access.allowedDomains.map(d => `@${d}`).join(' or ')} is admitted automatically and never appears below. Approving or denying emails the requester. Tap a row to read their answers.
      </Text>

      <View style={styles.addRow}>
        <TextInput
          value={newEmail}
          onChangeText={setNewEmail}
          placeholder="name@client.com"
          placeholderTextColor={neutral.textMid}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
        <Pressable onPress={() => { void addApproved(); }} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Pre-approve</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <View style={styles.centre}><ActivityIndicator color={neutral.textMid} /></View>
      ) : records.length === 0 ? (
        <Text style={styles.note}>No access records yet for this dashboard.</Text>
      ) : (
        <View style={styles.table}>
          <View style={[styles.row, styles.rowHeader]}>
            <Text style={[styles.cell, styles.cellEmail, styles.headerCell]}>EMAIL</Text>
            <Text style={[styles.cell, styles.cellStatus, styles.headerCell]}>STATUS</Text>
            <Text style={[styles.cell, styles.cellDate, styles.headerCell]}>REQUESTED</Text>
            <Text style={[styles.cell, styles.cellDate, styles.headerCell]}>DECIDED</Text>
            <Text style={[styles.cell, styles.cellActions, styles.headerCell]}>ACTIONS</Text>
          </View>

          {records.map(r => {
            const rowKey = `${r.tenantId}:${r.email}`;
            const isOpen = openRow === rowKey;
            return (
            <View key={rowKey}>
            <Pressable onPress={() => setOpenRow(isOpen ? null : rowKey)} style={styles.row}>
              <View style={styles.cellEmailWrap}>
                <Text style={[styles.cell, styles.cellEmailText]} numberOfLines={1}>{r.email}</Text>
                {r.requesterName || r.organisation ? (
                  <Text style={styles.cellSub} numberOfLines={1}>
                    {[r.requesterName, r.organisation].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.cell, styles.cellStatus, { color: STATUS_COLOUR[r.status] ?? neutral.textMid }]}>
                {r.status}
              </Text>
              <Text style={[styles.cell, styles.cellDate]}>{shortDate(r.requestedAt)}</Text>
              <Text style={[styles.cell, styles.cellDate]}>{shortDate(r.decidedAt)}</Text>
              <View style={[styles.cellActions, styles.actionsWrap]}>
                <Pressable
                  onPress={() => { void decide(r.email, 'approved'); }}
                  disabled={busy !== null || r.status === 'approved'}
                  style={[styles.smallBtn, r.status === 'approved' && styles.smallBtnDisabled]}
                >
                  <Text style={styles.smallBtnText}>Approve</Text>
                </Pressable>
                <Pressable
                  onPress={() => { void decide(r.email, 'denied'); }}
                  disabled={busy !== null || r.status === 'denied'}
                  style={[styles.smallBtn, r.status === 'denied' && styles.smallBtnDisabled]}
                >
                  <Text style={styles.smallBtnText}>Deny</Text>
                </Pressable>
              </View>
            </Pressable>

            {isOpen && (
              <View style={styles.detail}>
                <DetailLine label="Role"      value={r.jobRole || '—'} />
                <DetailLine label="Interested in" value={areaLabels(r.areasOfInterest)} />
                <DetailLine label="Heard via" value={r.referralSource || '—'} />
                <DetailLine label="Decided by" value={r.decidedBy || '—'} />
                <Text style={styles.detailLabel}>Reason</Text>
                <Text style={styles.detailReason}>{r.reason || '—'}</Text>
              </View>
            )}
            </View>
          );})}
        </View>
      )}
    </View>
  );
}

/** One label/value line inside an expanded request. */
function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom:     spacing.xl,
    padding:          spacing.lg,
    borderRadius:     radius.lg,
    borderWidth:      1,
    borderColor:      glass.border,
    backgroundColor:  glass.card,
    gap:              spacing.sm,
  },
  headerRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    flexWrap:       'wrap',
    gap:            spacing.sm,
  },
  title:       { fontFamily: font.bold, fontSize: 16, color: neutral.text },
  tenantChips: { flexDirection: 'row', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   4,
    borderRadius:      radius.pill,
    borderWidth:       1,
    borderColor:       glass.border,
  },
  chipActive:     { borderColor: knox.primaryPink, backgroundColor: glass.fillHi },
  chipText:       { fontFamily: font.ui, fontSize: 12, color: neutral.textMid },
  chipTextActive: { color: neutral.text },
  note:  { fontFamily: font.ui, fontSize: 12, color: neutral.textMid },
  error: { fontFamily: font.ui, fontSize: 12, color: knox.primaryPink },
  centre: { paddingVertical: spacing.lg, alignItems: 'center' },

  addRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginTop: spacing.xs },
  input: {
    flex:              1,
    paddingHorizontal: spacing.sm,
    paddingVertical:   8,
    borderRadius:      radius.md,
    borderWidth:       1,
    borderColor:       glass.border,
    backgroundColor:   glass.fill,
    color:             neutral.text,
    fontFamily:        font.ui,
    fontSize:          13,
    ...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} }),
  },
  primaryBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical:   9,
    borderRadius:      radius.md,
    backgroundColor:   knox.primaryPink,
  },
  primaryBtnText: { fontFamily: font.bold, fontSize: 13, color: neutral.text },

  table:     { marginTop: spacing.sm },
  row:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: glass.border, gap: spacing.sm },
  rowHeader: { borderBottomColor: glass.borderHi },
  cell:        { fontFamily: font.ui, fontSize: 12, color: neutral.text },
  headerCell:  { fontFamily: font.bold, fontSize: 10, color: neutral.textMid, letterSpacing: 0.6 },
  cellEmail:     { flex: 3 },
  cellEmailWrap: { flex: 3 },
  cellEmailText: { fontFamily: font.ui, fontSize: 12, color: neutral.text },
  cellSub:       { fontFamily: font.ui, fontSize: 10, color: neutral.textMid, marginTop: 1 },
  detail: {
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom:      spacing.xs,
    borderRadius:      radius.md,
    backgroundColor:   glass.fill,
    gap:               4,
  },
  detailLine:   { flexDirection: 'row', gap: spacing.sm },
  detailLabel:  { fontFamily: font.bold, fontSize: 10, color: neutral.textMid, letterSpacing: 0.6, textTransform: 'uppercase', minWidth: 78 },
  detailValue:  { fontFamily: font.ui, fontSize: 12, color: neutral.text, flex: 1 },
  detailReason: { fontFamily: font.ui, fontSize: 12, color: neutral.text, lineHeight: 18 },
  cellStatus:  { flex: 1 },
  cellDate:    { flex: 1, color: neutral.textMid },
  cellActions: { flex: 2 },
  actionsWrap: { flexDirection: 'row', gap: spacing.xs },
  smallBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   5,
    borderRadius:      radius.sm,
    borderWidth:       1,
    borderColor:       glass.borderHi,
  },
  smallBtnDisabled: { opacity: 0.4 },
  smallBtnText:     { fontFamily: font.ui, fontSize: 11, color: neutral.text },
});
