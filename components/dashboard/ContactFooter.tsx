import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { MotiView } from 'moti';
import { GlassSurface } from '@/components/primitives/GlassSurface';
import { DevLabel } from '@/components/primitives/DevLabel';
import { neutral, glass, accent } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { type } from '@/theme/typography';

/**
 * ContactFooter
 * --------------
 * Bespoke-enquiry CTA. Renders a name + email + message form that POSTs to
 * /api/contact (Brevo → steve+tki@knoxdigi.com) inline, with a success state.
 *
 * LinkedIn and email mailto links are retained as fallback CTAs alongside
 * the inline form.
 *
 * One job: route bespoke enquiries to a human without leaving the page.
 */

interface Props {
  linkedIn?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ContactFooter({
  linkedIn = 'https://www.linkedin.com/company/knox-digital',
}: Props) {
  const [name,    setName]    = useState('');
  const [email,   setEmail]   = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [sent,    setSent]    = useState(false);

  async function submit() {
    if (!EMAIL_RE.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!message.trim()) {
      setError('Please include a message so we know what you need.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/contact', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:    name.trim(),
          email:   email.trim(),
          message: message.trim(),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Send failed (${res.status})`);
      }
      setSent(true);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <GlassSurface style={styles.wrap} radius={radius.lg}>
      <DevLabel name="ContactFooter" />
      <View style={[styles.accentStrip, { backgroundColor: accent.indigo }]} />

      <View style={styles.body}>
        {/* Left: copy block */}
        <View style={styles.copy}>
          <Text style={styles.kicker}>NEED MORE THAN THIS?</Text>
          <Text style={styles.title}>Bespoke briefings, exports, white-label.</Text>
          <Text style={styles.lede}>
            Deep-dives, multi-country tracking, white-label data exports for clients.
            Tell us what you're chasing.
          </Text>

          {/* Fallback links */}
          <View style={styles.links}>
            <Pressable
              onPress={() => Linking.openURL(linkedIn)}
              style={({ pressed }) => [styles.linkBtn, pressed && { opacity: 0.75 }]}
            >
              <Text style={styles.linkBtnText}>LINKEDIN ↗</Text>
            </Pressable>
          </View>
        </View>

        {/* Right: inline form */}
        <View style={styles.formWrap}>
          {sent ? (
            <MotiView
              from={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              style={styles.successWrap}
            >
              <Text style={styles.successIcon}>✓</Text>
              <Text style={styles.successTitle}>Message sent.</Text>
              <Text style={styles.successBody}>We'll be in touch shortly.</Text>
            </MotiView>
          ) : (
            <View style={styles.form}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your name (optional)"
                placeholderTextColor={neutral.textDim}
                style={styles.input}
                autoCapitalize="words"
              />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor={neutral.textDim}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="What are you working on?"
                placeholderTextColor={neutral.textDim}
                multiline
                numberOfLines={3}
                style={[styles.input, styles.textarea]}
                textAlignVertical="top"
              />
              {error && <Text style={styles.errorText}>{error}</Text>}
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
                  : <Text style={styles.submitBtnText}>SEND →</Text>
                }
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
  },
  accentStrip: {
    height: 3,
    width: '100%',
    opacity: 0.85,
  },
  body: {
    flexDirection: 'row',
    gap: spacing.xl,
    padding: spacing.xl,
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  copy: {
    flex: 1,
    minWidth: 240,
    gap: spacing.sm,
  },
  kicker: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  title: {
    ...type.title,
    color: neutral.text,
    fontSize: 18,
  },
  lede: {
    ...type.body,
    color: neutral.textMid,
    fontSize: 12,
    lineHeight: 18,
  },
  links: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  linkBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: glass.border,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  linkBtnText: {
    ...type.caption,
    color: neutral.textMid,
    fontSize: 11,
  },

  // form
  formWrap: {
    flex: 1,
    minWidth: 260,
    maxWidth: 400,
  },
  form: {
    gap: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: glass.border,
    backgroundColor: glass.fill,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: neutral.text,
    fontSize: 13,
    fontFamily: 'Montserrat_400Regular',
    ...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} }),
  },
  textarea: {
    minHeight: 72,
    paddingTop: 10,
  },
  errorText: {
    ...type.body,
    color: '#ff6b6b',
    fontSize: 11,
  },
  submitBtn: {
    backgroundColor: accent.indigo,
    paddingVertical: 11,
    borderRadius: radius.pill,
    alignItems: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  submitBtnText: {
    ...type.caption,
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // success
  successWrap: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  successIcon: {
    fontSize: 32,
    color: accent.mint,
  },
  successTitle: {
    ...type.title,
    color: neutral.text,
    fontSize: 22,
  },
  successBody: {
    ...type.body,
    color: neutral.textMid,
    fontSize: 13,
  },
});
