import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Platform } from 'react-native';
import { LabeledInput } from '@/components/primitives/LabeledInput';
import { PrimaryButton } from '@/components/primitives/PrimaryButton';
import { DevLabel } from '@/components/primitives/DevLabel';
import { REGION_KEYS, REGION_LABELS, type RegionKey } from '@/lib/regions';
import { neutral, glass, knox, colourFor } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { font } from '@/theme/typography';
import { track } from '@/lib/analytics';

/**
 * AccessRequestForm
 * ------------------
 * What someone outside the admitted email domains fills in to ask for access
 * to a gated dashboard. The answers land on their `tenant_access` row, so the
 * admin panel shows who is asking and why rather than a bare address.
 *
 * Name and reason are required — they are what makes a request decidable.
 * Everything else is optional and improves the decision.
 *
 * One job: collect and submit the access request.
 */

/**
 * Regions offered as AREAS OF INTEREST — what the person wants to read about,
 * so we know what matters to them. An approved user sees the whole dashboard;
 * nothing here narrows that. 'unknown' is a data bucket, not a choice.
 */
const AREA_OPTIONS = REGION_KEYS.filter(r => r !== 'unknown') as readonly RegionKey[];

const REFERRAL_OPTIONS = [
  'The Knox team',
  'A colleague',
  'LinkedIn',
  'Search',
  'An event',
  'Other',
] as const;

interface Props {
  /** The signed-in address the request will be recorded against. */
  email:        string | null;
  /** Name of the dashboard being requested, for the copy. */
  tenantName:   string;
  /** Called after a successful submission so the gate can re-check access. */
  onSubmitted:  () => void | Promise<void>;
}

export function AccessRequestForm({ email, tenantName, onSubmitted }: Props) {
  const [name,     setName]     = useState('');
  const [org,      setOrg]      = useState('');
  const [role,     setRole]     = useState('');
  const [reason,   setReason]   = useState('');
  const [areas,    setAreas]    = useState<RegionKey[]>([]);
  const [referral, setReferral] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const canSubmit = useMemo(
    () => name.trim().length > 1 && reason.trim().length > 4 && !submitting,
    [name, reason, submitting],
  );

  const toggleArea = useCallback((key: RegionKey) => {
    setAreas(prev => (prev.includes(key) ? prev.filter(r => r !== key) : [...prev, key]));
  }, []);

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/tenant/access', {
        method:      'POST',
        credentials: 'same-origin',
        headers:     { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:           name.trim(),
          organisation:   org.trim(),
          role:           role.trim(),
          reason:         reason.trim(),
          areasOfInterest: areas,
          referralSource: referral ?? '',
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? 'We could not send that request. Please retry.');
        return;
      }

      track('tenant_access_requested', {
        organisation: org.trim() || null,
        area_count:   areas.length,
        referral:     referral ?? null,
      });
      await onSubmitted();
    } catch {
      setError('We could not reach the server. Please retry.');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, name, org, role, reason, areas, referral, onSubmitted]);

  return (
    <View style={styles.wrap}>
      <DevLabel name="AccessRequestForm" />

      {email ? (
        <Text style={styles.note}>
          Recorded against <Text style={styles.noteStrong}>{email}</Text>. Sign in with this address once approved.
        </Text>
      ) : null}

      <LabeledInput
        label="Your name"
        value={name}
        onChange={setName}
        placeholder="Jane Okafor"
        inputProps={{ autoCapitalize: 'words' }}
      />

      <LabeledInput
        label="Organisation"
        value={org}
        onChange={setOrg}
        placeholder="Campaign, agency or institution"
      />

      <LabeledInput
        label="Role"
        value={role}
        onChange={setRole}
        placeholder="Head of Digital"
      />

      {/* Reason — multiline, so it gets its own field rather than LabeledInput's
          single-line input. */}
      <View style={styles.field}>
        <Text style={styles.label}>Why do you need access?</Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder={`What you would use ${tenantName} for`}
          placeholderTextColor={neutral.textMid}
          multiline
          numberOfLines={4}
          maxLength={1000}
          style={styles.textarea}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Areas of interest</Text>
        <Text style={styles.hint}>What you want to read about. It does not limit what you can see.</Text>
        <View style={styles.chipRow}>
          {AREA_OPTIONS.map(key => {
            const active = areas.includes(key);
            const colour = colourFor(key);
            return (
              <Pressable
                key={key}
                onPress={() => toggleArea(key)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
                style={({ pressed }) => [
                  styles.chip,
                  active && { borderColor: colour.base, backgroundColor: colour.base + '22' },
                  pressed && { opacity: 0.75 },
                ]}
              >
                <View style={[styles.chipDot, { backgroundColor: colour.base }]} />
                <Text style={[styles.chipText, active && { color: colour.glow }]}>
                  {REGION_LABELS[key]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>How did you hear about it?</Text>
        <View style={styles.chipRow}>
          {REFERRAL_OPTIONS.map(option => {
            const active = referral === option;
            return (
              <Pressable
                key={option}
                onPress={() => setReferral(active ? null : option)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [
                  styles.chip,
                  active && styles.chipActiveNeutral,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Text style={[styles.chipText, active && { color: neutral.text }]}>{option}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <PrimaryButton
        label={submitting ? 'Sending…' : 'Request access'}
        onPress={() => { void submit(); }}
        disabled={!canSubmit}
        style={styles.submit}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:  { gap: spacing.sm },
  note:  { fontFamily: font.ui, fontSize: 12, color: neutral.textMid, marginBottom: spacing.xs },
  noteStrong: { fontFamily: font.bold, color: neutral.text },
  field: { marginTop: spacing.xs },
  hint: {
    fontFamily:   font.ui,
    fontSize:     11,
    color:        neutral.textMid,
    marginBottom: 6,
    marginTop:    -2,
  },
  label: {
    fontFamily:    font.bold,
    fontSize:      10,
    letterSpacing: 1,
    color:         neutral.textMid,
    marginBottom:  6,
    textTransform: 'uppercase',
  },
  textarea: {
    minHeight:         88,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.sm,
    borderRadius:      radius.md,
    borderWidth:       1,
    borderColor:       glass.border,
    backgroundColor:   glass.fill,
    color:             neutral.text,
    fontFamily:        font.ui,
    fontSize:          14,
    textAlignVertical: 'top',
    ...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} }),
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: spacing.sm,
    paddingVertical:   6,
    borderRadius:      radius.pill,
    borderWidth:       1,
    borderColor:       glass.border,
    backgroundColor:   glass.fill,
    ...Platform.select({ web: { cursor: 'pointer', transitionDuration: '150ms' } as any, default: {} }),
  },
  chipActiveNeutral: { borderColor: knox.primaryPink, backgroundColor: glass.fillHi },
  chipDot:  { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontFamily: font.ui, fontSize: 12, color: neutral.textMid },
  submit:   { marginTop: spacing.md },
  error: {
    marginTop:  spacing.sm,
    fontFamily: font.ui,
    fontSize:   13,
    color:      knox.primaryPink,
    textAlign:  'center',
  },
});
