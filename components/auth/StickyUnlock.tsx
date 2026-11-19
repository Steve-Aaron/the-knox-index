import React, { useState, useEffect, useCallback, useRef } from 'react';
import { router } from 'expo-router';
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
  Linking,
  useWindowDimensions,
} from 'react-native';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { neutral, glass, accent, brand } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { type, font } from '@/theme/typography';
import { breakpoints } from '@/theme/breakpoints';
import { track } from '@/lib/analytics';
import { requestMagicLink } from '@/lib/requestMagicLink';
import { AuthToast } from '@/components/auth/AuthToast';
import { onAuthChanged } from '@/lib/authEvents';
import { SEGMENTS, interestsFor } from '@/data/profileOptions';
import { DevLabel } from '@/components/primitives/DevLabel';
import { FrequencyPicker } from '@/components/primitives/FrequencyPicker';
import { LinkedinInput } from '@/components/primitives/LinkedinInput';
import { buildLinkedinUrl } from '@/lib/linkedin';
import { ConsentToggleRow } from '@/components/primitives/ConsentToggleRow';
import { SelectableCard } from '@/components/primitives/SelectableCard';
import { LabeledInput } from '@/components/primitives/LabeledInput';
import { PrimaryButton } from '@/components/primitives/PrimaryButton';
import { GoogleSignInButton } from '@/components/primitives/GoogleSignInButton';
import type { AccessReason } from '@/hooks/useTenantAccess';

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
 *   a short delay to collect name, company, LinkedIn, segment, interests,
 *   and comms consent. Submits to /api/preferences → Brevo.
 *
 * Waitlist indexes (World Leaders) — `waitlist` is set
 *   Joining does not unlock anything. The bar opens the SAME profiling form
 *   as The Knox Index, in one step with an email field and without the
 *   UK-only parts (briefing, UK-only interests). It posts to
 *   /api/tenant/access: a pending request for the admin panel plus a Brevo
 *   contact. No email to confirm; Knox approves by hand in /admin.
 *
 * Auth state (isRegistered, email) is owned by the parent via useAuth().
 * This component never writes tki_registered to localStorage directly.
 */

const PROFILE_DELAY_MS = 2500;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const WAITLIST_PROMPTED_KEY = 'tki_waitlist_prompted';

export interface WaitlistState {
  /** The visitor's standing on the waitlist, from /api/tenant/access. */
  reason:     AccessReason;
  /** Short index name for the copy, e.g. 'World Leaders'. */
  tenantName: string;
  /** The address this browser joined with, when the visitor is signed out. */
  joinedEmail: string | null;
  /** Remembers the join and re-reads access after the waitlist form is sent. */
  onJoined:   (email: string | null) => void | Promise<void>;
}

interface Props {
  /** Whether the sticky bar shows. The parent decides (past the hero, no full access). */
  showBar:      boolean;
  /** Signed in (a session exists). On a waitlist index this is not full access. */
  isRegistered: boolean;
  email:        string | null;
  /** Set on waitlist indexes; null or absent on The Knox Index. */
  waitlist?:    WaitlistState | null;
  /** Bump to open the sign-up (or waitlist) modal from elsewhere on the page. */
  openSignal?:  number;
}

type ModalState = 'hidden' | 'unlock' | 'profiling' | 'waitlist';

