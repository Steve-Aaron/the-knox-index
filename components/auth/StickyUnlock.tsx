import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { MotiView } from 'moti';
import { BlurView } from 'expo-blur';
import { neutral, glass, accent } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { type } from '@/theme/typography';

/**
 * StickyUnlock
 * -------------
 * Two-phase registration flow rendered as a fixed overlay.
 *
 * Phase 1 — sticky CTA bar
 *   Appears when the parent reports scrollY > SCROLL_THRESHOLD.
 *   Hidden once the user has already registered (localStorage: 'tki_registered').
 *
 * Phase 2 — unlock modal
 *   Opens on CTA press. Collects: email + 3 permission checkboxes.
 *   On submit → POST /api/register → stores 'tki_registered' in localStorage.
 *
 * Phase 3 — profiling modal (next visit)
 *   If 'tki_registered' is set but 'tki_profiled' is NOT, and the user visits
 *   the page, this modal fires automatically after a short delay.
 *   Collects: segment + interests → PATCH /api/register → stores 'tki_profiled'.
 */

const SCROLL_THRESHOLD = 500; // px scrolled before the CTA bar appears
const PROFILE_DELAY_MS = 2500; // ms after page load before profiling modal shows

const SEGMENTS = ['MP / AM / MSP', 'Party Staff', 'Journalist', 'Researcher', 'Lobbyist', 'Other'];
const INTERESTS = ['Social media strategy', 'Polling & sentiment', 'Political rivals', 'Party performance', 'Campaign tactics'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  /** Scroll offset reported by the parent ScrollView. */
  scrollY: number;
}

type ModalState = 'hidden' | 'unlock' | 'profiling' | 'done';

export function StickyUnlock({ scrollY }: Props) {
  const [registered, setRegistered] = useState(false);
  const [profiled,   setProfiled]   = useState(false);
  const [modal,      setModal]      = useState<ModalState>('hidden');

  // ── Hydrate from localStorage (web only) ──────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const reg  = localStorage.getItem('tki_registered') === '1';
    const prof = localStorage.getItem('tki_profiled')   === '1';
    setRegistered(reg);
    setProfiled(prof);

    // If registered but not yet profiled, show the profiling modal after a delay.
    if (reg && !prof) {
      const t = setTimeout(() => setModal('profiling'), PROFILE_DELAY_MS);
      return () => clearTimeout(t);
    }
  }, []);

  const shouldShowBar = !registered && scrollY >= SCROLL_THRESHOLD;

  const handleUnlockDone = useCallback(() => {
    setRegistered(true);
    setModal('done');
    // Show a brief 'done' confirmation then hide
    setTimeout(() => setModal('hidden'), 2000);
  }, []);

  const handleProfileDone = useCallback(() => {
    setProfiled(true);
    setModal('hidden');
  }, []);

  return (
    <>
      {/* ── Sticky CTA bar ────────────────────────────────────────────── */}
      {shouldShowBar && (
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          exit={{ opacity: 0, translateY: 20 }}
          transition={{ type: 'timing', duration: 280 }}
          style={styles.stickyWrap}
          pointerEvents="box-none"
        >
          <Pressable
            onPress={() => setModal('unlock')}
            style={({ pressed }) => [styles.ctaBar, pressed && { opacity: 0.9 }]}
          >
            <View style={styles.ctaInner}>
              <View style={styles.ctaTextGroup}>
                <Text style={styles.ctaKicker}>FREE ACCESS</Text>
                <Text style={styles.ctaHeadline}>Unlock the full Knox Index</Text>
                <Text style={styles.ctaCopy}>
                  Register in 10 seconds — no card, no commitment.
                </Text>
              </View>
              <View style={styles.ctaBtn}>
                <Text style={styles.ctaBtnText}>REGISTER →</Text>
              </View>
            </View>
          </Pressable>
        </MotiView>
      )}

      {/* ── Unlock modal ──────────────────────────────────────────────── */}
      {modal === 'unlock' && (
        <UnlockModal onClose={() => setModal('hidden')} onDone={handleUnlockDone} />
      )}

      {/* ── Profiling modal ───────────────────────────────────────────── */}
      {modal === 'profiling' && (
        <ProfilingModal onClose={() => setModal('hidden')} onDone={handleProfileDone} />
      )}

      {/* ── Confirmation flash ────────────────────────────────────────── */}
      {modal === 'done' && (
        <MotiView
          from={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          style={styles.doneWrap}
          pointerEvents="none"
        >
          <Text style={styles.doneText}>✓ You're in</Text>
        </MotiView>
      )}
    </>
  );
}

