import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Linking } from 'react-native';
import { router } from 'expo-router';
import { DevLabel } from '@/components/primitives/DevLabel';
import { useRegisteredFlag } from '@/hooks/useRegisteredFlag';
import { KnoxLogo } from '@/components/primitives/KnoxLogo';
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

/** Footer link descriptor. `to` = in-app route, `url` = external. */
type FooterLink = { label: string; to?: string; url?: string };

const SIGNED_OUT_LINKS: FooterLink[] = [
  { label: 'Sign up',        to:  '/signup' },
  { label: 'Log in',         to:  '/login' },
  { label: 'Contact',        to:  '/contact' },
  { label: 'Privacy',        url: 'https://knoxdigi.com/privacy-policy' },
  { label: 'LinkedIn',       url: 'https://www.linkedin.com/company/knoxdigital' },
];

const SIGNED_IN_LINKS: FooterLink[] = [
  { label: 'Preferences',    to:  '/preferences' },
  { label: 'Contact',        to:  '/contact' },
  { label: 'Privacy',        url: 'https://knoxdigi.com/privacy-policy' },
  { label: 'LinkedIn',       url: 'https://www.linkedin.com/company/knoxdigital' },
];

export function AppFooter() {
  const isRegistered = useRegisteredFlag();
  const LINKS = isRegistered ? SIGNED_IN_LINKS : SIGNED_OUT_LINKS;
  return (
    <View style={styles.wrap}>
      <DevLabel name="AppFooter" />

      {/* Top divider */}
      <View style={styles.divider} />

      <View style={styles.inner}>

        {/* Brand block — Knox wordmark + supporting copy */}
        <View style={styles.brandBlock}>
          <Pressable
            onPress={() => router.push('/')}
            accessibilityRole="link"
            accessibilityLabel="Knox Index — home"
            style={({ pressed }) => [styles.brandRow, pressed && { opacity: 0.75 }]}
          >
            <KnoxLogo width={120} color={neutral.strokeHi} />
          </Pressable>
          <Text style={styles.brandTagline}>
            UK political TikTok intelligence, daily.
          </Text>
          <Text style={styles.brandSub}>
            Built by Knox Digital.
          </Text>
        </View>

        {/* Nav links — square, fill-from-bottom on hover */}
        <View style={styles.linkGroup}>
          {LINKS.map(l => (
            <FooterLinkButton key={l.label} link={l} />
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

/**
 * FooterLinkButton — square-cornered link with the bottom-up fill hover.
 * Pulled out as a small component so React can hold hover state per link.
 */
function FooterLinkButton({ link }: { link: FooterLink }) {
  const handlePress = () => {
    if (link.url) Linking.openURL(link.url);
    else if (link.to) router.push(link.to as any);
  };
  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed, hovered }: any) => [
        styles.linkBtn,
        hovered && styles.linkBtnHovered,
        pressed && { opacity: 0.7 },
      ]}
    >
      {({ hovered }: any) => (
        <Text style={[styles.linkText, hovered && styles.linkTextHovered]}>
          {link.label}
        </Text>
      )}
    </Pressable>
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
    marginBottom: spacing.xs,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
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

  // Links — square corners, fill from bottom on hover
  linkGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    alignItems: 'center',
  },
  linkBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    borderWidth:       1,
    borderColor:       glass.borderHi,
    backgroundColor:   glass.fill,
    ...Platform.select({
      web: {
        cursor:             'pointer',
        transitionProperty: 'border-color, background-color',
        transitionDuration: '180ms',
      } as any,
      default: {},
    }),
  },
  linkBtnHovered: {
    borderColor:     accent.indigo,
    backgroundColor: 'rgba(95,100,189,0.12)',
  },
  linkText: {
    ...type.caption,
    fontSize: 12,
    color:    neutral.textMid,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.0,
    ...Platform.select({
      web: {
        transitionProperty: 'color',
        transitionDuration: '180ms',
      } as any,
      default: {},
    }),
  },
  linkTextHovered: {
    color: '#fff',
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
