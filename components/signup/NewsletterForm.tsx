import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { MotiView } from 'moti';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { neutral, glass, accent } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { font } from '@/theme/typography';
import { SEGMENTS, INTERESTS } from '@/data/profileOptions';
import { DevLabel } from '@/components/primitives/DevLabel';
import { FrequencyPicker } from '@/components/primitives/FrequencyPicker';

/**
 * NewsletterForm
 * ---------------
 * Three-step signup form.
 *
 * Step 1 — Email only              → "Next →"
 * Step 2 — Company + Who are you   → "Next →"
 * Step 3 — Interests + Consent     → "Submit"
 *
 * On submit: saves profile data to localStorage, then POSTs to
 * /api/signup (Brevo upsert + welcome email). Sign-in itself is separate —
 * see /login and lib/requestMagicLink.
 */

type Step      = 1 | 2 | 3;
type FormState = 'idle' | 'submitting' | 'success' | 'error';

// ── Consent row (same pattern as preferences.tsx) ─────────────────────────────

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

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  return (
    <View style={styles.stepIndicator}>
      {([1, 2, 3] as Step[]).map(n => (
        <View
          key={n}
          style={[
            styles.stepDot,
            n === current  && styles.stepDotActive,
            n <  current   && styles.stepDotDone,
          ]}
        />
      ))}
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function NewsletterForm() {
  const [step,            setStep]            = useState<Step>(1);
  const [email,           setEmail]           = useState('');
  const [company,         setCompany]         = useState('');
  const [segment,         setSegment]         = useState<string | null>(null);
  const [interests,       setInterests]       = useState<string[]>([]);
  // Briefing frequency — two mutually-exclusive booleans matching the
  // Brevo consent model. Default to 'daily' so a one-click signup still
  // produces a useful subscription; the picker lets users pick weekly or
  // opt out entirely before submit.
  const [consentDaily,    setConsentDaily]    = useState(true);
  const [consentWeekly,   setConsentWeekly]   = useState(false);
  const [consentUpdates,  setConsentUpdates]  = useState(true);
  const [consentKnox,     setConsentKnox]     = useState(false);
  const [formState,       setFormState]       = useState<FormState>('idle');

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const toggleInterest = useCallback((id: string) => {
    setInterests(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const handleNext = useCallback(() => {
    if (step < 3) setStep(s => (s + 1) as Step);
  }, [step]);

  const handleBack = useCallback(() => {
    if (step > 1) setStep(s => (s - 1) as Step);
  }, [step]);

  const handleSubmit = useCallback(async () => {
    if (formState === 'submitting') return;
    setFormState('submitting');

    try {
      const res = await fetch('/api/signup', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:                 email.trim().toLowerCase(),
          company:               company.trim(),
          segment:               segment ?? '',
          interests,
          // Old daily-only flag kept for back-compat with /api/signup;
          // weekly flag is new. Server enforces mutual exclusion.
          consentBriefing:       consentDaily,
          consentDailyBriefing:  consentDaily,
          consentWeeklyBriefing: consentWeekly,
          consentUpdates,
          consentKnox,
        }),
      });
      if (!res.ok) throw new Error();
      setFormState('success');
    } catch {
      setFormState('error');
      setTimeout(() => setFormState('idle'), 4000);
    }
  }, [email, company, segment, interests, consentDaily, consentWeekly, consentUpdates, consentKnox, formState]);

  // ── Success ─────────────────────────────────────────────────────────────────
  if (formState === 'success') {
    return (
      <MotiView
        from={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 18, stiffness: 280 }}
        style={styles.successBox}
      >
        <FontAwesome6 name="envelope-circle-check" size={28} color={accent.mint} solid />
        <Text style={styles.successTitle}>You're subscribed</Text>
        <Text style={styles.successBody}>
          Your first briefing will land at{' '}
          <Text style={{ color: neutral.text }}>8:00AM tomorrow</Text>.
          {'\n'}We've sent a confirmation to{' '}
          <Text style={{ color: neutral.text }}>{email.trim().toLowerCase()}</Text>.
        </Text>
      </MotiView>
    );
  }

  // ── Step 1: Email ────────────────────────────────────────────────────────────
  const renderStep1 = () => (
    <MotiView
      key="step1"
      from={{ opacity: 0, translateX: -16 }}
      animate={{ opacity: 1, translateX: 0 }}
      exit={{ opacity: 0, translateX: -16 }}
      transition={{ type: 'timing', duration: 220 }}
      style={styles.stepContent}
    >
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Email address</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@yourorganisation.com"
          placeholderTextColor={neutral.textMid}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          onSubmitEditing={() => isValidEmail && handleNext()}
          {...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} })}
        />
      </View>

      <Pressable
        onPress={handleNext}
        disabled={!isValidEmail}
        style={({ pressed }) => [
          styles.primaryBtn,
          !isValidEmail && styles.primaryBtnDisabled,
          pressed && isValidEmail && { opacity: 0.88 },
        ]}
      >
        <Text style={styles.primaryBtnText}>Next</Text>
        <FontAwesome6 name="arrow-right" size={13} color="#fff" solid />
      </Pressable>

      <Text style={styles.finePrint}>100% free · No spam · Unsubscribe any time</Text>
    </MotiView>
  );

  // ── Step 2: Company + Who are you ────────────────────────────────────────────
  const renderStep2 = () => (
    <MotiView
      key="step2"
      from={{ opacity: 0, translateX: 16 }}
      animate={{ opacity: 1, translateX: 0 }}
      exit={{ opacity: 0, translateX: 16 }}
      transition={{ type: 'timing', duration: 220 }}
      style={styles.stepContent}
    >
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Company / Organisation</Text>
        <TextInput
          style={styles.input}
          value={company}
          onChangeText={setCompany}
          placeholder="e.g. CCHQ, Sky News, LSE"
          placeholderTextColor={neutral.textMid}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="next"
          {...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} })}
        />
      </View>

      <View style={styles.fieldGroup}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Who are you?</Text>
          <Text style={styles.labelHint}>Pick one</Text>
        </View>
        <View style={styles.chipGrid}>
          {SEGMENTS.map(s => {
            const active = segment === s.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => setSegment(active ? null : s.id)}
                style={({ pressed }) => [
                  styles.chip,
                  active && styles.chipActive,
                  pressed && { opacity: 0.82 },
                ]}
              >
                <FontAwesome6
                  name={s.icon as any}
                  size={12}
                  color={active ? accent.indigo : neutral.textMid}
                  solid
                />
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.buttonRow}>
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        >
          <FontAwesome6 name="arrow-left" size={12} color={neutral.textMid} solid />
          <Text style={styles.backBtnText}>Back</Text>
        </Pressable>

        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [styles.primaryBtn, styles.primaryBtnFlex, pressed && { opacity: 0.88 }]}
        >
          <Text style={styles.primaryBtnText}>Next</Text>
          <FontAwesome6 name="arrow-right" size={13} color="#fff" solid />
        </Pressable>
      </View>
    </MotiView>
  );

  // ── Step 3: Interests + Consent ──────────────────────────────────────────────
  const renderStep3 = () => (
    <MotiView
      key="step3"
      from={{ opacity: 0, translateX: 16 }}
      animate={{ opacity: 1, translateX: 0 }}
      exit={{ opacity: 0, translateX: 16 }}
      transition={{ type: 'timing', duration: 220 }}
      style={styles.stepContent}
    >
      <View style={styles.fieldGroup}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>What interests you?</Text>
          <Text style={styles.labelHint}>Pick all that apply</Text>
        </View>
        <View style={styles.chipGrid}>
          {INTERESTS.map(v => {
            const active = interests.includes(v.id);
            return (
              <Pressable
                key={v.id}
                onPress={() => toggleInterest(v.id)}
                style={({ pressed }) => [
                  styles.chip,
                  active && styles.chipActive,
                  pressed && { opacity: 0.82 },
                ]}
              >
                <FontAwesome6
                  name={v.icon as any}
                  size={12}
                  color={active ? accent.indigo : neutral.textMid}
                  solid
                />
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {v.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Briefing frequency — Daily / Weekly / None radio-style picker */}
      <View style={styles.briefingBlock}>
        <Text style={styles.briefingLabel}>The Knox Index Briefing</Text>
        <FrequencyPicker
          daily={consentDaily}
          weekly={consentWeekly}
          onChange={({ daily, weekly }) => {
            setConsentDaily(daily);
            setConsentWeekly(weekly);
          }}
        />
      </View>

      <View style={styles.consentCard}>
        <ConsentRow
          checked={consentUpdates}
          onToggle={() => setConsentUpdates(v => !v)}
          label="Product Updates"
          desc="New features and platform announcements."
        />
        <View style={styles.consentDivider} />
        <ConsentRow
          checked={consentKnox}
          onToggle={() => setConsentKnox(v => !v)}
          label="Knox Digital News"
          desc="Occasional updates from the Knox Digital team."
        />
      </View>

      <View style={styles.buttonRow}>
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        >
          <FontAwesome6 name="arrow-left" size={12} color={neutral.textMid} solid />
          <Text style={styles.backBtnText}>Back</Text>
        </Pressable>

        <Pressable
          onPress={handleSubmit}
          disabled={formState === 'submitting'}
          style={({ pressed }) => [
            styles.primaryBtn,
            styles.primaryBtnFlex,
            formState === 'error'     && styles.primaryBtnError,
            formState === 'submitting' && { opacity: 0.65 },
            pressed && formState === 'idle' && { opacity: 0.88 },
          ]}
        >
          {formState === 'submitting' ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Text style={styles.primaryBtnText}>
                {formState === 'error' ? 'Error — try again' : 'Submit'}
              </Text>
              {formState === 'idle' && (
                <FontAwesome6 name="check" size={13} color="#fff" solid />
              )}
            </>
          )}
        </Pressable>
      </View>
    </MotiView>
  );

  // ── Wrapper with step indicator ──────────────────────────────────────────────
  return (
    <View style={styles.form}>
      <DevLabel name="NewsletterForm" />
      <StepIndicator current={step} />
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  form: {
    gap:   spacing.lg,
    width: '100%',
  },

  stepContent: {
    gap: spacing.lg,
  },

  // Step indicator dots
  stepIndicator: {
    flexDirection: 'row',
    gap:           spacing.sm,
    alignItems:    'center',
  },

  stepDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: glass.border,
  },

  stepDotActive: {
    width:           24,
    backgroundColor: accent.indigo,
  },

  stepDotDone: {
    backgroundColor: 'rgba(95,100,189,0.4)',
  },

  // Fields
  fieldGroup: {
    gap: spacing.sm,
  },

  labelRow: {
    flexDirection:  'row',
    alignItems:     'baseline',
    justifyContent: 'space-between',
  },

  label: {
    fontFamily:    font.bold,
    fontSize:      12,
    color:         neutral.textMid,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  labelHint: {
    fontFamily: font.ui,
    fontSize:   12,
    color:      neutral.textMid,
  },

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

  chipGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.sm,
  },

  chip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.xs,
    borderRadius:      radius.pill,
    borderWidth:       1,
    borderColor:       glass.border,
    backgroundColor:   glass.fill,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    ...Platform.select({
      web: {
        cursor:             'pointer',
        transitionProperty: 'border-color, background-color',
        transitionDuration: '140ms',
      } as any,
      default: {},
    }),
  },

  chipActive: {
    borderColor:     accent.indigo,
    backgroundColor: 'rgba(95,100,189,0.10)',
  },

  chipText: {
    fontFamily: font.ui,
    fontSize:   13,
    color:      neutral.textMid,
  },

  chipTextActive: {
    color: accent.indigo,
  },

  // Briefing frequency block (sits above the consent rows on step 3)
  briefingBlock: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  briefingLabel: {
    fontFamily: font.bold,
    fontSize:   14,
    color:      neutral.text,
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
    paddingHorizontal: spacing.md,
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

  consentText: { flex: 1, gap: 2 },

  consentLabel: {
    fontFamily: font.bold,
    fontSize:   14,
    color:      neutral.text,
  },

  consentDesc: {
    fontFamily: font.ui,
    fontSize:   12,
    color:      neutral.textMid,
    lineHeight: 16,
  },

  consentDivider: {
    height:           1,
    backgroundColor:  'rgba(255,255,255,0.05)',
    marginHorizontal: spacing.md,
  },

  // Buttons
  buttonRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.md,
  },

  primaryBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               spacing.sm,
    backgroundColor:   accent.indigo,
    borderRadius:      radius.pill,
    paddingVertical:   13,
    paddingHorizontal: spacing.xl,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },

  primaryBtnFlex: {
    flex: 1,
  },

  primaryBtnDisabled: {
    opacity: 0.4,
  },

  primaryBtnError: {
    backgroundColor: '#8a2020',
  },

  primaryBtnText: {
    fontFamily:    font.bold,
    fontSize:      16,
    color:         '#fff',
    letterSpacing: 0.2,
  },

  backBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.xs,
    paddingVertical:   13,
    paddingHorizontal: spacing.md,
    borderRadius:      radius.pill,
    borderWidth:       1,
    borderColor:       glass.border,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },

  backBtnText: {
    fontFamily: font.ui,
    fontSize:   14,
    color:      neutral.textMid,
  },

  finePrint: {
    fontFamily: font.ui,
    fontSize:   12,
    color:      neutral.textMid,
    textAlign:  'center',
  },

  // Success
  successBox: {
    backgroundColor: 'rgba(63, 230, 177, 0.06)',
    borderWidth:     1,
    borderColor:     'rgba(63, 230, 177, 0.2)',
    borderRadius:    radius.lg,
    padding:         spacing.xxl,
    alignItems:      'center',
    gap:             spacing.md,
  },

  successTitle: {
    fontFamily: font.bold,
    fontSize:   22,
    color:      neutral.text,
    textAlign:  'center',
  },

  successBody: {
    fontFamily: font.ui,
    fontSize:   15,
    color:      neutral.textMid,
    textAlign:  'center',
    lineHeight: 22,
  },
});