// ── Unlock modal ─────────────────────────────────────────────────────────────

interface UnlockModalProps {
  onClose: () => void;
  onDone:  () => void;
}

function UnlockModal({ onClose, onDone }: UnlockModalProps) {
  const [email,      setEmail]      = useState('');
  const [permReport, setPermReport] = useState(true);
  const [permDaily,  setPermDaily]  = useState(false);
  const [permWider,  setPermWider]  = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  async function handleSubmit() {
    if (!EMAIL_RE.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          email:      email.trim().toLowerCase(),
          permReport,
          permDaily,
          permWider,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (Platform.OS === 'web') {
        localStorage.setItem('tki_registered', '1');
        localStorage.setItem('tki_email', email.trim().toLowerCase());
      }
      onDone();
    } catch (e) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <MotiView
          from={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 20, stiffness: 260 }}
          style={styles.modalCard}
        >
          {/* Accent line */}
          <View style={styles.accentLine} />

          <View style={styles.modalInner}>
            <Text style={styles.modalKicker}>FREE · NO CARD REQUIRED</Text>
            <Text style={styles.modalTitle}>Unlock The Knox Index</Text>
            <Text style={styles.modalCopy}>
              Enter your email below and choose what you'd like to receive from us.
            </Text>

            {/* Email input */}
            <TextInput
              style={styles.input}
              placeholder="your@email.com"
              placeholderTextColor={neutral.textDim}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              editable={!loading}
            />

            {/* Permission checkboxes */}
            <View style={styles.checks}>
              <Checkbox
                label="Knox Index Report — full access to all intelligence, rankings and posts"
                checked={permReport}
                onChange={setPermReport}
                disabled={loading}
              />
              <Checkbox
                label="Daily Knox Index email — morning briefings on what's moving in UK political TikTok"
                checked={permDaily}
                onChange={setPermDaily}
                disabled={loading}
              />
              <Checkbox
                label="Wider Knox contact — updates and research from Knox Digital"
                checked={permWider}
                onChange={setPermWider}
                disabled={loading}
              />
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <Pressable
              onPress={handleSubmit}
              disabled={loading}
              style={({ pressed }) => [
                styles.submitBtn,
                pressed && { opacity: 0.85 },
                loading && { opacity: 0.6 },
              ]}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.submitBtnText}>GET ACCESS →</Text>
              }
            </Pressable>

            <Text style={styles.legalText}>
              We'll never share your data. You can unsubscribe at any time.
            </Text>
          </View>
        </MotiView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Profiling modal ───────────────────────────────────────────────────────────

interface ProfilingModalProps {
  onClose: () => void;
  onDone:  () => void;
}

