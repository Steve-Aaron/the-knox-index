import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassSurface } from '@/components/primitives/GlassSurface';
import { BRAND } from '@/brand/constants';
import { neutral, glass, accent } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { type } from '@/theme/typography';

/**
 * RegistrationWall
 * -----------------
 * Wraps any content and gates it behind email registration.
 *
 * mode='blur'   — renders children blurred with an overlay CTA.
 *                 Good for partial previews (e.g. posts table).
 * mode='full'   — renders a full wall instead of children until registered.
 *                 Good for the SummaryPanel / weekly brief.
 *
 * Registration state persists in localStorage (web) / memory (native).
 * On successful registration it POSTs to /api/register then unlocks.
 *
 * One job: gate content, collect an email + profile, call home.
 */

// ── Persistence ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'tki_registered';

function getStored(): { email: string } | null {
  if (Platform.OS !== 'web') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setStored(email: string) {
  if (Platform.OS !== 'web') return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ email })); } catch { /* noop */ }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type WallMode = 'blur' | 'full';

interface Props {
  children:  React.ReactNode;
  mode?:     WallMode;
  /** Optional headline override */
  headline?: string;
  /** Optional body copy override */
  copy?:     string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RegistrationWall({
  children,
  mode = 'blur',
  headline = 'Unlock The Knox Index',
  copy = 'Free access — enter your email to see the full leaderboard, weekly brief, and post analysis.',
}: Props) {
  const [registered, setRegistered] = useState<boolean>(() => getStored() !== null);
  const [showForm, setShowForm]     = useState(false);

  // If already registered, render children immediately.
  if (registered) return <>{children}</>;

  if (mode === 'full') {
    return (
      <View style={styles.fullWall}>
        {/* Ghosted preview behind the wall */}
        <View style={styles.fullWallBehind} pointerEvents="none">
          {children}
        </View>
        {/* Gradient mask */}
        <LinearGradient
          colors={['transparent', 'rgba(5,5,9,0.96)', 'rgba(5,5,9,1)']}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {/* Inline form */}
        <View style={styles.fullWallContent}>
          <InlineForm
            headline={headline}
            copy={copy}
            onRegistered={(email) => { setStored(email); setRegistered(true); }}
          />
        </View>
      </View>
    );
  }

  // mode='blur'
  return (
    <View style={styles.blurWrap}>
      {/* Content — blurred when wall is active */}
      <View style={[styles.blurContent, !registered && styles.blurActive]} pointerEvents="none">
        {children}
      </View>

      {/* Blur overlay CTA */}
      {!registered && (
        <View style={styles.blurOverlay}>
          <GlassSurface style={styles.blurCard} radius={radius.lg}>
            <Text style={styles.blurCardKicker}>FREE ACCESS</Text>
            <Text style={styles.blurCardTitle}>{headline}</Text>
            <Text style={styles.blurCardCopy}>{copy}</Text>
            <Pressable
              onPress={() => setShowForm(true)}
              style={({ pressed }) => [styles.unlockBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.unlockBtnText}>UNLOCK NOW →</Text>
            </Pressable>
          </GlassSurface>
        </View>
      )}

      {/* Modal form */}
      <Modal
        visible={showForm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowForm(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowForm(false)} />
          <MotiView
            from={{ opacity: 0, scale: 0.94, translateY: 16 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 240 }}
            style={styles.modalCard}
          >
            <InlineForm
              headline={headline}
              copy={copy}
              onRegistered={(email) => {
                setStored(email);
                setRegistered(true);
                setShowForm(false);
              }}
              onDismiss={() => setShowForm(false)}
            />
          </MotiView>
        </View>
      </Modal>
    </View>
  );
}

// ── InlineForm ────────────────────────────────────────────────────────────────

interface FormProps {
  headline:     string;
  copy:         string;
  onRegistered: (email: string) => void;
  onDismiss?:   () => void;
}

function InlineForm({ headline, copy, onRegistered, onDismiss }: FormProps) {
  const [email,    setEmail]    = useState('');
  const [segment,  setSegment]  = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState(false);

  function toggleInterest(v: string) {
    setInterests(prev =>
      prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]
    );
  }

  async function submit() {
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim(), segment, interests }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Registration failed (${res.status})`);
      }
      setSuccess(true);
      // Short dwell so the user sees confirmation, then unlock.
      setTimeout(() => onRegistered(email.trim()), 1200);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <MotiView
        from={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        style={styles.successWrap}
      >
        <Text style={styles.successIcon}>✓</Text>
        <Text style={styles.successTitle}>You're in.</Text>
        <Text style={styles.successBody}>Welcome to The Knox Index.</Text>
      </MotiView>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.form}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.formHeader}>
        <Text style={styles.formKicker}>{BRAND.kicker}</Text>
        <Text style={styles.formTitle}>{headline}</Text>
        <Text style={styles.formCopy}>{copy}</Text>
      </View>

      {/* Email */}
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={neutral.textDim}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          onSubmitEditing={submit}
        />
      </View>

      {/* Segment */}
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>I AM A…  (optional)</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {BRAND.segments.map(s => {
            const active = segment === s.value;
            return (
              <Pressable
                key={s.value}
                onPress={() => setSegment(active ? '' : s.value)}
                style={({ pressed }) => [
                  styles.chip,
                  active && styles.chipActive,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Interests */}
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>I WANT TO KNOW…  (optional)</Text>
        <View style={styles.interestGrid}>
          {BRAND.interests.map(i => {
            const active = interests.includes(i.value);
            return (
              <Pressable
                key={i.value}
                onPress={() => toggleInterest(i.value)}
                style={({ pressed }) => [
                  styles.interestChip,
                  active && styles.interestChipActive,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <View style={[styles.checkbox, active && styles.checkboxActive]}>
                  {active && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={[styles.interestText, active && styles.interestTextActive]}>
                  {i.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Error */}
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      {/* Submit */}
      <Pressable
        onPress={submit}
        disabled={loading}
        style={({ pressed }) => [
          styles.submitBtn,
          loading && { opacity: 0.6 },
          pressed && { opacity: 0.85 },
        ]}
      >
        {loading
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={styles.submitBtnText}>GET FREE ACCESS →</Text>
        }
      </Pressable>

      <Text style={styles.privacyNote}>
        No spam. Unsubscribe anytime. Your data helps us improve The Knox Index.
      </Text>

      {onDismiss && (
        <Pressable onPress={onDismiss} style={styles.dismissBtn}>
          <Text style={styles.dismissText}>Maybe later</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── full-wall mode
  fullWall: {
    position: 'relative',
    minHeight: 320,
  },
  fullWallBehind: {
    opacity: 0.18,
  },
  fullWallContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },

  // ── blur mode
  blurWrap: {
    position: 'relative',
  },
  blurContent: {
    opacity: 1,
  },
  blurActive: {
    // CSS blur applied via web-only style — works in React Native Web
    ...Platform.select({
      web: { filter: 'blur(8px)', pointerEvents: 'none', userSelect: 'none' } as any,
      default: { opacity: 0.15 },
    }),
  },
  blurOverlay: {
    position:  'absolute',
    top:       0,
    left:      0,
    right:     0,
    bottom:    0,
    alignItems: 'center',
    justifyContent: 'center',
    padding:   spacing.xl,
  },
  blurCard: {
    width: '100%',
    maxWidth: 480,
    padding: spacing.xl,
    gap: spacing.sm,
    alignItems: 'center',
  },
  blurCardKicker: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  blurCardTitle: {
    ...type.title,
    color: neutral.text,
    fontSize: 22,
    textAlign: 'center',
  },
  blurCardCopy: {
    ...type.body,
    color: neutral.textMid,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 340,
  },
  unlockBtn: {
    marginTop: spacing.sm,
    backgroundColor: accent.indigo,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  unlockBtnText: {
    ...type.caption,
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // ── modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: 'rgba(14,14,26,0.97)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: glass.border,
    maxHeight: '88%' as any,
    overflow: 'hidden',
  },

  // ── form
  form: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  formHeader: {
    gap: spacing.xs,
    alignItems: 'center',
  },
  formKicker: {
    ...type.caption,
    color: accent.indigo,
    fontSize: 10,
    letterSpacing: 2,
  },
  formTitle: {
    ...type.title,
    color: neutral.text,
    fontSize: 24,
    textAlign: 'center',
  },
  formCopy: {
    ...type.body,
    color: neutral.textMid,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 380,
    alignSelf: 'center',
  },

  // fields
  field: {
    gap: spacing.xs,
  },
  fieldLabel: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 10,
    letterSpacing: 1.2,
  },
  input: {
    borderWidth: 1,
    borderColor: glass.border,
    backgroundColor: glass.fill,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: neutral.text,
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    ...Platform.select({ web: { outline: 'none' } as any, default: {} }),
  },

  // segment chips (horizontal scroll)
  chipRow: {
    gap: spacing.xs,
    flexDirection: 'row',
    flexWrap: 'nowrap',
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: glass.border,
    backgroundColor: glass.fill,
    flexShrink: 0,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  chipActive: {
    borderColor: accent.indigo,
    backgroundColor: 'rgba(124,131,255,0.12)',
  },
  chipText: {
    ...type.caption,
    color: neutral.textMid,
    fontSize: 11,
  },
  chipTextActive: {
    color: accent.indigo,
  },

  // interest grid
  interestGrid: {
    gap: spacing.xs,
  },
  interestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: glass.border,
    backgroundColor: glass.fill,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  interestChipActive: {
    borderColor: 'rgba(124,131,255,0.4)',
    backgroundColor: 'rgba(124,131,255,0.08)',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: glass.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxActive: {
    backgroundColor: accent.indigo,
    borderColor: accent.indigo,
  },
  checkmark: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  interestText: {
    ...type.body,
    color: neutral.textMid,
    fontSize: 12,
    flex: 1,
  },
  interestTextActive: {
    color: neutral.text,
  },

  // error + submit
  errorText: {
    ...type.body,
    color: '#ff6b6b',
    fontSize: 12,
    textAlign: 'center',
  },
  submitBtn: {
    backgroundColor: accent.indigo,
    paddingVertical: 14,
    borderRadius: radius.pill,
    alignItems: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  submitBtnText: {
    ...type.caption,
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  privacyNote: {
    ...type.body,
    color: neutral.textDim,
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 16,
  },
  dismissBtn: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  dismissText: {
    ...type.body,
    color: neutral.textDim,
    fontSize: 11,
  },

  // success
  successWrap: {
    padding: spacing.xxxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  successIcon: {
    fontSize: 40,
    color: accent.mint,
  },
  successTitle: {
    ...type.title,
    color: neutral.text,
    fontSize: 28,
  },
  successBody: {
    ...type.body,
    color: neutral.textMid,
    fontSize: 14,
  },
});