export function StickyUnlock({ showBar, isRegistered, email, waitlist = null, openSignal = 0 }: Props) {
  const [profiled, setProfiled] = useState(false);
  const [modal,    setModal]    = useState<ModalState>('hidden');

  // Mobile re-stacks the CTA — text on top, full-width button below — because
  // at <768px there isn't room for headline + sub-copy + a pill button on one row.
  const { width } = useWindowDimensions();
  const isMobile  = width < breakpoints.tablet;

  // ── Hydrate profiled state from localStorage ──────────────────────────────
  // Subscribed to authEvents so a profile completed in another tab (or a
  // claim hydrated mid-session) cancels the pending modal instead of
  // re-prompting a user who has already finished.
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const read = () => localStorage.getItem('tki_profiled') === '1';
    setProfiled(read());

    // If registered but not yet profiled → show profiling modal after delay.
    // Waitlist indexes collect their details in the waitlist form instead.
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (isRegistered && !read() && !waitlist) {
      timer = setTimeout(() => {
        // Re-check at fire time — profiled may have flipped during the delay
        if (!read()) setModal('profiling');
      }, PROFILE_DELAY_MS);
    }

    const unsubscribe = onAuthChanged(() => {
      const prof = read();
      setProfiled(prof);
      if (prof && timer) { clearTimeout(timer); timer = null; }
      if (prof) setModal(m => (m === 'profiling' ? 'hidden' : m));
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRegistered, !!waitlist]);

  // Waitlist: a newly signed-in visitor who has not yet asked is shown the
  // waitlist form once per browser session.
  const waitlistReason = waitlist?.reason ?? null;
  useEffect(() => {
    if (Platform.OS !== 'web' || !isRegistered || waitlistReason !== 'none') return;
    let prompted = false;
    try { prompted = sessionStorage.getItem(WAITLIST_PROMPTED_KEY) === '1'; } catch { /* storage blocked */ }
    if (prompted) return;
    const timer = setTimeout(() => {
      try { sessionStorage.setItem(WAITLIST_PROMPTED_KEY, '1'); } catch { /* storage blocked */ }
      setModal(m => (m === 'hidden' ? 'waitlist' : m));
    }, PROFILE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isRegistered, waitlistReason]);

  // The Knox Index: the sign-up modal. Waitlist index: the waitlist form,
  // signed in or not. Already waiting → nothing to open.
  // Waitlist index: signed out → the waitlist form (an email is enough, no
  // sign-in), unless this browser has already joined.
  const openModal = useCallback(() => {
    if (!waitlist) { setModal('unlock'); return; }
    if (isRegistered) { if (waitlist.reason === 'none') setModal('waitlist'); return; }
    if (!waitlist.joinedEmail) setModal('waitlist');
  }, [waitlist, isRegistered]);

  // The parent bumps openSignal from locked panels and the range interstitial
  useEffect(() => {
    if (openSignal > 0) openModal();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSignal]);

  const shouldShowBar = showBar;
  const bar = barCopy(waitlist, isRegistered);

  // Fire cta_bar_shown analytics event once per session
  const ctaShownRef = useRef(false);
  useEffect(() => {
    if (shouldShowBar && !ctaShownRef.current) {
      ctaShownRef.current = true;
      track('cta_bar_shown', { trigger: 'scroll_10pct' });
    }
  }, [shouldShowBar]);

  const handleProfileDone = useCallback(() => {
    if (Platform.OS === 'web') localStorage.setItem('tki_profiled', '1');
    setProfiled(true);
    setModal('hidden');
  }, []);

  return (
    <>
      <DevLabel name="unlock-paywall-bar" />
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
            onPress={() => {
              if (!bar.button) return;
              track('cta_bar_tapped', { waitlist: !!waitlist });
              openModal();
            }}
            style={({ pressed }) => [styles.ctaBar, pressed && bar.button && { opacity: 0.95 }]}
          >
            <View style={[styles.ctaInner, isMobile && styles.ctaInnerMobile]}>
              <View style={styles.ctaTextGroup}>
                <Text style={styles.ctaKicker}>{bar.kicker}</Text>
                <Text style={styles.ctaHeadline}>{bar.headline}</Text>
                {/* Sub-copy is desktop-only — mobile keeps the bar to two lines */}
                {!isMobile && (
                  <Text style={styles.ctaCopy}>{bar.copy}</Text>
                )}
              </View>
              <View style={[styles.ctaActions, isMobile && styles.ctaActionsMobile]}>
                {bar.button && (
                  <View style={[styles.ctaBtn, isMobile && styles.ctaBtnMobile]}>
                    <Text style={styles.ctaBtnText}>{bar.button}</Text>
                  </View>
                )}
                {/* Secondary action: existing users go straight to /login.
                    Inner Pressable wins the press over the bar's modal opener. */}
                {!isRegistered && (
                  <Pressable
                    onPress={() => { track('cta_login_tapped'); router.push('/login'); }}
                    accessibilityRole="link"
                    style={({ pressed }) => [styles.ctaLogin, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.ctaLoginText}>{bar.login}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </Pressable>
        </MotiView>
      )}

      {/* ── Auth feedback toast (?auth=error, ?logged_out=1) ──────────── */}
      <AuthToast />

      {/* ── Unlock modal ──────────────────────────────────────────────── */}
      {modal === 'unlock' && (
        <UnlockModal
          onClose={() => setModal('hidden')}
          onOpen={() => track('unlock_modal_opened', { waitlist: !!waitlist })}
          waitlistName={waitlist?.tenantName ?? null}
        />
      )}

      {/* ── Waitlist: the UK profile form, minus UK-only parts ────────── */}
      {modal === 'waitlist' && waitlist && (
        <ProfilingModal
          email={email}
          onClose={() => setModal('hidden')}
          onDone={() => setModal('hidden')}
          waitlist={{ tenantName: waitlist.tenantName, onJoined: waitlist.onJoined }}
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
  /** Set on a waitlist index: the modal invites people onto the waitlist. */
  waitlistName?: string | null;
}

type UnlockStep = 'form' | 'sending' | 'sent';

function UnlockModal({ onClose, onOpen, waitlistName = null }: UnlockModalProps) {
  const [email, setEmail] = useState('');
  const [step,  setStep]  = useState<UnlockStep>('form');
  const [error, setError] = useState<string | null>(null);

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
      await requestMagicLink(email);
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
          <LinearGradient
            colors={brand.gradient as unknown as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.accentLine}
          />

          {step === 'sent' ? (
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
                {waitlistName
                  ? "Open the link to finish joining the waitlist. It expires in one hour, so check your spam folder if it doesn't arrive."
                  : "The link expires in one hour. Check your spam folder if it doesn't arrive."}
              </Text>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.75 }]}
              >
                <Text style={styles.closeBtnText}>Got it</Text>
              </Pressable>
            </MotiView>
          ) : (
            <View style={styles.modalInner}>
              <Text style={styles.modalKicker}>{waitlistName ? 'Waitlist' : 'Free • Limited time only'}</Text>
              <Text style={styles.modalTitle}>
                {waitlistName ? `Join the ${waitlistName} waitlist` : 'Unlock the Complete Knox Index'}
              </Text>
              <Text style={styles.modalCopy}>
                {waitlistName
                  ? "Full access is by approval. Enter your email and we'll send you a sign-in link, then tell us a little about yourself and we'll review your request."
                  : "Enter your email and we'll send you a one-click access link."}
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
                {...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} })}
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

              {/* Alternative: one-tap Google sign-in (web only). */}
              {Platform.OS === 'web' && (
                <>
                  <View style={styles.orRow}>
                    <View style={styles.orLine} />
                    <Text style={styles.orText}>or</Text>
                    <View style={styles.orLine} />
                  </View>
                  {/* No onPress override — the button owns the Firebase popup
                      flow and fires google_signin_tapped itself. */}
                  <GoogleSignInButton disabled={step === 'sending'} />
                </>
              )}

              <Text style={styles.legalText}>
                We'll never share your email. Unsubscribe any time.{' '}
                <Text
                  style={styles.legalLink}
                  onPress={() => Linking.openURL('/privacy-policy')}
                  {...Platform.select({ web: { accessibilityRole: 'link' } as any, default: {} })}
                >
                  Read our Privacy Policy
                </Text>
                {' '}for more details.
              </Text>
            </View>
          )}
        </MotiView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Bar copy ──────────────────────────────────────────────────────────────────

