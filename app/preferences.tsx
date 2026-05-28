import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { HeaderNav } from '@/components/primitives/HeaderNav';
import { useAuth } from '@/hooks/useAuth';
import { neutral, glass, accent } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { type, font } from '@/theme/typography';
import { breakpoints } from '@/theme/breakpoints';
import { SEGMENTS, INTERESTS } from '@/data/profileOptions';
import { track } from '@/lib/analytics';

/**
 * PreferencesScreen  (/preferences)
 * -----------------------------------
 * Let registered users set their name, company, LinkedIn, segment,
 * interests, and comms consent. Auth-gated — redirects to / if no session.
 *
 * Saves to:
 *   1. localStorage — for instant re-hydration
 *   2. POST /api/preferences → Brevo contact attributes
 *
 * One job: give users control over their profile.
 */

// ── localStorage keys ─────────────────────────────────────────────────────────
const LS = {
  FIRSTNAME:        'tki_firstname',
  LASTNAME:         'tki_lastname',
  COMPANY:          'tki_company',
  LINKEDIN:         'tki_linkedin',
  SEGMENT:          'tki_segment',
  INTERESTS:        'tki_interests',
  CONSENT_UPDATES:  'tki_consent_updates',
  CONSENT_BRIEFING: 'tki_consent_briefing',
  CONSENT_KNOX:     'tki_consent_knox',
};

function readLS(key: string): string {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return '';
  return localStorage.getItem(key) ?? '';
}

function readLSArray(key: string): string[] {
  try {
    const v = readLS(key);
    return v ? JSON.parse(v) : [];
  } catch { return []; }
}

// ── Consent toggle row ────────────────────────────────────────────────────────

interface ConsentRowProps {
  checked:  boolean;
  onToggle: () => void;
  label:    string;
  desc:     string;
}

