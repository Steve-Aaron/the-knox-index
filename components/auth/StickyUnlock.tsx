import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { neutral, glass, accent } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { type, font } from '@/theme/typography';
import { track } from '@/lib/analytics';

/**
 * StickyUnlock
 * -------------
 * Magic-link registration flow rendered as a fixed overlay.
 *
 * Phase 1 — sticky CTA bar
 *   Appears when scrollY > SCROLL_THRESHOLD and isRegistered is false.
 *
 * Phase 2 — unlock modal
 *   Opens on CTA press. Collects email only.
 *   On submit → POST /api/auth/request → sends a magic link email.
 *   Shows a "check your inbox" confirmation — no immediate unlock.
 *   The actual unlock happens when the user clicks the link, which sets
 *   an httpOnly session cookie verified by /api/auth/me.
 *
 * Phase 3 — profiling modal (next visit after registration)
 *   If isRegistered=true but tki_profiled≠1 in localStorage, fires after
 *   a short delay to collect segment + interests.
 *
 * Auth state (isRegistered, email) is owned by the parent via useAuth().
 * This component never writes tki_registered to localStorage directly.
 */

const SCROLL_THRESHOLD = 500;
const PROFILE_DELAY_MS = 2500;

interface SegmentOption { id: string; label: string; sub: string; icon: string }
interface InterestOption { id: string; label: string; desc: string; icon: string }

const SEGMENTS: SegmentOption[] = [
  { id: 'consultant', label: 'Political Consultant',       sub: 'Strategy and communications',            icon: 'briefcase'       },
  { id: 'agency',     label: 'Digital / Creative Agency',  sub: 'Brand and content work',                 icon: 'palette'         },
  { id: 'politician', label: 'MP / AM / MSP / Councillor', sub: "You're a political figure",              icon: 'landmark'        },
  { id: 'officer',    label: 'Parliamentary Officer',      sub: 'Caseworker or senior comms staff',       icon: 'user-tie'        },
  { id: 'journalist', label: 'Journalist / Researcher',    sub: 'You write or research political affairs', icon: 'newspaper'      },
  { id: 'other',      label: 'Other',                      sub: 'Something else entirely',                icon: 'circle-question' },
];

const INTERESTS: InterestOption[] = [
  { id: 'stories',   label: 'Find news stories',          desc: 'Unique angles on political TikTok strategy',      icon: 'magnifying-glass' },
  { id: 'rivals',    label: 'Track other MPs',            desc: 'See what opponents post and why it cuts through',  icon: 'chess'            },
  { id: 'sentiment', label: 'Monitor constituent issues', desc: 'Issues trending with your community on TikTok',   icon: 'comments'         },
  { id: 'briefing',  label: 'Build daily briefings',      desc: 'Morning intelligence for you or your clients',    icon: 'clipboard-list'   },
  { id: 'data',      label: 'Analyse performance data',   desc: 'Deep-dive engagement metrics and content trends',  icon: 'chart-line'      },
  { id: 'fun',       label: 'Just for fun',               desc: 'You find UK political TikTok oddly fascinating',   icon: 'face-smile'      },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  scrollY:      number;
  isRegistered: boolean;
  email:        string | null;
}

type ModalState = 'hidden' | 'unlock' | 'profiling';

