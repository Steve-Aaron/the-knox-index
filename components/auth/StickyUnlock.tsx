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
import { track, identify } from '@/lib/analytics';

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

interface SegmentOption {
  id:    string;
  label: string;
  sub:   string;
  icon:  string;
}

interface InterestOption {
  id:   string;
  label: string;
  desc: string;
  icon: string;
}

const SEGMENTS: SegmentOption[] = [
  { id: 'consultant', label: 'Political Consultant',       sub: 'Strategy and communications',           icon: 'briefcase'       },
  { id: 'agency',     label: 'Digital / Creative Agency',  sub: 'Brand and content work',                icon: 'palette'         },
  { id: 'politician', label: 'MP / AM / MSP / Councillor', sub: "You're a political figure",             icon: 'landmark'        },
  { id: 'officer',    label: 'Parliamentary Officer',      sub: 'Caseworker or senior comms staff',      icon: 'user-tie'        },
  { id: 'journalist', label: 'Journalist / Researcher',   sub: 'You write or research political affairs', icon: 'newspaper'      },
  { id: 'other',      label: 'Other',                     sub: 'Something else entirely',                icon: 'circle-question' },
];

const INTERESTS: InterestOption[] = [
  { id: 'stories',   label: 'Find news stories',          desc: 'Unique angles on political TikTok strategy',     icon: 'magnifying-glass' },
  { id: 'rivals',    label: 'Track other MPs',            desc: 'See what opponents post and why it cuts through', icon: 'chess'            },
  { id: 'sentiment', label: 'Monitor constituent issues', desc: 'Issues trending with your community on TikTok',  icon: 'comments'         },
  { id: 'briefing',  label: 'Build daily briefings',      desc: 'Morning intelligence for you or your clients',   icon: 'clipboard-list'   },
  { id: 'data',      label: 'Analyse performance data',   desc: 'Deep-dive engagement metrics and content trends', icon: 'chart-line'      },
  { id: 'fun',       label: 'Just for fun',               desc: 'You find UK political TikTok oddly fascinating',  icon: 'face-smile'      },
];

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

    // Dev-mode bypass: EXPO_PUBLIC_DEV_AUTH overrides localStorage entirely.
    // npm run web:full   → registered + profiled (full access, no modals)
    // npm run web:new    → not registered (shows CTA bar + unlock modal as normal)
    // npm run web:signup → registered but not profiled (profiling modal auto-fires)
    const devAuth = process.env.EXPO_PUBLIC_DEV_AUTH;
    if (devAuth === 'full') {
      setRegistered(true);
      setProfiled(true);
      return;
    }
    if (devAuth === 'new') {
      setRegistered(false);
      setProfiled(false);
      return;
    }
    if (devAuth === 'signup') {
      setRegistered(true);
      setProfiled(false);
      const t = setTimeout(() => setModal('profiling'), PROFILE_DELAY_MS);
      return () => clearTimeout(t);
    }

    // Production path: read from localStorage as normal.
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

  // Area 8: fire cta_bar_shown once (the first time the bar enters the viewport)
  const ctaShownRef = useRef(false);
  useEffect(() => {
    if (shouldShowBar && !ctaShownRef.current) {
      ctaShownRef.current = true;
      track('cta_bar_shown', { scroll_y: scrollY });
    }
  }, [shouldShowBar, scrollY]);

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

      {/* ── Unlock modal ──────────────────────────────────────────────── */}
      {modal === 'unlock' && (
        <UnlockModal
          onClose={() => setModal('hidden')}
          onDone={handleUnlockDone}
          onOpen={() => track('unlock_modal_opened')}
        />
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
  onOpen?: () => void;
}

function UnlockModal({ onClose, onDone, onOpen }: UnlockModalProps) {
  const [email,      setEmail]      = useState('');
  const [permReport, setPermReport] = useState(true);
  const [permDaily,  setPermDaily]  = useState(false);
  const [permWider,  setPermWider]  = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Fire modal-opened event once on mount
  useEffect(() => { onOpen?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Wrap permission setters to emit a toggle event each time
  const handlePermReport = useCallback((v: boolean) => {
    track('registration_permission_toggled', { permission: 'report', checked: v });
    setPermReport(v);
  }, []);
  const handlePermDaily = useCallback((v: boolean) => {
    track('registration_permission_toggled', { permission: 'daily', checked: v });
    setPermDaily(v);
  }, []);
  const handlePermWider = useCallback((v: boolean) => {
    track('registration_permission_toggled', { permission: 'wider', checked: v });
    setPermWider(v);
  }, []);

  async function handleSubmit() {
    if (!EMAIL_RE.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    setError(null);
    setLoading(true);

    track('registration_submit_attempted', {
      perm_report: permReport,
      perm_daily:  permDaily,
      perm_wider:  permWider,
    });

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
      const trimmedEmail = email.trim().toLowerCase();
      identify(trimmedEmail);
      track('registration_succeeded', {
        perm_report: permReport,
        perm_daily:  permDaily,
        perm_wider:  permWider,
      });
      onDone();
    } catch (e) {
      const errMsg = e instanceof Error && /^HTTP \d+$/.test(e.message) ? e.message : 'network_error';
      track('registration_failed', { error: errMsg });
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
              onFocus={() => track('email_field_focused')}
              onSubmitEditing={handleSubmit}
              editable={!loading}
            />

            {/* Permission checkboxes */}
            <View style={styles.checks}>
              <Checkbox
                label="Knox Index Report — full access to all intelligence, rankings and posts"
                checked={permReport}
                onChange={handlePermReport}
                disabled={loading}
              />
              <Checkbox
                label="Daily Knox Index email — morning briefings on what's moving in UK political TikTok"
                checked={permDaily}
                onChange={handlePermDaily}
                disabled={loading}
              />
              <Checkbox
                label="Wider Knox contact — updates and research from Knox Digital"
                checked={permWider}
                onChange={handlePermWider}
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

/** Convert any string to Smart Case (Title Case). */
function toSmartCase(s: string): string {
  return s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/**
 * Progress bar — width animates from 0 → target% via MotiView.
 * Steps:  0% = nothing answered  |  50% = segment chosen  |  100% = interests chosen
 */
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

function ProfilingModal({ onClose, onDone }: ProfilingModalProps) {
  const [segment,      setSegment]      = useState<string | null>(null);
  const [otherText,    setOtherText]    = useState('');
  const [interests,    setInterests]    = useState<string[]>([]);
  const [loading,      setLoading]      = useState(false);

  // Progress: 0 → 50 when segment set, 50 → 100 when ≥1 interest set, etc.
  const progress =
    segment && interests.length > 0 ? 100 :
    segment                         ?  50 :
    interests.length > 0            ?  50 : 0;

  function toggleInterest(id: string) {
    setInterests(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  async function handleSubmit() {
    setLoading(true);
    // Resolve the final segment value — if 'other', use the typed text
    const resolvedSegment = segment === 'other' && otherText.trim()
      ? `other:${otherText.trim()}`
      : segment;
    try {
      const email = Platform.OS === 'web' ? (localStorage.getItem('tki_email') ?? '') : '';
      await fetch('/api/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, segment: resolvedSegment, interests, profileUpdate: true }),
      });
    } catch { /* non-fatal — profiling is best-effort */ }
    if (Platform.OS === 'web') {
      localStorage.setItem('tki_profiled', '1');
    }
    setLoading(false);
    onDone();
  }

  const canSubmit = !!segment || interests.length > 0;

  return (
    <Modal transparent animationType="fade" onRequestClose={() => { /* no-op: intentionally non-dismissable */ }}>
      {/* Full-screen backdrop — no tap-to-close */}
      <View style={proStyles.backdrop}>

        <MotiView
          from={{ opacity: 0, translateY: 24 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 320 }}
          style={proStyles.sheet}
        >
          {/* ── Header ──────────────────────────────────── */}
          <View style={proStyles.header}>
            <View style={proStyles.headerLeft}>
              <View style={proStyles.brandDot} />
              <Text style={proStyles.brandLabel}>THE KNOX INDEX</Text>
            </View>
            <Text style={proStyles.progressLabel}>{progress}% complete</Text>
          </View>

          {/* ── Progress bar ────────────────────────────── */}
          <ProgressBar progress={progress} />

          {/* ── Scrollable body ─────────────────────────── */}
          <ScrollView
            style={proStyles.body}
            contentContainerStyle={proStyles.bodyInner}
            showsVerticalScrollIndicator={false}
          >
            <Text style={proStyles.title}>Help us tailor your experience</Text>
            <Text style={proStyles.subtitle}>
              Takes 15 seconds. Helps us surface the most relevant intelligence for the way you work.
            </Text>

            {/* ── Who are you? ───────────────────────── */}
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
                      style={({ pressed }) => [
                        proStyles.segCard,
                        active && proStyles.segCardActive,
                        pressed && { opacity: 0.82 },
                      ]}
                    >
                      <View style={[proStyles.iconWrap, active && proStyles.iconWrapActive]}>
                        <FontAwesome6
                          name={s.icon as any}
                          size={22}
                          color={active ? accent.indigo : neutral.textMid}
                          solid
                        />
                      </View>
                      <View style={proStyles.segCardText}>
                        <Text style={[proStyles.segCardLabel, active && proStyles.segCardLabelActive]}>
                          {s.label}
                        </Text>
                        <Text style={proStyles.segCardSub}>{s.sub}</Text>
                      </View>
                      {active && (
                        <View style={proStyles.checkBadge}>
                          <FontAwesome6 name="check" size={10} color="#fff" solid />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {/* 'Other' free-text field — slides in when 'other' is selected */}
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

            {/* ── What do you want to do? ─────────────── */}
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
                      style={({ pressed }) => [
                        proStyles.interestCard,
                        active && proStyles.interestCardActive,
                        pressed && { opacity: 0.82 },
                      ]}
                    >
                      <View style={[proStyles.iconWrap, active && proStyles.iconWrapActive]}>
                        <FontAwesome6
                          name={v.icon as any}
                          size={20}
                          color={active ? accent.indigo : neutral.textMid}
                          solid
                        />
                      </View>
                      <View style={proStyles.interestCardText}>
                        <Text style={[proStyles.interestLabel, active && proStyles.interestLabelActive]}>
                          {v.label}
                        </Text>
                        <Text style={proStyles.interestDesc}>{v.desc}</Text>
                      </View>
                      {active && (
                        <View style={proStyles.checkBadge}>
                          <FontAwesome6 name="check" size={10} color="#fff" solid />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* ── Footer ──────────────────────────────────── */}
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
                : (
                  <View style={proStyles.submitBtnInner}>
                    <Text style={proStyles.submitBtnText}>Save &amp; continue</Text>
                    <FontAwesome6 name="arrow-right" size={13} color="#fff" solid />
                  </View>
                )
              }
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

// ── Profiling modal styles (Bootstrap 5.0 interstitial) ───────────────────────

const proStyles = StyleSheet.create({
  // Full-screen dark backdrop — covers the entire index
  backdrop: {
    flex:            1,
    backgroundColor: 'rgba(5,5,14,0.92)',
    alignItems:      'center',
    justifyContent:  'center',
    ...Platform.select({
      web: { backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' } as any,
      default: {},
    }),
  },

  // The sheet itself — 95% wide, fills most of the vertical space
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
    ...Platform.select({
      web: { boxShadow: '0 32px 80px rgba(0,0,0,0.7)' } as any,
      default: {
        shadowColor:   '#000',
        shadowOffset:  { width: 0, height: 24 },
        shadowOpacity: 0.7,
        shadowRadius:  48,
      },
    }),
  },

  // ── Header ──
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical:   spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  brandDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: accent.indigo,
  },
  brandLabel: {
    fontFamily:    font.bold,
    fontSize:      11,
    color:         neutral.textDim,
    letterSpacing: 2,
  },
  progressLabel: {
    fontFamily: font.ui,
    fontSize:   11,
    color:      neutral.textDim,
  },

  // ── Progress bar ──
  progressTrack: {
    height:          3,
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow:        'hidden',
  },
  progressFill: {
    height:          3,
    backgroundColor: accent.indigo,
    borderRadius:    2,
  },

  // ── Scrollable body ──
  body: {
    flex: 1,
  },
  bodyInner: {
    padding: spacing.xl,
    gap:     spacing.xl,
    paddingBottom: spacing.xl + 4,
  },
  title: {
    fontFamily: font.bold,
    fontSize:   26,
    color:      neutral.text,
    lineHeight: 34,
  },
  subtitle: {
    fontFamily: font.ui,
    fontSize:   14,
    color:      neutral.textMid,
    lineHeight: 22,
    marginTop:  4,
  },

  // ── Section ──
  section: {
    gap: spacing.md,
  },
  sectionHeadRow: {
    flexDirection:  'row',
    alignItems:     'baseline',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: font.bold,
    fontSize:   16,
    color:      neutral.text,
  },
  sectionHint: {
    fontFamily: font.ui,
    fontSize:   11,
    color:      neutral.textDim,
  },

  // ── 2-column card grid ──
  cardGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.sm,
  },

  // Segment cards — half width minus gap
  segCard: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.md,
    width:           'calc(50% - 6px)' as any,
    minWidth:        220,
    flex:            1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth:     1.5,
    borderColor:     'rgba(255,255,255,0.07)',
    borderRadius:    radius.md,
    padding:         spacing.md,
    position:        'relative',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transitionProperty: 'border-color, background-color',
        transitionDuration: '140ms',
      } as any,
      default: {},
    }),
  },
  segCardActive: {
    borderColor:     accent.indigo,
    backgroundColor: 'rgba(124,131,255,0.08)',
  },
  segCardText: {
    flex:    1,
    gap:     2,
    minWidth: 0,
  },
  segCardLabel: {
    fontFamily: font.bold,
    fontSize:   13,
    color:      neutral.textMid,
  },
  segCardLabelActive: {
    color: neutral.text,
  },
  segCardSub: {
    fontFamily: font.ui,
    fontSize:   11,
    color:      neutral.textDim,
    lineHeight: 16,
  },

  // 'Other' free-text input
  otherWrap: {
    marginTop: spacing.sm,
  },
  otherInput: {
    backgroundColor:   'rgba(255,255,255,0.05)',
    borderWidth:       1.5,
    borderColor:       accent.indigo,
    borderRadius:      radius.md,
    color:             neutral.text,
    fontFamily:        font.ui,
    fontSize:          14,
    paddingHorizontal: spacing.md,
    paddingVertical:   12,
  },

  // Interest cards — same grid but slightly taller
  interestCard: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             spacing.md,
    width:           'calc(50% - 6px)' as any,
    minWidth:        220,
    flex:            1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth:     1.5,
    borderColor:     'rgba(255,255,255,0.07)',
    borderRadius:    radius.md,
    padding:         spacing.md,
    paddingTop:      spacing.md + 2,
    position:        'relative',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transitionProperty: 'border-color, background-color',
        transitionDuration: '140ms',
      } as any,
      default: {},
    }),
  },
  interestCardActive: {
    borderColor:     accent.indigo,
    backgroundColor: 'rgba(124,131,255,0.08)',
  },
  interestCardText: {
    flex:    1,
    gap:     3,
    minWidth: 0,
  },
  interestLabel: {
    fontFamily: font.bold,
    fontSize:   13,
    color:      neutral.textMid,
  },
  interestLabelActive: {
    color: neutral.text,
  },
  interestDesc: {
    fontFamily: font.ui,
    fontSize:   11,
    color:      neutral.textDim,
    lineHeight: 16,
  },

  // Icon container within each card
  iconWrap: {
    width:           40,
    height:          40,
    borderRadius:    radius.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  iconWrapActive: {
    backgroundColor: 'rgba(124,131,255,0.14)',
  },

  // Small check badge top-right of active card
  checkBadge: {
    position:        'absolute',
    top:             8,
    right:           8,
    width:           20,
    height:          20,
    borderRadius:    10,
    backgroundColor: accent.indigo,
    alignItems:      'center',
    justifyContent:  'center',
  },

  // ── Footer ──
  footerDivider: {
    height:          1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  footer: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical:   spacing.lg,
  },
  skipBtn: {
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  skipText: {
    fontFamily: font.ui,
    fontSize:   13,
    color:      neutral.textDim,
  },
  submitBtn: {
    backgroundColor: accent.indigo,
    borderRadius:    radius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical:   12,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  submitBtnDisabled: {
    backgroundColor: 'rgba(124,131,255,0.35)',
  },
  submitBtnInner: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  submitBtnText: {
    fontFamily:    font.bold,
    fontSize:      13,
    color:         '#fff',
    letterSpacing: 0.3,
  },
});