function ConsentRow({ checked, onToggle, label, desc }: ConsentRowProps) {
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [styles.consentRow, pressed && { opacity: 0.8 }]}
    >
      <MotiView
        animate={{
          backgroundColor: checked ? accent.indigo : 'rgba(255,255,255,0.05)',
          borderColor:     checked ? accent.indigo  : 'rgba(255,255,255,0.15)',
        }}
        transition={{ type: 'timing', duration: 160 }}
        style={styles.checkbox}
      >
        {checked && (
          <MotiView
            from={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 14, stiffness: 300 }}
          >
            <FontAwesome6 name="check" size={9} color="#fff" solid />
          </MotiView>
        )}
      </MotiView>
      <View style={styles.consentText}>
        <Text style={styles.consentLabel}>{label}</Text>
        <Text style={styles.consentDesc}>{desc}</Text>
      </View>
    </Pressable>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function PreferencesScreen() {
  const { isRegistered, email, loading } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= breakpoints.tablet;
  const hPad   = isWide ? spacing.xl : spacing.base;

  useEffect(() => {
    if (!loading && !isRegistered) router.replace('/');
  }, [loading, isRegistered]);

  // ── Form state ───────────────────────────────────────────────────────────────
  const [firstName,       setFirstName]       = useState('');
  const [lastName,        setLastName]        = useState('');
  const [company,         setCompany]         = useState('');
  const [linkedin,        setLinkedin]        = useState('');
  const [segment,         setSegment]         = useState<string | null>(null);
  const [interests,       setInterests]       = useState<string[]>([]);
  const [otherText,       setOtherText]       = useState('');
  const [consentUpdates,  setConsentUpdates]  = useState(true);
  const [consentBriefing, setConsentBriefing] = useState(true);
  const [consentKnox,     setConsentKnox]     = useState(false);
  const [saveState,        setSaveState]       = useState<SaveState>('idle');
  const [copied,           setCopied]          = useState(false);
  const [showChangeEmail,  setShowChangeEmail] = useState(false);
  const [newEmail,         setNewEmail]        = useState('');
  const [changeEmailState, setChangeEmailState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  // Hydrate from localStorage on mount
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    setFirstName(readLS(LS.FIRSTNAME));
    setLastName(readLS(LS.LASTNAME));
    setCompany(readLS(LS.COMPANY));
    setLinkedin(readLS(LS.LINKEDIN));
    const seg = readLS(LS.SEGMENT);
    if (seg.startsWith('other:')) {
      setSegment('other');
      setOtherText(seg.replace('other:', ''));
    } else {
      setSegment(seg || null);
    }
    setInterests(readLSArray(LS.INTERESTS));
    const savedUpdates  = readLS(LS.CONSENT_UPDATES);
    const savedBriefing = readLS(LS.CONSENT_BRIEFING);
    setConsentUpdates(savedUpdates   === '' ? true : savedUpdates   === '1');
    setConsentBriefing(savedBriefing === '' ? true : savedBriefing  === '1');
    setConsentKnox(readLS(LS.CONSENT_KNOX) === '1');
  }, []);

  const toggleInterest = useCallback((id: string) => {
    setInterests(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const handleCopyEmail = useCallback(() => {
    if (!email || Platform.OS !== 'web') return;
    navigator.clipboard.writeText(email).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [email]);

  const handleChangeEmail = useCallback(async () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return;
    setChangeEmailState('sending');
    try {
      const res = await fetch('/api/auth/request', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: trimmed }),
      });
      if (!res.ok) throw new Error();
      setChangeEmailState('sent');
    } catch {
      setChangeEmailState('error');
      setTimeout(() => setChangeEmailState('idle'), 3000);
    }
  }, [newEmail]);

  const handleSave = useCallback(async () => {
    setSaveState('saving');

    const resolvedSegment = segment === 'other' && otherText.trim()
      ? `other:${otherText.trim()}`
      : segment ?? '';

    if (Platform.OS === 'web') {
      localStorage.setItem(LS.FIRSTNAME,        firstName.trim());
      localStorage.setItem(LS.LASTNAME,         lastName.trim());
      localStorage.setItem(LS.COMPANY,          company.trim());
      localStorage.setItem(LS.LINKEDIN,         linkedin.trim());
      localStorage.setItem(LS.SEGMENT,          resolvedSegment);
      localStorage.setItem(LS.INTERESTS,        JSON.stringify(interests));
      localStorage.setItem(LS.CONSENT_UPDATES,  consentUpdates  ? '1' : '0');
      localStorage.setItem(LS.CONSENT_BRIEFING, consentBriefing ? '1' : '0');
      localStorage.setItem(LS.CONSENT_KNOX,     consentKnox     ? '1' : '0');
      localStorage.setItem('tki_profiled', '1');
    }

    try {
      await fetch('/api/preferences', {
        method:      'POST',
        credentials: 'same-origin',
        headers:     { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName:            firstName.trim(),
          lastName:             lastName.trim(),
          company:              company.trim(),
          linkedin:             linkedin.trim(),
          segment:              resolvedSegment,
          interests,
          consentKnoxUpdates:   consentUpdates,
          consentDailyBriefing: consentBriefing,
          consentKnoxDigital:   consentKnox,
        }),
      });
      track('preferences_saved', {
        has_name:        !!(firstName.trim() || lastName.trim()),
        segment:         resolvedSegment,
        interests_count: interests.length,
        consent_updates: consentUpdates,
        consent_briefing: consentBriefing,
      });
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2400);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 3000);
    }
  }, [firstName, lastName, company, linkedin, segment, otherText, interests, consentUpdates, consentBriefing, consentKnox]);

  if (loading || !isRegistered) return null;

  return (
    <View style={styles.root}>
      {/* Knox product gradient — dark for the top 75%, horizon glow at the foot */}
      <LinearGradient colors={['#1F1D1D', '#1F1D1D', '#35393B']} locations={[0, 0.75, 1]} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safe} edges={['top']}>

        <HeaderNav activeRoute="/preferences" />

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: hPad }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ───────────────────────────────────────────── */}
          <MotiView
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 320 }}
          >
            <Text style={styles.kicker}>YOUR ACCOUNT</Text>
            <Text style={styles.title}>Preferences</Text>
            <Text style={styles.subtitle}>
              Personalise your experience and help us surface the most relevant intelligence for you.
            </Text>
          </MotiView>

          {/* ── Personal info card ───────────────────────────────── */}
          <MotiView
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 320, delay: 60 }}
            style={styles.card}
          >
            <Text style={styles.cardTitle}>Your details</Text>

            <View style={[styles.nameRow, isWide && styles.nameRowWide]}>
              <View style={styles.nameField}>
                <Text style={styles.label}>First name</Text>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="Jane"
                  placeholderTextColor={neutral.textDim}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                  {...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} })}
                />
              </View>
              <View style={styles.nameField}>
                <Text style={styles.label}>Last name</Text>
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Smith"
                  placeholderTextColor={neutral.textDim}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                  {...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} })}
                />
              </View>
            </View>

            <View style={{ gap: 4 }}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.emailField}>
                <Text style={styles.emailText}>{email ?? '—'}</Text>
                <View style={styles.emailActions}>
                  <Pressable
                    onPress={handleCopyEmail}
                    style={({ pressed }) => [styles.emailAction, pressed && { opacity: 0.65 }]}
                  >
                    <FontAwesome6 name={copied ? 'check' : 'copy'} size={11} color={copied ? accent.mint : neutral.textDim} solid />
                    <Text style={[styles.emailActionText, copied && { color: accent.mint }]}>
                      {copied ? 'Copied' : 'Copy'}
                    </Text>
                  </Pressable>
                  <View style={styles.emailActionSep} />
                  <Pressable
                    onPress={() => { setShowChangeEmail(v => !v); setChangeEmailState('idle'); setNewEmail(''); }}
                    style={({ pressed }) => [styles.emailAction, pressed && { opacity: 0.65 }]}
                  >
                    <FontAwesome6 name="pen" size={10} color={neutral.textDim} solid />
                    <Text style={styles.emailActionText}>Change email</Text>
                  </Pressable>
                </View>
              </View>

              {showChangeEmail && changeEmailState !== 'sent' && (
                <MotiView
                  from={{ opacity: 0, translateY: -6 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 200 }}
                  style={styles.changeEmailWrap}
                >
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={newEmail}
                    onChangeText={setNewEmail}
                    placeholder="new@email.com"
                    placeholderTextColor={neutral.textDim}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                    editable={changeEmailState === 'idle'}
                    onSubmitEditing={handleChangeEmail}
                    {...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} })}
                  />
                  <Pressable
                    onPress={handleChangeEmail}
                    disabled={changeEmailState === 'sending'}
                    style={({ pressed }) => [
                      styles.changeEmailBtn,
                      changeEmailState === 'error' && styles.changeEmailBtnError,
                      changeEmailState === 'sending' && { opacity: 0.6 },
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    {changeEmailState === 'sending'
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.changeEmailBtnText}>
                          {changeEmailState === 'error' ? 'Error' : 'Send link'}
                        </Text>
                    }
                  </Pressable>
                </MotiView>
              )}

              {changeEmailState === 'sent' && (
                <MotiView
                  from={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ type: 'timing', duration: 200 }}
                  style={styles.changeEmailSent}
                >
                  <FontAwesome6 name="envelope-circle-check" size={13} color={accent.mint} solid />
                  <Text style={styles.changeEmailSentText}>
                    Magic link sent to <Text style={{ color: neutral.text }}>{newEmail.trim().toLowerCase()}</Text>. Click it to switch to that address.
                  </Text>
                </MotiView>
              )}
            </View>

            <View style={[styles.nameRow, isWide && styles.nameRowWide]}>
              <View style={styles.nameField}>
                <Text style={styles.label}>Company / Organisation</Text>
                <TextInput
                  style={styles.input}
                  value={company}
                  onChangeText={setCompany}
                  placeholder="Acme Political Consulting"
                  placeholderTextColor={neutral.textDim}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                  {...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} })}
                />
              </View>
              <View style={styles.nameField}>
                <Text style={styles.label}>LinkedIn</Text>
                <TextInput
                  style={styles.input}
                  value={linkedin}
                  onChangeText={setLinkedin}
                  placeholder="linkedin.com/in/janesmith"
                  placeholderTextColor={neutral.textDim}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="next"
                  {...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} })}
                />
              </View>
            </View>
          </MotiView>

          {/* ── Who are you? ─────────────────────────────────────── */}
          <MotiView
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 320, delay: 120 }}
            style={styles.card}
          >
            <View style={styles.cardHeadRow}>
              <Text style={styles.cardTitle}>Who are you?</Text>
              <Text style={styles.cardHint}>Pick one</Text>
            </View>

            <View style={styles.grid}>
              {SEGMENTS.map(s => {
                const active = segment === s.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => setSegment(active ? null : s.id)}
                    style={({ pressed }) => [
                      styles.optionCard,
                      active && styles.optionCardActive,
                      pressed && { opacity: 0.82 },
                    ]}
                  >
                    <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
                      <FontAwesome6 name={s.icon as any} size={20} color={active ? accent.indigo : neutral.textMid} solid />
                    </View>
                    <View style={styles.optionText}>
                      <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{s.label}</Text>
                      <Text style={styles.optionSub}>{s.sub}</Text>
                    </View>
                    {active && (
                      <View style={styles.checkBadge}>
                        <FontAwesome6 name="check" size={9} color="#fff" solid />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {segment === 'other' && (
              <MotiView
                from={{ opacity: 0, translateY: -4 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 180 }}
              >
                <TextInput
                  value={otherText}
                  onChangeText={setOtherText}
                  placeholder="Tell us who you are…"
                  placeholderTextColor={neutral.textDim}
                  style={styles.otherInput}
                  maxLength={80}
                  autoFocus
                  {...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} })}
                />
              </MotiView>
            )}
          </MotiView>

          {/* ── What do you want to do? ──────────────────────────── */}
          <MotiView
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 320, delay: 180 }}
            style={styles.card}
          >
            <View style={styles.cardHeadRow}>
              <Text style={styles.cardTitle}>What do you want to do?</Text>
              <Text style={styles.cardHint}>Pick all that apply</Text>
            </View>

            <View style={styles.grid}>
              {INTERESTS.map(v => {
                const active = interests.includes(v.id);
                return (
                  <Pressable
                    key={v.id}
                    onPress={() => toggleInterest(v.id)}
                    style={({ pressed }) => [
                      styles.optionCard,
                      active && styles.optionCardActive,
                      pressed && { opacity: 0.82 },
                    ]}
                  >
                    <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
                      <FontAwesome6 name={v.icon as any} size={20} color={active ? accent.indigo : neutral.textMid} solid />
                    </View>
                    <View style={styles.optionText}>
                      <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{v.label}</Text>
                      <Text style={styles.optionSub}>{v.desc}</Text>
                    </View>
                    {active && (
                      <View style={styles.checkBadge}>
                        <FontAwesome6 name="check" size={9} color="#fff" solid />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </MotiView>

          {/* ── Stay in the loop ─────────────────────────────────── */}
          <MotiView
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 320, delay: 220 }}
            style={styles.card}
          >
            <View style={styles.cardHeadRow}>
              <Text style={styles.cardTitle}>Stay in the loop</Text>
              <Text style={styles.cardHint}>Optional</Text>
            </View>

            <View style={styles.consentCard}>
              <ConsentRow
                checked={consentBriefing}
                onToggle={() => setConsentBriefing(v => !v)}
                label="The Knox Index Daily Briefing"
                desc="A morning email with the top political TikTok stories of the day, delivered to your inbox."
              />
              <View style={styles.consentDivider} />
              <ConsentRow
                checked={consentUpdates}
                onToggle={() => setConsentUpdates(v => !v)}
                label="Knox Index Product Updates"
                desc="News about new features, improvements, and platform announcements."
              />
              <View style={styles.consentDivider} />
              <ConsentRow
                checked={consentKnox}
                onToggle={() => setConsentKnox(v => !v)}
                label="Knox Digital News"
                desc="Occasional updates from the Knox Digital team about other products and services."
              />
            </View>

            <Text style={styles.consentNote}>
              You can change these at any time. See our{' '}
              <Text
                style={styles.consentLink}
                onPress={() => router.push('/privacy-policy')}
                {...Platform.select({ web: { accessibilityRole: 'link' } as any, default: {} })}
              >
                Privacy Policy
              </Text>
              {' '}for full details.
            </Text>
          </MotiView>

          {/* ── Save button ──────────────────────────────────────── */}
          <MotiView
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 320, delay: 280 }}
            style={styles.saveWrap}
          >
            <Pressable
              onPress={handleSave}
              disabled={saveState === 'saving'}
              style={({ pressed }) => [
                styles.saveBtn,
                saveState === 'saved'  && styles.saveBtnSaved,
                saveState === 'error'  && styles.saveBtnError,
                saveState === 'saving' && { opacity: 0.65 },
                pressed && saveState === 'idle' && { opacity: 0.88 },
              ]}
            >
              {saveState === 'saving' ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <View style={styles.saveBtnInner}>
                  <FontAwesome6
                    name={saveState === 'saved' ? 'check' : saveState === 'error' ? 'triangle-exclamation' : 'floppy-disk'}
                    size={13}
                    color="#fff"
                    solid
                  />
                  <Text style={styles.saveBtnText}>
                    {saveState === 'saved'  ? 'Saved'
                   : saveState === 'error'  ? 'Error — try again'
                   : 'Save preferences'}
                  </Text>
                </View>
              )}
            </Pressable>
          </MotiView>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },

  nav: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingVertical:   spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: glass.border,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  backBtnText: { fontFamily: font.ui, fontSize: 16, color: neutral.textMid },
  navKicker:   { fontFamily: font.bold, fontSize: 12, color: neutral.textDim, letterSpacing: 2 },

  scroll: {
    paddingTop:    spacing.xl,
    paddingBottom: spacing.xxxl,
    gap:           spacing.xl,
    maxWidth:      860,
    alignSelf:     'center' as any,
    width:         '100%' as any,
  },
  kicker:   { fontFamily: font.bold, fontSize: 12, color: accent.indigo, letterSpacing: 1.5 },
  title:    { fontFamily: font.bold, fontSize: 32, color: neutral.text, marginTop: 4, letterSpacing: -0.5 },
  subtitle: { fontFamily: font.ui,   fontSize: 16, color: neutral.textMid, lineHeight: 22, marginTop: 6 },

  card: {
    backgroundColor: glass.fill,
    borderWidth:     1,
    borderColor:     glass.border,
    borderRadius:    radius.lg,
    padding:         spacing.xl,
    gap:             spacing.lg,
    ...Platform.select({
      web: {
        backdropFilter:       'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      } as any,
      default: {},
    }),
  },
  cardHeadRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  cardTitle:   { fontFamily: font.bold, fontSize: 16, color: neutral.text },
  cardHint:    { fontFamily: font.ui, fontSize: 12, color: neutral.textDim },

  label:       { fontFamily: font.bold, fontSize: 12, color: neutral.textMid, marginBottom: spacing.xs, letterSpacing: 0.3 },
  nameRow:     { gap: spacing.md },
  nameRowWide: { flexDirection: 'row' },
  nameField:   { flex: 1, gap: 4 },
  input: {
    backgroundColor:   'rgba(255,255,255,0.05)',
    borderWidth:       1,
    borderColor:       glass.border,
    borderRadius:      radius.md,
    color:             neutral.text,
    fontFamily:        font.ui,
    fontSize:          16,
    paddingHorizontal: spacing.md,
    paddingVertical:   12,
  },
  emailField: {
    backgroundColor:   'rgba(255,255,255,0.02)',
    borderWidth:       1,
    borderColor:       glass.border,
    borderRadius:      radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical:   12,
    gap:               3,
  },
  emailText:    { fontFamily: font.ui, fontSize: 16, color: neutral.textMid },
  emailActions: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: spacing.sm },
  emailAction:  {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  emailActionText: { fontFamily: font.ui, fontSize: 12, color: neutral.textDim },
  emailActionSep:  { width: 1, height: 10, backgroundColor: glass.border },
  changeEmailWrap: {
    flexDirection: 'row',
    gap:           spacing.sm,
    marginTop:     spacing.xs,
  },
  changeEmailBtn: {
    backgroundColor:   accent.indigo,
    borderRadius:      radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical:   12,
    alignItems:        'center',
    justifyContent:    'center',
    flexShrink:        0,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  changeEmailBtnError: { backgroundColor: '#8a2020' },
  changeEmailBtnText:  { fontFamily: font.bold, fontSize: 16, color: '#fff' },
  changeEmailSent: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             spacing.sm,
    backgroundColor: 'rgba(63,230,177,0.07)',
    borderWidth:     1,
    borderColor:     'rgba(63,230,177,0.2)',
    borderRadius:    radius.md,
    padding:         spacing.md,
    marginTop:       spacing.xs,
  },
  changeEmailSentText: {
    fontFamily: font.ui,
    fontSize:   12,
    color:      neutral.textMid,
    lineHeight: 18,
    flex:       1,
  },
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

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  optionCard: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.md,
    flex:            1,
    minWidth:        220,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth:     1.5,
    borderColor:     'rgba(255,255,255,0.07)',
    borderRadius:    radius.md,
    padding:         spacing.md,
    position:        'relative',
    ...Platform.select({
      web: {
        cursor:             'pointer',
        transitionProperty: 'border-color, background-color',
        transitionDuration: '140ms',
      } as any,
      default: {},
    }),
  },
  optionCardActive:  { borderColor: accent.indigo, backgroundColor: 'rgba(124,131,255,0.08)' },
  iconWrap: {
    width:           40,
    height:          40,
    borderRadius:    radius.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  iconWrapActive:     { backgroundColor: 'rgba(124,131,255,0.14)' },
  optionText:         { flex: 1, gap: 2, minWidth: 0 },
  optionLabel:        { fontFamily: font.bold, fontSize: 16, color: neutral.textMid },
  optionLabelActive:  { color: neutral.text },
  optionSub:          { fontFamily: font.ui, fontSize: 12, color: neutral.textDim, lineHeight: 16 },
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

  // Consent
  consentCard: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth:     1,
    borderColor:     glass.border,
    borderRadius:    radius.md,
    overflow:        'hidden',
  },
  consentRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  checkbox: {
    width:          22,
    height:         22,
    borderRadius:   6,
    borderWidth:    1.5,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  consentText:    { flex: 1, gap: 2 },
  consentLabel:   { fontFamily: font.bold, fontSize: 16, color: neutral.text },
  consentDesc:    { fontFamily: font.ui, fontSize: 12, color: neutral.textDim, lineHeight: 16 },
  consentDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: spacing.lg },
  consentNote: {
    fontFamily: font.ui,
    fontSize:   12,
    color:      neutral.textDim,
    lineHeight: 17,
  },
  consentLink: { color: neutral.textMid, textDecorationLine: 'underline' },

  // Save
  saveWrap: { gap: spacing.md, alignItems: 'center', paddingBottom: spacing.lg },
  saveBtn: {
    backgroundColor:   accent.indigo,
    borderRadius:      radius.pill,
    paddingVertical:   14,
    paddingHorizontal: spacing.xxl,
    alignSelf:         'stretch',
    alignItems:        'center',
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  saveBtnSaved:  { backgroundColor: '#1a8a4a' },
  saveBtnError:  { backgroundColor: '#8a2020' },
  saveBtnInner:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  saveBtnText:   { fontFamily: font.bold, fontSize: 16, color: '#fff', letterSpacing: 0.3 },
});