export function StickyUnlock({ scrollY, isRegistered, email }: Props) {
  const [profiled, setProfiled] = useState(false);
  const [modal,    setModal]    = useState<ModalState>('hidden');

  // ── Hydrate profiled state from localStorage ──────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const prof = localStorage.getItem('tki_profiled') === '1';
    setProfiled(prof);

    // If registered but not yet profiled → show profiling modal after delay
    if (isRegistered && !prof) {
      const t = setTimeout(() => setModal('profiling'), PROFILE_DELAY_MS);
      return () => clearTimeout(t);
    }
  }, [isRegistered]);

  // ── Show auth error toast if redirected back with ?auth=error ─────────────
  const [authError, setAuthError] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'error') {
      setAuthError(true);
      // Clean the URL without a reload
      window.history.replaceState({}, '', window.location.pathname);
      const t = setTimeout(() => setAuthError(false), 5000);
      return () => clearTimeout(t);
    }
  }, []);

  const shouldShowBar = !isRegistered && scrollY >= SCROLL_THRESHOLD;

  // Fire cta_bar_shown analytics event once
  const ctaShownRef = useRef(false);
  useEffect(() => {
    if (shouldShowBar && !ctaShownRef.current) {
      ctaShownRef.current = true;
      track('cta_bar_shown', { scroll_y: scrollY });
    }
  }, [shouldShowBar, scrollY]);

  const handleProfileDone = useCallback(() => {
    if (Platform.OS === 'web') localStorage.setItem('tki_profiled', '1');
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
            onPress={() => { track('cta_bar_tapped'); setModal('unlock'); }}
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

      {/* ── Auth error toast ──────────────────────────────────────────── */}
      {authError && (
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          style={styles.errorToast}
          pointerEvents="none"
        >
          <Text style={styles.errorToastText}>
            That link has expired. Please request a new one.
          </Text>
        </MotiView>
      )}

      {/* ── Unlock modal ──────────────────────────────────────────────── */}
      {modal === 'unlock' && (
        <UnlockModal
          onClose={() => setModal('hidden')}
          onOpen={() => track('unlock_modal_opened')}
        />
      )}

      {/* ── Profiling modal ───────────────────────────────────────────── */}
      {modal === 'profiling' && (
        <ProfilingModal
          email={email}
          onClose={() => setModal('hidden')}
          onDone={handleProfileDone}
        />
      )}
    </>
  );
}

// ── Unlock modal ─────────────────────────────────────────────────────────────

interface UnlockModalProps {
  onClose: () => void;
  onOpen?: () => void;
}

type UnlockStep = 'form' | 'sending' | 'sent';

function UnlockModal({ onClose, onOpen }: UnlockModalProps) {
  const [email, setEmail]   = useState('');
  const [step,  setStep]    = useState<UnlockStep>('form');
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => { onOpen?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit() {
    if (!EMAIL_RE.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    setError(null);
    setStep('sending');
    track('registration_submit_attempted', { email: email.trim().toLowerCase() });

    try {
      const res = await fetch('/api/auth/request', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStep('sent');
      track('magic_link_sent');
    } catch {
      setStep('form');
      setError('Something went wrong. Please try again.');
      track('magic_link_failed');
    }
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={step !== 'sending' ? onClose : undefined} />

        <MotiView
          from={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 20, stiffness: 260 }}
          style={styles.modalCard}
        >
          <View style={styles.accentLine} />

          {step === 'sent' ? (
            // ── Sent state ──────────────────────────────────────────────
            <MotiView
              from={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'timing', duration: 240 }}
              style={styles.sentWrap}
            >
              <View style={styles.sentIconWrap}>
                <FontAwesome6 name="envelope-circle-check" size={36} color={accent.mint} solid />
              </View>
              <Text style={styles.sentTitle}>Check your inbox</Text>
              <Text style={styles.sentCopy}>
                We've sent a one-click access link to{'\n'}
                <Text style={styles.sentEmail}>{email.trim().toLowerCase()}</Text>
              </Text>
              <Text style={styles.sentHint}>
                The link expires in one hour. Check your spam folder if it doesn't arrive.
              </Text>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.75 }]}
              >
                <Text style={styles.closeBtnText}>Got it</Text>
              </Pressable>
            </MotiView>
          ) : (
            // ── Form state ──────────────────────────────────────────────
            <View style={styles.modalInner}>
              <Text style={styles.modalKicker}>FREE · NO CARD REQUIRED</Text>
              <Text style={styles.modalTitle}>Unlock The Knox Index</Text>
              <Text style={styles.modalCopy}>
                Enter your email and we'll send you a one-click access link. No password needed.
              </Text>

              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor={neutral.textDim}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="send"
                onFocus={() => track('email_field_focused')}
                onSubmitEditing={handleSubmit}
                editable={step === 'form'}
                autoFocus
              />

              {error && <Text style={styles.errorText}>{error}</Text>}

              <Pressable
                onPress={handleSubmit}
                disabled={step === 'sending'}
                style={({ pressed }) => [
                  styles.submitBtn,
                  step === 'sending' && { opacity: 0.6 },
                  pressed && { opacity: 0.85 },
                ]}
              >
                {step === 'sending'
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.submitBtnText}>SEND ACCESS LINK →</Text>
                }
              </Pressable>

              <Text style={styles.legalText}>
                We'll never share your email. Unsubscribe any time.
              </Text>
            </View>
          )}
        </MotiView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Profiling modal ───────────────────────────────────────────────────────────

