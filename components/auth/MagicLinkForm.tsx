import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LabeledInput } from '@/components/primitives/LabeledInput';
import { PrimaryButton, type ButtonState } from '@/components/primitives/PrimaryButton';
import { DevLabel } from '@/components/primitives/DevLabel';
import { requestMagicLink } from '@/lib/requestMagicLink';
import { track } from '@/lib/analytics';
import { neutral } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { font } from '@/theme/typography';

/**
 * MagicLinkForm
 * --------------
 * Email input + submit that dispatches a magic sign-in link via
 * /api/auth/request (Firebase link, Brevo delivery). Swaps to a 'check your
 * inbox' confirmation once sent.
 *
 * One job: turn an email address into a sent magic link.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  /** Button label in idle state. */
  buttonLabel?: string;
  /** Called after the link is sent successfully. */
  onSent?: (email: string) => void;
}

export function MagicLinkForm({ buttonLabel = 'Email me a sign-in link', onSent }: Props) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<ButtonState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [sent,  setSent]  = useState(false);

  async function handleSubmit() {
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }
    setError(null);
    setState('loading');
    track('magic_link_requested', { source: 'magic_link_form' });

    try {
      await requestMagicLink(trimmed);
      setSent(true);
      track('magic_link_sent');
      onSent?.(trimmed);
    } catch {
      setState('error');
      setError('Something went wrong. Please try again.');
      track('magic_link_failed');
      setTimeout(() => setState('idle'), 2500);
    }
  }

  if (sent) {
    return (
      <View style={styles.sentWrap}>
        <DevLabel name="MagicLinkForm" />
        <Text style={styles.sentTitle}>Check your inbox</Text>
        <Text style={styles.sentBody}>
          We sent a sign-in link to {email.trim().toLowerCase()}. It is single-use — click it on
          this device to come straight back here, signed in.
        </Text>
      </View>
    );
  }

  return (
    <View>
      <DevLabel name="MagicLinkForm" />
      <LabeledInput
        label="Email"
        value={email}
        onChange={setEmail}
        placeholder="you@example.com"
        inputProps={{
          autoCapitalize: 'none',
          autoComplete:   'email',
          keyboardType:   'email-address',
          onSubmitEditing: handleSubmit,
        }}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton
        label={buttonLabel}
        state={state}
        onPress={handleSubmit}
        style={{ marginTop: spacing.md }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  error: {
    fontFamily: font.ui,
    fontSize:   12,
    color:      '#FF6B6B',
    marginTop:  spacing.xs,
  },
  sentWrap: {
    paddingVertical: spacing.sm,
  },
  sentTitle: {
    fontFamily:   font.bold,
    fontSize:     17,
    color:        neutral.text,
    marginBottom: spacing.xs,
  },
  sentBody: {
    fontFamily: font.ui,
    fontSize:   13,
    lineHeight: 20,
    color:      neutral.textMid,
  },
});
