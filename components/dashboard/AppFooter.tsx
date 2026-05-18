import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Linking } from 'react-native';
import { DevLabel } from '@/components/primitives/DevLabel';
import { neutral, glass, accent } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { type, font } from '@/theme/typography';

/**
 * AppFooter
 * ----------
 * Site-wide footer. Renders below the ContactFooter section.
 * Contains branding, nav links, legal line, and a subtle accent separator.
 *
 * One job: close the page with authority and give people somewhere to go.
 */

const YEAR = new Date().getFullYear();

const LINKS: { label: string; url: string }[] = [
  { label: 'LinkedIn',       url: 'https://www.linkedin.com/company/knoxdigital' },
  { label: 'Privacy Policy', url: 'https://knoxdigi.com/privacy-policy' },
  { label: 'Contact',        url: 'mailto:hello@knoxdigi.com' },
];

export function AppFooter() {
  return (
    <View style={styles.wrap}>
      <DevLabel name="AppFooter" />

      {/* Top divider */}
      <View style={styles.divider} />

      <View style={styles.inner}>

        {/* Brand block */}
        <View style={styles.brandBlock}>
          <View style={styles.brandRow}>
            <View style={styles.brandDot} />
            <Text style={styles.brandName}>THE KNOX INDEX</Text>
          </View>
          <Text style={styles.brandTagline}>
            UK political TikTok intelligence, daily.
          </Text>
          <Text style={styles.brandSub}>
            Built by Knox Digital.
          </Text>
        </View>

        {/* Nav links */}
        <View style={styles.linkGroup}>
          {LINKS.map(l => (
            <Pressable
              key={l.label}
              onPress={() => Linking.openURL(l.url)}
              style={({ pressed }) => [
                styles.linkBtn,
                pressed && { opacity: 0.65 },
              ]}
            >
              <Text style={styles.linkText}>{l.label}</Text>
            </Pressable>
          ))}
        </View>

      </View>

      {/* Legal line */}
      <View style={styles.legalRow}>
        <Text style={styles.legalText}>
          © {YEAR} Knox Digital Ltd. All rights reserved.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: spacing.xxxl,
  },

  divider: {
    height: 1,
    backgroundColor: glass.border,
    marginBottom: spacing.xl,
  },

  inner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.xl,
    paddingHorizontal: spacing.xl,
  },

  // Brand
  brandBlock: {
    gap: spacing.xs,
    flex: 1,
    minWidth: 200,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: accent.indigo,
  },
  brandName: {
    fontFamily: font.bold,
    fontSize: 12,
    color: neutral.text,
    letterSpacing: 2,
  },
  brandTagline: {
    fontFamily: font.ui,
    fontSize: 16,
    color: neutral.textMid,
    lineHeight: 20,
  },
  brandSub: {
    fontFamily: font.ui,
    fontSize: 12,
    color: neutral.textDim,
  },

  // Links
  linkGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    alignItems: 'center',
  },
  linkBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: glass.border,
    backgroundColor: glass.fill,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  linkText: {
    ...type.caption,
    fontSize: 12,
    color: neutral.textMid,
  },

  // Legal
  legalRow: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  legalText: {
    ...type.caption,
    fontSize: 12,
    color: neutral.textDim,
    textAlign: 'center',
    lineHeight: 16,
  },
});