interface ProfilingModalProps {
  email:    string | null;
  onClose:  () => void;
  onDone:   () => void;
}

function toSmartCase(s: string): string {
  return s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <View style={proStyles.progressTrack}>
      <MotiView
        animate={{ width: `${progress}%` as any }}
        transition={{ type: 'timing', duration: 400 }}
        style={proStyles.progressFill}
      />
    </View>
  );
}

function ProfilingModal({ email, onClose, onDone }: ProfilingModalProps) {
  const [segment,   setSegment]   = useState<string | null>(null);
  const [otherText, setOtherText] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [loading,   setLoading]   = useState(false);

  const progress =
    segment && interests.length > 0 ? 100 :
    segment || interests.length > 0 ?  50 : 0;

  function toggleInterest(id: string) {
    setInterests(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function handleSubmit() {
    setLoading(true);
    const resolvedSegment = segment === 'other' && otherText.trim()
      ? `other:${otherText.trim()}`
      : segment;
    try {
      const storedEmail = email ?? (Platform.OS === 'web' ? (localStorage.getItem('tki_email') ?? '') : '');
      await fetch('/api/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: storedEmail, segment: resolvedSegment, interests, profileUpdate: true }),
      });
    } catch { /* non-fatal */ }

    // Track who registered and why — powers the Conversion Report segment breakdown.
    track('user_profiled', {
      segment:         resolvedSegment ?? null,
      interests:       interests.join(','),
      interests_count: interests.length,
    });

    setLoading(false);
    onDone();
  }

  const canSubmit = !!segment || interests.length > 0;

  return (
    <Modal transparent animationType="fade" onRequestClose={() => {}}>
      <View style={proStyles.backdrop}>
        <MotiView
          from={{ opacity: 0, translateY: 24 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 320 }}
          style={proStyles.sheet}
        >
          {/* Header */}
          <View style={proStyles.header}>
            <View style={proStyles.headerLeft}>
              <View style={proStyles.brandDot} />
              <Text style={proStyles.brandLabel}>THE KNOX INDEX</Text>
            </View>
            <Text style={proStyles.progressLabel}>{progress}% complete</Text>
          </View>

          <ProgressBar progress={progress} />

          {/* Scrollable body */}
          <ScrollView style={proStyles.body} contentContainerStyle={proStyles.bodyInner} showsVerticalScrollIndicator={false}>
            <Text style={proStyles.title}>Help us tailor your experience</Text>
            <Text style={proStyles.subtitle}>
              Takes 15 seconds. Helps us surface the most relevant intelligence for the way you work.
            </Text>

            {/* Who are you? */}
            <View style={proStyles.section}>
              <View style={proStyles.sectionHeadRow}>
                <Text style={proStyles.sectionTitle}>Who are you?</Text>
                <Text style={proStyles.sectionHint}>Pick one</Text>
              </View>
              <View style={proStyles.cardGrid}>
                {SEGMENTS.map(s => {
                  const active = segment === s.id;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setSegment(active ? null : s.id)}
                      style={({ pressed }) => [proStyles.segCard, active && proStyles.segCardActive, pressed && { opacity: 0.82 }]}
                    >
                      <View style={[proStyles.iconWrap, active && proStyles.iconWrapActive]}>
                        <FontAwesome6 name={s.icon as any} size={22} color={active ? accent.indigo : neutral.textMid} solid />
                      </View>
                      <View style={proStyles.segCardText}>
                        <Text style={[proStyles.segCardLabel, active && proStyles.segCardLabelActive]}>{s.label}</Text>
                        <Text style={proStyles.segCardSub}>{s.sub}</Text>
                      </View>
                      {active && <View style={proStyles.checkBadge}><FontAwesome6 name="check" size={10} color="#fff" solid /></View>}
                    </Pressable>
                  );
                })}
              </View>
              {segment === 'other' && (
                <MotiView
                  from={{ opacity: 0, translateY: -6 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 200 }}
                  style={proStyles.otherWrap}
                >
                  <TextInput
                    value={otherText}
                    onChangeText={v => setOtherText(toSmartCase(v))}
                    placeholder="Tell us who you are…"
                    placeholderTextColor={neutral.textDim}
                    autoFocus
                    style={proStyles.otherInput}
                    maxLength={80}
                    returnKeyType="done"
                    {...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} })}
                  />
                </MotiView>
              )}
            </View>

            {/* What do you want to do? */}
            <View style={proStyles.section}>
              <View style={proStyles.sectionHeadRow}>
                <Text style={proStyles.sectionTitle}>What do you want to do?</Text>
                <Text style={proStyles.sectionHint}>Pick all that apply</Text>
              </View>
              <View style={proStyles.cardGrid}>
                {INTERESTS.map(v => {
                  const active = interests.includes(v.id);
                  return (
                    <Pressable
                      key={v.id}
                      onPress={() => toggleInterest(v.id)}
                      style={({ pressed }) => [proStyles.interestCard, active && proStyles.interestCardActive, pressed && { opacity: 0.82 }]}
                    >
                      <View style={[proStyles.iconWrap, active && proStyles.iconWrapActive]}>
                        <FontAwesome6 name={v.icon as any} size={20} color={active ? accent.indigo : neutral.textMid} solid />
                      </View>
                      <View style={proStyles.interestCardText}>
                        <Text style={[proStyles.interestLabel, active && proStyles.interestLabelActive]}>{v.label}</Text>
                        <Text style={proStyles.interestDesc}>{v.desc}</Text>
                      </View>
                      {active && <View style={proStyles.checkBadge}><FontAwesome6 name="check" size={10} color="#fff" solid /></View>}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={proStyles.footerDivider} />
          <View style={proStyles.footer}>
            <Pressable
              onPress={handleSubmit}
              disabled={loading || !canSubmit}
              style={({ pressed }) => [
                proStyles.submitBtn,
                (!canSubmit || loading) && proStyles.submitBtnDisabled,
                pressed && canSubmit && { opacity: 0.88 },
              ]}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <View style={proStyles.submitBtnInner}>
                    <Text style={proStyles.submitBtnText}>Save &amp; continue</Text>
                    <FontAwesome6 name="arrow-right" size={13} color="#fff" solid />
                  </View>
              }
            </Pressable>
          </View>
        </MotiView>
      </View>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  stickyWrap: {
    position:      'absolute' as any,
    bottom:        spacing.xl,
    left:          0,
    right:         0,
    alignItems:    'center',
    zIndex:        999,
    pointerEvents: 'box-none' as any,
    ...Platform.select({ web: { position: 'fixed' } as any, default: {} }),
  },
  ctaBar: {
    backgroundColor:   'rgba(12,12,28,0.94)',
    borderWidth:       1,
    borderColor:       accent.indigo,
    borderRadius:      radius.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical:   spacing.lg,
    maxWidth:          640,
    width:             '92%' as any,
    ...Platform.select({
      web: {
        backdropFilter:       'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow:            '0 8px 48px rgba(124,131,255,0.35)',
        cursor:               'pointer',
      } as any,
      default: {
        shadowColor:   accent.indigo,
        shadowOffset:  { width: 0, height: 8 },
        shadowOpacity: 0.38,
        shadowRadius:  28,
      },
    }),
  },
  ctaInner:     { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  ctaTextGroup: { flex: 1, gap: 4 },
  ctaKicker: {
    ...type.caption,
    fontSize:      10,
    color:         accent.indigo,
    letterSpacing: 1.5,
  },
  ctaHeadline: { ...type.title,   fontSize: 18, color: neutral.text,    fontWeight: '700' },
  ctaCopy:     { ...type.body,    fontSize: 13, color: neutral.textMid, lineHeight: 18 },
  ctaBtn: {
    backgroundColor:   accent.indigo,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    borderRadius:      radius.pill,
    flexShrink:        0,
    ...Platform.select({ web: { boxShadow: '0 4px 20px rgba(124,131,255,0.4)' } as any, default: {} }),
  },
  ctaBtnText: { ...type.caption, color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },

  // Error toast
  errorToast: {
    position:          'absolute' as any,
    bottom:            spacing.xxxl + 60,
    left:              0,
    right:             0,
    alignItems:        'center',
    zIndex:            1000,
    pointerEvents:     'none' as any,
    ...Platform.select({ web: { position: 'fixed' } as any, default: {} }),
  },
  errorToastText: {
    ...type.body,
    fontSize:          13,
    color:             '#fff',
    backgroundColor:   'rgba(220,60,60,0.9)',
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.sm,
    borderRadius:      radius.pill,
    overflow:          'hidden',
  },

  // Modal scaffold
  modalBackdrop: {
    flex:            1,
    backgroundColor: 'rgba(5,5,9,0.75)',
    alignItems:      'center',
    justifyContent:  'center',
    ...Platform.select({ web: { backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' } as any, default: {} }),
  },
  modalCard: {
    backgroundColor: '#0F0F1C',
    borderWidth:     1,
    borderColor:     glass.border,
    borderRadius:    radius.xl,
    width:           '90%' as any,
    maxWidth:        440,
    overflow:        'hidden',
    ...Platform.select({ web: { boxShadow: '0 20px 60px rgba(0,0,0,0.6)' } as any, default: {} }),
  },
  accentLine: { height: 3, backgroundColor: accent.indigo },

  // Form state
  modalInner:  { padding: spacing.xl, gap: spacing.md },
  modalKicker: { ...type.caption, fontSize: 9, color: accent.indigo, letterSpacing: 1.5 },
  modalTitle:  { ...type.title, fontSize: 24, color: neutral.text, fontWeight: '700', marginTop: 2 },
  modalCopy:   { ...type.body, fontSize: 13, color: neutral.textMid, lineHeight: 20 },
  input: {
    backgroundColor:   glass.fill,
    borderWidth:       1,
    borderColor:       glass.border,
    borderRadius:      radius.md,
    color:             neutral.text,
    fontSize:          14,
    paddingHorizontal: spacing.md,
    paddingVertical:   12,
    ...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} }),
  },
  errorText:     { ...type.body, color: '#FF6B6B', fontSize: 12 },
  submitBtn: {
    backgroundColor: accent.indigo,
    borderRadius:    radius.pill,
    paddingVertical: 14,
    alignItems:      'center',
    marginTop:       spacing.xs,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  submitBtnText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  legalText:     { ...type.caption, fontSize: 10, color: neutral.textDim, textAlign: 'center' },

  // Sent state
  sentWrap: {
    padding:    spacing.xl,
    alignItems: 'center',
    gap:        spacing.md,
  },
  sentIconWrap: {
    width:           72,
    height:          72,
    borderRadius:    36,
    backgroundColor: 'rgba(63,230,177,0.1)',
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    spacing.xs,
  },
  sentTitle: { ...type.title, fontSize: 22, color: neutral.text, fontWeight: '700' },
  sentCopy: {
    ...type.body,
    fontSize:  14,
    color:     neutral.textMid,
    textAlign: 'center',
    lineHeight: 22,
  },
  sentEmail: { color: neutral.text, fontWeight: '600' },
  sentHint: {
    ...type.body,
    fontSize:  12,
    color:     neutral.textDim,
    textAlign: 'center',
    lineHeight: 18,
  },
  closeBtn: {
    marginTop:         spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical:   spacing.md,
    borderRadius:      radius.pill,
    borderWidth:       1,
    borderColor:       glass.border,
    backgroundColor:   glass.fill,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  closeBtnText: { ...type.caption, color: neutral.textMid, fontSize: 12 },
});

// ── Profiling modal styles ─────────────────────────────────────────────────────

const proStyles = StyleSheet.create({
  backdrop: {
    flex:            1,
    backgroundColor: 'rgba(5,5,14,0.92)',
    alignItems:      'center',
    justifyContent:  'center',
    ...Platform.select({ web: { backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' } as any, default: {} }),
  },
  sheet: {
    width:           '95%' as any,
    maxWidth:        880,
    maxHeight:       '92%' as any,
    backgroundColor: '#0D0D1C',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.08)',
    borderRadius:    radius.lg,
    overflow:        'hidden',
    flexDirection:   'column',
    ...Platform.select({ web: { boxShadow: '0 32px 80px rgba(0,0,0,0.7)' } as any, default: {} }),
  },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical:   spacing.md,
  },
  headerLeft:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: accent.indigo },
  brandLabel:    { fontFamily: font.bold, fontSize: 11, color: neutral.textDim, letterSpacing: 2 },
  progressLabel: { fontFamily: font.ui, fontSize: 11, color: neutral.textDim },
  progressTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  progressFill:  { height: 3, backgroundColor: accent.indigo, borderRadius: 2 },
  body:      { flex: 1 },
  bodyInner: { padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xl + 4 },
  title:    { fontFamily: font.bold, fontSize: 26, color: neutral.text, lineHeight: 34 },
  subtitle: { fontFamily: font.ui, fontSize: 14, color: neutral.textMid, lineHeight: 22, marginTop: 4 },
  section:         { gap: spacing.md },
  sectionHeadRow:  { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionTitle:    { fontFamily: font.bold, fontSize: 16, color: neutral.text },
  sectionHint:     { fontFamily: font.ui, fontSize: 11, color: neutral.textDim },
  cardGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  segCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    width: 'calc(50% - 6px)' as any, minWidth: 220, flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.07)', borderRadius: radius.md,
    padding: spacing.md, position: 'relative',
    ...Platform.select({ web: { cursor: 'pointer', transitionProperty: 'border-color, background-color', transitionDuration: '140ms' } as any, default: {} }),
  },
  segCardActive:      { borderColor: accent.indigo, backgroundColor: 'rgba(124,131,255,0.08)' },
  segCardText:        { flex: 1, gap: 2, minWidth: 0 },
  segCardLabel:       { fontFamily: font.bold, fontSize: 13, color: neutral.textMid },
  segCardLabelActive: { color: neutral.text },
  segCardSub:         { fontFamily: font.ui, fontSize: 11, color: neutral.textDim, lineHeight: 16 },
  otherWrap:  { marginTop: spacing.sm },
  otherInput: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1.5, borderColor: accent.indigo,
    borderRadius: radius.md, color: neutral.text, fontFamily: font.ui,
    fontSize: 14, paddingHorizontal: spacing.md, paddingVertical: 12,
  },
  interestCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
    width: 'calc(50% - 6px)' as any, minWidth: 220, flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.07)', borderRadius: radius.md,
    padding: spacing.md, paddingTop: spacing.md + 2, position: 'relative',
    ...Platform.select({ web: { cursor: 'pointer', transitionProperty: 'border-color, background-color', transitionDuration: '140ms' } as any, default: {} }),
  },
  interestCardActive:  { borderColor: accent.indigo, backgroundColor: 'rgba(124,131,255,0.08)' },
  interestCardText:    { flex: 1, gap: 3, minWidth: 0 },
  interestLabel:       { fontFamily: font.bold, fontSize: 13, color: neutral.textMid },
  interestLabelActive: { color: neutral.text },
  interestDesc:        { fontFamily: font.ui, fontSize: 11, color: neutral.textDim, lineHeight: 16 },
  iconWrap: {
    width: 40, height: 40, borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  iconWrapActive: { backgroundColor: 'rgba(124,131,255,0.14)' },
  checkBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: accent.indigo, alignItems: 'center', justifyContent: 'center',
  },
  footerDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
  },
  submitBtn: {
    backgroundColor: accent.indigo, borderRadius: radius.pill,
    paddingHorizontal: spacing.xl, paddingVertical: 12,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  submitBtnDisabled: { backgroundColor: 'rgba(124,131,255,0.35)' },
  submitBtnInner:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  submitBtnText:     { fontFamily: font.bold, fontSize: 13, color: '#fff', letterSpacing: 0.3 },
});