function ProfilingModal({ onClose, onDone }: ProfilingModalProps) {
  const [segment,   setSegment]   = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  function toggleInterest(v: string) {
    setInterests(prev =>
      prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]
    );
  }

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      // We don't require these fields — submit what we have
      const email = Platform.OS === 'web' ? (localStorage.getItem('tki_email') ?? '') : '';
      await fetch('/api/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, segment, interests, profileUpdate: true }),
      });
    } catch { /* non-fatal — profiling is best-effort */ }
    if (Platform.OS === 'web') {
      localStorage.setItem('tki_profiled', '1');
    }
    setLoading(false);
    onDone();
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, styles.modalBackdrop]} onPress={onClose} />

      <View style={styles.modalBackdrop} pointerEvents="box-none">
        <MotiView
          from={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 20, stiffness: 260 }}
          style={styles.modalCard}
        >
          <View style={styles.accentLine} />

          <View style={styles.modalInner}>
            <Text style={styles.modalKicker}>ONE QUICK QUESTION</Text>
            <Text style={styles.modalTitle}>Tell us about you</Text>
            <Text style={styles.modalCopy}>
              Help us tailor the Knox Index to your needs. Takes 15 seconds.
            </Text>

            {/* Segment chips */}
            <Text style={styles.sectionLabel}>WHO ARE YOU?</Text>
            <View style={styles.chipsWrap}>
              {SEGMENTS.map(s => (
                <Pressable
                  key={s}
                  onPress={() => setSegment(segment === s ? null : s)}
                  style={({ pressed }) => [
                    styles.chip,
                    segment === s && styles.chipActive,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text style={[styles.chipText, segment === s && styles.chipTextActive]}>
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Interest chips */}
            <Text style={styles.sectionLabel}>WHAT INTERESTS YOU MOST?</Text>
            <View style={styles.chipsWrap}>
              {INTERESTS.map(v => {
                const active = interests.includes(v);
                return (
                  <Pressable
                    key={v}
                    onPress={() => toggleInterest(v)}
                    style={({ pressed }) => [
                      styles.chip,
                      active && styles.chipActive,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{v}</Text>
                  </Pressable>
                );
              })}
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <Pressable
              onPress={handleSubmit}
              disabled={loading}
              style={({ pressed }) => [
                styles.submitBtn,
                pressed && { opacity: 0.85 },
                loading && { opacity: 0.6 },
              ]}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.submitBtnText}>SAVE & CONTINUE →</Text>
              }
            </Pressable>

            <Pressable onPress={onClose} style={styles.skipBtn}>
              <Text style={styles.skipText}>Skip for now</Text>
            </Pressable>
          </View>
        </MotiView>
      </View>
    </Modal>
  );
}

// ── Checkbox ─────────────────────────────────────────────────────────────────

interface CheckboxProps {
  label:    string;
  checked:  boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

function Checkbox({ label, checked, onChange, disabled }: CheckboxProps) {
  return (
    <Pressable
      onPress={() => !disabled && onChange(!checked)}
      style={({ pressed }) => [styles.checkRow, pressed && { opacity: 0.75 }]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <View style={[styles.checkBox, checked && styles.checkBoxActive]}>
        {checked && <Text style={styles.checkMark}>✓</Text>}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Sticky bar
  stickyWrap: {
    position:       'absolute' as any,
    bottom:         spacing.xl,
    left:           0,
    right:          0,
    alignItems:     'center',
    zIndex:         999,
    pointerEvents:  'box-none' as any,
    ...Platform.select({ web: { position: 'fixed' } as any, default: {} }),
  },
  ctaBar: {
    backgroundColor: 'rgba(12,12,28,0.92)',
    borderWidth:     1,
    borderColor:     accent.indigo,
    borderRadius:    radius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    maxWidth:          560,
    width:             '90%' as any,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 8px 40px rgba(124,131,255,0.3)',
        cursor: 'pointer',
      } as any,
      default: {
        shadowColor:    accent.indigo,
        shadowOffset:   { width: 0, height: 8 },
        shadowOpacity:  0.35,
        shadowRadius:   24,
      },
    }),
  },
  ctaInner: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.md,
  },
  ctaTextGroup: {
    flex: 1,
    gap:  2,
  },
  ctaKicker: {
    ...type.caption,
    fontSize:    9,
    color:       accent.indigo,
    letterSpacing: 1.5,
  },
  ctaHeadline: {
    ...type.title,
    fontSize:   15,
    color:      neutral.text,
    fontWeight: '700',
  },
  ctaCopy: {
    ...type.body,
    fontSize: 11,
    color:    neutral.textMid,
  },
  ctaBtn: {
    backgroundColor: accent.indigo,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    borderRadius:      radius.pill,
    flexShrink:        0,
  },
  ctaBtnText: {
    ...type.caption,
    color:       '#fff',
    fontSize:    10,
    fontWeight:  '800',
    letterSpacing: 0.8,
  },

  // Modal
  modalBackdrop: {
    flex:            1,
    backgroundColor: 'rgba(5,5,9,0.75)',
    alignItems:      'center',
    justifyContent:  'center',
    ...Platform.select({
      web: { backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' } as any,
      default: {},
    }),
  },
  modalCard: {
    backgroundColor: '#0F0F1C',
    borderWidth:     1,
    borderColor:     glass.border,
    borderRadius:    radius.xl,
    width:           '90%' as any,
    maxWidth:        480,
    overflow:        'hidden',
    ...Platform.select({
      web: { boxShadow: '0 20px 60px rgba(0,0,0,0.6)' } as any,
      default: {
        shadowColor:   '#000',
        shadowOffset:  { width: 0, height: 20 },
        shadowOpacity: 0.6,
        shadowRadius:  40,
      },
    }),
  },
  accentLine: {
    height:          3,
    backgroundColor: accent.indigo,
  },
  modalInner: {
    padding: spacing.xl,
    gap:     spacing.md,
  },
  modalKicker: {
    ...type.caption,
    fontSize:    9,
    color:       accent.indigo,
    letterSpacing: 1.5,
  },
  modalTitle: {
    ...type.title,
    fontSize:   24,
    color:      neutral.text,
    fontWeight: '700',
    marginTop:  2,
  },
  modalCopy: {
    ...type.body,
    fontSize:   13,
    color:      neutral.textMid,
    lineHeight: 20,
  },
  input: {
    backgroundColor: glass.fill,
    borderWidth:     1,
    borderColor:     glass.border,
    borderRadius:    radius.md,
    color:           neutral.text,
    fontSize:        14,
    paddingHorizontal: spacing.md,
    paddingVertical:   12,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
      default: {},
    }),
  },
  checks: {
    gap: spacing.sm,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           spacing.sm,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  checkBox: {
    width:           18,
    height:          18,
    borderRadius:    4,
    borderWidth:     1.5,
    borderColor:     glass.border,
    backgroundColor: glass.fill,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
    marginTop:       1,
  },
  checkBoxActive: {
    borderColor:     accent.indigo,
    backgroundColor: 'rgba(124,131,255,0.2)',
  },
  checkMark: {
    color:    accent.indigo,
    fontSize: 11,
    fontWeight: '700',
  },
  checkLabel: {
    ...type.body,
    fontSize:   12,
    color:      neutral.textMid,
    lineHeight: 18,
    flex:       1,
  },
  errorText: {
    ...type.caption,
    color:    '#FF6B6B',
    fontSize: 12,
  },
  submitBtn: {
    backgroundColor: accent.indigo,
    borderRadius:    radius.pill,
    paddingVertical: 14,
    alignItems:      'center',
    marginTop:       spacing.xs,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  submitBtnText: {
    color:      '#fff',
    fontSize:   12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  legalText: {
    ...type.caption,
    fontSize:  10,
    color:     neutral.textDim,
    textAlign: 'center',
  },

  // Profiling chips
  sectionLabel: {
    ...type.caption,
    fontSize:    9,
    color:       neutral.textDim,
    letterSpacing: 1.2,
    marginTop:   spacing.xs,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.xs,
  },
  chip: {
    borderRadius:    radius.pill,
    borderWidth:     1,
    borderColor:     glass.border,
    backgroundColor: glass.fill,
    paddingHorizontal: spacing.md,
    paddingVertical:   6,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  chipActive: {
    borderColor:     accent.indigo,
    backgroundColor: 'rgba(124,131,255,0.15)',
  },
  chipText: {
    ...type.caption,
    fontSize: 11,
    color:    neutral.textMid,
  },
  chipTextActive: {
    color: accent.indigo,
  },

  // Skip
  skipBtn: {
    alignItems: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  skipText: {
    ...type.caption,
    fontSize: 11,
    color:    neutral.textDim,
  },

  // Done flash
  doneWrap: {
    position:       'absolute' as any,
    bottom:         spacing.xl + 60,
    left:           0,
    right:          0,
    alignItems:     'center',
    zIndex:         1000,
    ...Platform.select({ web: { position: 'fixed' } as any, default: {} }),
  },
  doneText: {
    ...type.title,
    fontSize:        16,
    color:           accent.mint,
    backgroundColor: 'rgba(12,12,28,0.9)',
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    borderRadius:      radius.pill,
    borderWidth:       1,
    borderColor:       accent.mint,
    overflow:          'hidden',
  },
});