interface BarCopy {
  kicker:   string;
  headline: string;
  copy:     string;
  /** Button label; null when there is nothing to do (already waiting). */
  button:   string | null;
  login:    string;
}

function barCopy(waitlist: WaitlistState | null, signedIn: boolean): BarCopy {
  if (!waitlist) {
    return {
      kicker:   'GET ACCESS FOR FREE',
      headline: 'Want complete access?',
      copy:     'Register via email - free for a limited time only.',
      button:   'REGISTER →',
      login:    'Already registered? Log in',
    };
  }
  const login = 'Already approved? Log in';
  if (!signedIn && waitlist.joinedEmail) {
    return {
      kicker:   'ON THE WAITLIST',
      headline: "You're on the waitlist",
      copy:     `We'll email ${waitlist.joinedEmail} as soon as your access is approved.`,
      button:   null,
      login,
    };
  }
  if (!signedIn) {
    return {
      kicker:   'JOIN THE WAITLIST',
      headline: 'Want complete access?',
      copy:     `Full access to ${waitlist.tenantName} is by approval. Join the waitlist and we'll email you when you're in.`,
      button:   'JOIN WAITLIST →',
      login,
    };
  }
  if (waitlist.reason === 'none') {
    return {
      kicker:   'ONE MORE STEP',
      headline: 'Finish joining the waitlist',
      copy:     'Tell us a little about yourself so we can review your request.',
      button:   'CONTINUE →',
      login,
    };
  }
  if (waitlist.reason === 'denied') {
    return {
      kicker:   'WAITLIST',
      headline: 'Access not approved',
      copy:     'If you think this is a mistake, please get in touch.',
      button:   null,
      login,
    };
  }
  return {
    kicker:   'ON THE WAITLIST',
    headline: "You're on the waitlist",
    copy:     "We'll email you as soon as your access is approved.",
    button:   null,
    login,
  };
}

// ── Profiling modal ───────────────────────────────────────────────────────────

