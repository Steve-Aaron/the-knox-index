import React from 'react';
import { View, Text, Pressable, StyleSheet, Linking, Platform } from 'react-native';
import { GlassSurface } from '@/components/primitives/GlassSurface';
import { DevLabel } from '@/components/primitives/DevLabel';
import { neutral, glass, accent } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { type } from '@/theme/typography';

/**
 * ContactFooter
 * --------------
 * Final-row CTA inviting the user to reach out for bespoke briefings, white-
 * labelled exports, and other paywalled work. Answers the brief item
 * 'how to get in touch for more bespoke information'.
 * One job: route interested visitors to a human.
 */

interface Props {
  email?:    string;
  linkedIn?: string;
}

export function ContactFooter({
  email    = 'hello@knoxdigital.com',
  linkedIn = 'https://www.linkedin.com/company/knox-digital',
}: Props) {
  return (
    <GlassSurface style={styles.wrap} radius={radius.lg}>
      <DevLabel name="ContactFooter" />
      <View style={[styles.accentStrip, { backgroundColor: accent.indigo }]} />

      <View style={styles.body}>
        <View style={styles.copy}>
          <Text style={styles.kicker}>NEED MORE THAN THIS?</Text>
          <Text style={styles.title}>Bespoke briefings, exports, white-label.</Text>
          <Text style={styles.lede}>
            Bespoke politician deep-dives, multi-country leader tracking, white-label data exports
            for clients. Tell us what you're chasing and we'll put a brief together.
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={() => Linking.openURL(`mailto:${email}?subject=Project%20Ariadne%20%E2%80%94%20bespoke%20briefing`)}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.primaryBtnText}>EMAIL THE TEAM</Text>
          </Pressable>
          <Pressable
            onPress={() => Linking.openURL(linkedIn)}
            style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.75 }]}
          >
            <Text style={styles.secondaryBtnText}>LINKEDIN ↗</Text>
          </Pressable>
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
    gap: spacing.lg,
    padding: spacing.lg,
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  copy: {
    flex: 1,
    minWidth: 280,
    gap: 4,
  },
  kicker: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 10,
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
    marginTop: 4,
    maxWidth: 520,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  primaryBtn: {
    backgroundColor: accent.indigo,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  primaryBtnText: {
    ...type.caption,
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  secondaryBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: glass.border,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  secondaryBtnText: {
    ...type.caption,
    color: neutral.textMid,
    fontSize: 11,
  },
});