interface ProfilingModalProps {
  /** Signed-in address; null on the waitlist shows an email field instead. */
  email:   string | null;
  onClose: () => void;
  onDone:  () => void;
  /**
   * Set on a waitlist index (World Leaders): the same form, minus the UK-only
   * parts (briefing, UK-only interests), with an email field, sent as a
   * waitlist request. Null for The Knox Index's post-sign-in profile.
   */
  waitlist?: { tenantName: string; onJoined: (email: string) => void | Promise<void> } | null;
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

// Local ConsentRow has been extracted to the <ConsentToggleRow> primitive.

// ── ProfilingModal ────────────────────────────────────────────────────────────

function ProfilingModal({ email, onClose, onDone, waitlist = null }: ProfilingModalProps) {
  const isWaitlist = !!waitlist;
  const interestOptions = interestsFor(!isWaitlist);
  const [typedEmail, setTypedEmail] = useState('');
  const [joined,     setJoined]     = useState<{ email: string; knox: boolean } | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [company,   setCompany]   = useState('');
  // Stores JUST the handle. Full URL is reconstructed via buildLinkedinUrl
  // at submit time so the rest of the system (Brevo, downstream emails)
  // continues to receive a complete URL.
  const [linkedinHandle, setLinkedinHandle] = useState('');
  const [segment,   setSegment]   = useState<string | null>(null);
  const [otherText, setOtherText] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [consentUpdates,  setConsentUpdates]  = useState(true);
  // Briefing frequency — mutually-exclusive pair. Weekly is the default
  // cadence for now (Daily is hidden in FrequencyPicker), so a user who
  // skims through lands on a weekly subscription. Flip these to restore daily.
  const [consentDaily,    setConsentDaily]    = useState(false);
  const [consentWeekly,   setConsentWeekly]   = useState(true);
  const [consentKnox,     setConsentKnox]     = useState(false);
  const [loading, setLoading] = useState(false);

  const progress =
    segment && interests.length > 0 ? 100 :
    segment || interests.length > 0 ? 50  : 0;

  function toggleInterest(id: string) {
    setInterests(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function handleSubmit() {
    setLoading(true);
    const resolvedSegment = segment === 'other' && otherText.trim()
      ? `other:${otherText.trim()}`
      : segment ?? '';

    // Reconstruct full LinkedIn URL from the captured handle for storage/Brevo.
    const linkedinUrl = buildLinkedinUrl(linkedinHandle);

    if (waitlist) {
      // One step: the answers become a waitlist request and a Brevo contact.
      // No email to confirm; the approval email signs them in.
      const address = (email ?? typedEmail).trim().toLowerCase();
      setError(null);
      try {
        const res = await fetch('/api/tenant/access', {
          method:      'POST',
          credentials: 'same-origin',
          headers:     { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email:              address,
            firstName:          firstName.trim(),
            lastName:           lastName.trim(),
            company:            company.trim(),
            linkedin:           linkedinUrl,
            segment:            resolvedSegment,
            interests,
            consentKnoxUpdates: consentUpdates,
            consentKnoxDigital: consentKnox,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error ?? 'We could not send that. Please try again.');
        const knox = data?.status === 'signin';
        setJoined({ email: data?.email ?? address, knox });
        if (!knox) {
          track('waitlist_joined', {
            signed_in:       !!email,
            segment:         resolvedSegment || null,
            interests_count: interests.length,
            consent_updates: consentUpdates,
          });
          await waitlist.onJoined(data?.email ?? address);
        }
      } catch (err: any) {
        setError(err?.message ?? 'We could not send that. Please try again.');
      } finally {
        setLoading(false);
      }
      return;
    }

    const storedEmail = email ?? (Platform.OS === 'web' ? (localStorage.getItem('tki_email') ?? '') : '');

    // Write to localStorage
    if (Platform.OS === 'web') {
      localStorage.setItem('tki_firstname',        firstName.trim());
      localStorage.setItem('tki_lastname',         lastName.trim());
      localStorage.setItem('tki_company',          company.trim());
      localStorage.setItem('tki_linkedin',         linkedinUrl);
      localStorage.setItem('tki_segment',          resolvedSegment);
      localStorage.setItem('tki_interests',        JSON.stringify(interests));
      localStorage.setItem('tki_consent_updates',          consentUpdates ? '1' : '0');
      localStorage.setItem('tki_consent_briefing',         consentDaily   ? '1' : '0');
      localStorage.setItem('tki_consent_weekly_briefing',  consentWeekly  ? '1' : '0');
      localStorage.setItem('tki_consent_knox',             consentKnox    ? '1' : '0');
    }

    try {
      // Existing register call (DB)
      await fetch('/api/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: storedEmail, segment: resolvedSegment, interests, profileUpdate: true }),
      });
    } catch { /* non-fatal */ }

    try {
      // Preferences call → Brevo
      await fetch('/api/preferences', {
        method:      'POST',
        credentials: 'same-origin',
        headers:     { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName:             firstName.trim(),
          lastName:              lastName.trim(),
          company:               company.trim(),
          linkedin:              linkedinUrl,
          segment:               resolvedSegment,
          interests,
          consentKnoxUpdates:    consentUpdates,
          consentDailyBriefing:  consentDaily,
          consentWeeklyBriefing: consentWeekly,
          consentKnoxDigital:    consentKnox,
        }),
      });
    } catch { /* non-fatal */ }

    track('user_profiled', {
      segment:                 resolvedSegment ?? null,
      interests:               interests.join(','),
      interests_count:         interests.length,
      consent_updates:         consentUpdates,
      consent_daily_briefing:  consentDaily,
      consent_weekly_briefing: consentWeekly,
    });

    setLoading(false);
    onDone();
  }

  const emailOk   = !isWaitlist || !!email || EMAIL_RE.test(typedEmail.trim());
  const canSubmit = (!!segment || interests.length > 0) && emailOk;

  return (
    <Modal transparent animationType="fade" onRequestClose={isWaitlist ? onClose : () => {}}>
      <View style={proStyles.backdrop}>
        {isWaitlist && <Pressable style={StyleSheet.absoluteFill} onPress={loading ? undefined : onClose} />}
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
            {isWaitlist ? (
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
                <FontAwesome6 name="xmark" size={16} color={neutral.textMid} />
              </Pressable>
            ) : (
              <Text style={proStyles.progressLabel}>{progress}% complete</Text>
            )}
          </View>

          <ProgressBar progress={joined ? 100 : progress} />

          {joined ? (
            <View style={proStyles.joinedWrap}>
              <FontAwesome6 name="circle-check" size={36} color={accent.mint} solid />
              <Text style={proStyles.title}>{joined.knox ? 'Knox addresses get straight in' : "You're on the waitlist"}</Text>
              <Text style={proStyles.subtitle}>
                {joined.knox
                  ? `${joined.email} doesn't need approval. Sign in with it to open the full dashboard.`
                  : `The Knox team reviews every request. We'll email ${joined.email} as soon as you're approved.`}
              </Text>
              <Pressable
                onPress={() => { onClose(); if (joined.knox) router.push('/login'); }}
                style={({ pressed }) => [proStyles.submitBtn, pressed && { opacity: 0.88 }]}
              >
                <Text style={proStyles.submitBtnText}>{joined.knox ? 'Sign in' : 'Got it'}</Text>
              </Pressable>
            </View>
          ) : (<>
          {/* Scrollable body */}
          <ScrollView
            style={proStyles.body}
            contentContainerStyle={proStyles.bodyInner}
            showsVerticalScrollIndicator={false}
          >
            <Text style={proStyles.title}>{isWaitlist ? `Join the ${waitlist!.tenantName} waitlist` : 'Help us tailor your experience'}</Text>
            <Text style={proStyles.subtitle}>
              {isWaitlist
                ? "Takes 30 seconds. Full access is approved by the Knox team, and we'll email you when you're in."
                : 'Takes 30 seconds. Helps us surface the most relevant intelligence for the way you work.'}
            </Text>

            {/* ── Your details ──────────────────────────────────────── */}
            <View style={proStyles.section}>
              <Text style={proStyles.sectionTitle}>Your details</Text>
              <View style={proStyles.detailsGrid}>
                {isWaitlist && !email && (
                  <View style={[proStyles.detailsField, proStyles.detailsFieldWide]}>
                    <Text style={proStyles.fieldLabel}>EMAIL</Text>
                    <TextInput
                      value={typedEmail}
                      onChangeText={setTypedEmail}
                      placeholder="you@example.com"
                      placeholderTextColor={neutral.textDim}
                      style={proStyles.textInput}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoFocus
                      returnKeyType="next"
                      {...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} })}
                    />
                  </View>
                )}
                <View style={proStyles.detailsField}>
                  <Text style={proStyles.fieldLabel}>FIRST NAME</Text>
                  <TextInput
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="Jane"
                    placeholderTextColor={neutral.textDim}
                    style={proStyles.textInput}
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="next"
                    {...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} })}
                  />
                </View>
                <View style={proStyles.detailsField}>
                  <Text style={proStyles.fieldLabel}>LAST NAME</Text>
                  <TextInput
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Smith"
                    placeholderTextColor={neutral.textDim}
                    style={proStyles.textInput}
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="next"
                    {...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} })}
                  />
                </View>
                <View style={proStyles.detailsField}>
                  <Text style={proStyles.fieldLabel}>COMPANY / ORGANISATION</Text>
                  <TextInput
                    value={company}
                    onChangeText={setCompany}
                    placeholder="Acme Political Consulting"
                    placeholderTextColor={neutral.textDim}
                    style={proStyles.textInput}
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="next"
                    {...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} })}
                  />
                </View>
                <View style={proStyles.detailsField}>
                  <Text style={proStyles.fieldLabel}>LINKEDIN</Text>
                  <LinkedinInput
                    value={linkedinHandle}
                    onChange={setLinkedinHandle}
                    inputStyle={proStyles.textInput}
                  />
                </View>
              </View>
            </View>

            {/* ── Who are you? ──────────────────────────────────────── */}
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

            {/* ── What do you want to do? ───────────────────────────── */}
            <View style={proStyles.section}>
              <View style={proStyles.sectionHeadRow}>
                <Text style={proStyles.sectionTitle}>What do you want to do?</Text>
                <Text style={proStyles.sectionHint}>Pick all that apply</Text>
              </View>
              <View style={proStyles.cardGrid}>
                {interestOptions.map(v => {
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

            {/* ── Stay in the loop ──────────────────────────────────── */}
            <View style={proStyles.section}>
              <View style={proStyles.sectionHeadRow}>
                <Text style={proStyles.sectionTitle}>Stay in the loop</Text>
                <Text style={proStyles.sectionHint}>Optional</Text>
              </View>
              {/* Briefing frequency — Daily / Weekly / None. UK only: the
                  briefing covers The Knox Index, so the waitlist leaves it out. */}
              {!isWaitlist && (
              <View style={proStyles.briefingBlock}>
                <Text style={proStyles.briefingLabel}>The Knox Index Briefing</Text>
                <FrequencyPicker
                  daily={consentDaily}
                  weekly={consentWeekly}
                  onChange={({ daily, weekly }) => {
                    setConsentDaily(daily);
                    setConsentWeekly(weekly);
                  }}
                />
              </View>
              )}

              <View style={proStyles.consentCard}>
                <ConsentToggleRow
                  checked={consentUpdates}
                  onToggle={() => setConsentUpdates(v => !v)}
                  label="Knox Index Product Updates"
                  desc="News about new features, improvements, and platform announcements."
                />
                <View style={proStyles.consentDivider} />
                <ConsentToggleRow
                  checked={consentKnox}
                  onToggle={() => setConsentKnox(v => !v)}
                  label="Knox Digital News"
                  desc="Occasional updates from the Knox Digital team about other products and services."
                />
              </View>
              <Text style={proStyles.consentNote}>
                You can change these preferences at any time.{' '}
                <Text
                  style={proStyles.consentLink}
                  onPress={() => Linking.openURL('/privacy-policy')}
                  {...Platform.select({ web: { accessibilityRole: 'link' } as any, default: {} })}
                >
                  Privacy Policy
                </Text>
              </Text>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={proStyles.footerDivider} />
          {error ? <Text style={proStyles.errorText}>{error}</Text> : null}
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
                    <Text style={proStyles.submitBtnText}>{isWaitlist ? 'Join the waitlist' : 'Save & continue'}</Text>
                    <FontAwesome6 name="arrow-right" size={13} color="#fff" solid />
                  </View>
              }
            </Pressable>
          </View>
          </>)}
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
  // ── CTA bar — sized to roughly half the previous footprint ──────────────
  // Padding, font sizes and button dimensions are all stepped down so the
  // bar reads as a single dense pill rather than a panel.
  ctaBar: {
    backgroundColor:   'rgba(12,12,28,0.96)',
    borderWidth:       1,
    borderColor:       accent.indigo,
    borderRadius:      radius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical:   spacing.md,
    maxWidth:          560,
    width:             '94%' as any,
    ...Platform.select({
      web: {
        backdropFilter:       'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow:            '0 8px 36px rgba(95,100,189,0.32)',
        cursor:               'pointer',
      } as any,
      default: {
        shadowColor:   accent.indigo,
        shadowOffset:  { width: 0, height: 8 },
        shadowOpacity: 0.34,
        shadowRadius:  24,
      },
    }),
  },
  ctaInner:     { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  // Mobile: stack vertically so the button gets its own row at full-width
  ctaInnerMobile: {
    flexDirection: 'column',
    alignItems:    'stretch',
    gap:           spacing.sm,
  },
  ctaTextGroup: { flex: 1, gap: 2 },
  ctaKicker: {
    ...type.caption,
    fontSize:      11,
    color:         accent.indigo,
    letterSpacing: 1.2,
  },
  ctaHeadline: { ...type.title, fontSize: 16, color: neutral.text, fontWeight: '700' },
  ctaCopy:     { ...type.body,  fontSize: 12, color: neutral.textMid, lineHeight: 16 },
  ctaBtn: {
    backgroundColor:   accent.indigo,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.sm,
    borderRadius:      radius.pill,
    flexShrink:        0,
    alignItems:        'center',
    ...Platform.select({ web: { boxShadow: '0 4px 18px rgba(95,100,189,0.45)' } as any, default: {} }),
  },
  // Mobile: button takes the full width of the stacked column
  ctaBtnMobile: {
    alignSelf:       'stretch',
    paddingVertical: spacing.md,
  },
  ctaBtnText: { ...type.caption, color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },

  // Register pill + log-in link stack vertically, centred
  ctaActions: {
    alignItems: 'center',
    flexShrink: 0,
    gap:        spacing.xs,
  },
  ctaActionsMobile: {
    alignSelf: 'stretch',
  },
  ctaLogin: {
    paddingVertical:   2,
    paddingHorizontal: spacing.sm,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  ctaLoginText: {
    fontFamily:         font.ui,
    fontSize:           11,
    color:              neutral.textMid,
    textDecorationLine: 'underline',
  },

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
  accentLine:  { height: 6 },
  modalInner:  { padding: spacing.xl, gap: spacing.md },
  modalKicker: { ...type.caption, fontSize: 12, color: accent.indigo, letterSpacing: 1.5 },
  modalTitle:  { ...type.title, fontSize: 24, color: neutral.text, fontWeight: '700', marginTop: 2 },
  modalCopy:   { ...type.body, fontSize: 16, color: neutral.textMid, lineHeight: 20 },
  input: {
    backgroundColor:   glass.fill,
    borderWidth:       1,
    borderColor:       glass.border,
    borderRadius:      radius.md,
    color:             neutral.text,
    fontSize:          16,
    paddingHorizontal: spacing.md,
    paddingVertical:   12,
    ...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} }),
  },
  errorText: { ...type.body, color: '#FF6B6B', fontSize: 12 },
  submitBtn: {
    backgroundColor: accent.indigo,
    borderRadius:    radius.pill,
    paddingVertical: 14,
    alignItems:      'center',
    marginTop:       spacing.xs,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  submitBtnText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  orRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.md },
  orLine: { flex: 1, height: 1, backgroundColor: glass.border },
  orText: { ...type.caption, fontSize: 11, color: neutral.textMid, letterSpacing: 1, textTransform: 'uppercase' },
  legalText:     { ...type.caption, fontSize: 12, color: neutral.textDim, textAlign: 'center' },
  legalLink:     { color: neutral.textMid, textDecorationLine: 'underline' },

  sentWrap: { padding: spacing.xl, alignItems: 'center', gap: spacing.md },
  sentIconWrap: {
    width:           72,
    height:          72,
    borderRadius:    36,
    backgroundColor: 'rgba(63,230,177,0.1)',
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    spacing.xs,
  },
  sentTitle: { ...type.title, fontSize: 24, color: neutral.text, fontWeight: '700' },
  sentCopy: {
    ...type.body,
    fontSize:   16,
    color:      neutral.textMid,
    textAlign:  'center',
    lineHeight: 22,
  },
  sentEmail: { color: neutral.text, fontWeight: '600' },
  sentHint: {
    ...type.body,
    fontSize:   12,
    color:      neutral.textDim,
    textAlign:  'center',
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
  brandLabel:    { fontFamily: font.bold, fontSize: 12, color: neutral.textDim, letterSpacing: 2 },
  progressLabel: { fontFamily: font.ui, fontSize: 12, color: neutral.textDim },
  progressTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  progressFill:  { height: 3, backgroundColor: accent.indigo, borderRadius: 2 },

  body:      { flex: 1 },
  bodyInner: { padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xl + 4 },

  title:    { fontFamily: font.bold, fontSize: 28, color: neutral.text, lineHeight: 34 },
  subtitle: { fontFamily: font.ui, fontSize: 16, color: neutral.textMid, lineHeight: 22, marginTop: 4 },

  section:        { gap: spacing.md },
  sectionHeadRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionTitle:   { fontFamily: font.bold, fontSize: 16, color: neutral.text },
  sectionHint:    { fontFamily: font.ui, fontSize: 12, color: neutral.textDim },

  // Details fields
  detailsGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.md,
  },
  detailsField: {
    flex:     1,
    minWidth: 200,
    gap:      4,
  },
  // Waitlist email: a full row above the name fields.
  detailsFieldWide: {
    flexBasis: '100%',
  },
  // Waitlist: the confirmation that replaces the form once sent.
  joinedWrap: {
    alignItems:        'flex-start',
    gap:               spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical:   spacing.xl,
  },
  errorText: {
    fontFamily:        font.ui,
    fontSize:          13,
    color:             '#FF4F6E',
    paddingHorizontal: spacing.xl,
    paddingTop:        spacing.sm,
  },
  fieldLabel: {
    fontFamily:    font.bold,
    fontSize:      12,
    color:         neutral.textDim,
    letterSpacing: 0.8,
  },
  textInput: {
    backgroundColor:   'rgba(255,255,255,0.05)',
    borderWidth:       1,
    borderColor:       glass.border,
    borderRadius:      radius.md,
    color:             neutral.text,
    fontFamily:        font.ui,
    fontSize:          16,
    paddingHorizontal: spacing.md,
    paddingVertical:   10,
  },

  // Segment / interest grids
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
    ...Platform.select({ web: { cursor: 'pointer', transitionProperty: 'border-color, background-color', transitionDuration: '140ms' } as any, default: {} }),
  },
  segCardActive:      { borderColor: accent.indigo, backgroundColor: 'rgba(95,100,189,0.08)' },
  segCardText:        { flex: 1, gap: 2, minWidth: 0 },
  segCardLabel:       { fontFamily: font.bold, fontSize: 16, color: neutral.textMid },
  segCardLabelActive: { color: neutral.text },
  segCardSub:         { fontFamily: font.ui, fontSize: 12, color: neutral.textDim, lineHeight: 16 },
  otherWrap:          { marginTop: spacing.sm },
  otherInput: {
    backgroundColor:   'rgba(255,255,255,0.05)',
    borderWidth:       1.5,
    borderColor:       accent.indigo,
    borderRadius:      radius.md,
    color:             neutral.text,
    fontFamily:        font.ui,
    fontSize:          16,
    paddingHorizontal: spacing.md,
    paddingVertical:   12,
  },
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
    ...Platform.select({ web: { cursor: 'pointer', transitionProperty: 'border-color, background-color', transitionDuration: '140ms' } as any, default: {} }),
  },
  interestCardActive:  { borderColor: accent.indigo, backgroundColor: 'rgba(95,100,189,0.08)' },
  interestCardText:    { flex: 1, gap: 3, minWidth: 0 },
  interestLabel:       { fontFamily: font.bold, fontSize: 16, color: neutral.textMid },
  interestLabelActive: { color: neutral.text },
  interestDesc:        { fontFamily: font.ui, fontSize: 12, color: neutral.textDim, lineHeight: 16 },
  iconWrap: {
    width:           40,
    height:          40,
    borderRadius:    radius.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  iconWrapActive: { backgroundColor: 'rgba(95,100,189,0.14)' },
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

  // Briefing frequency block (sits above the consent rows)
  briefingBlock: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  briefingLabel: {
    fontFamily: font.bold,
    fontSize:   16,
    color:      neutral.text,
  },

  // Consent
  consentCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth:     1,
    borderColor:     glass.border,
    borderRadius:    radius.md,
    overflow:        'hidden',
  },
  consentRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  checkbox: {
    width:        22,
    height:       22,
    borderRadius: 6,
    borderWidth:  1.5,
    alignItems:   'center',
    justifyContent: 'center',
    flexShrink:   0,
  },
  consentText:  { flex: 1, gap: 2 },
  consentLabel: { fontFamily: font.bold, fontSize: 16, color: neutral.text },
  consentDesc:  { fontFamily: font.ui, fontSize: 12, color: neutral.textDim, lineHeight: 16 },
  consentDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: spacing.lg },
  consentNote: {
    fontFamily: font.ui,
    fontSize:   12,
    color:      neutral.textDim,
    lineHeight: 17,
    marginTop:  spacing.xs,
  },
  consentLink: { color: neutral.textMid, textDecorationLine: 'underline' },

  // Footer
  footerDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  footer: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical:   spacing.lg,
  },
  submitBtn: {
    backgroundColor:   accent.indigo,
    borderRadius:      radius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical:   12,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  submitBtnDisabled: { backgroundColor: 'rgba(95,100,189,0.35)' },
  submitBtnInner:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  submitBtnText:     { fontFamily: font.bold, fontSize: 16, color: '#fff', letterSpacing: 0.3 },
});
