import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Linking } from 'react-native';
import { neutral, glass, accent } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { font } from '@/theme/typography';
import { BRAND } from '@/brand/constants';

/**
 * SignupFooter
 * -------------
 * Minimal footer for the /signup page.
 * Reuses AppFooter's brand pattern but lighter — no nav links, just
 * copyright and essential legal/contact links.
 */

const YEAR = new Date().getFullYear();

const LINKS = [
  { label: 'Privacy Policy', url: 'https://knoxdigi.com/privacy-policy' },
  { label: 'Cookie Policy',  url: 'https://knoxdigi.com/cookie-policy'  },
  { label: 'Terms of Service', url: 'https://knoxdigi.com/terms'        },
];

export function SignupFooter() {
  return (
    <View style={styles.wrap}>
      <View style={styles.divider} />

      <Text style={styles.copyright}>
        © {YEAR} Knox Digital Ltd. All rights reserved.
      </Text>

      <View style={styles.links}>
        {LINKS.map(l => (
          <Pressable
            key={l.label}
            onPress={() => Linking.openURL(l.url)}
            style={({ pressed }) => [styles.link, pressed && { opacity: 0.65 }]}
          >
            <Text style={styles.linkText}>{l.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width:             '100%',
    paddingHorizontal: '5%',
    paddingVertical:   spacing.xxl,
    alignItems:        'center',
    gap:               spacing.md,
  },

  divider: {
    width:           '100%',
    height:          1,
    backgroundColor: glass.border,
    marginBottom:    spacing.sm,
  },

  copyright: {
    fontFamily: font.ui,
    fontSize:   12,
    color:      neutral.textMid,
    textAlign:  'center',
  },

  links: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    justifyContent: 'center',
    gap:            spacing.md,
  },

  link: {
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },

  linkText: {
    fontFamily: font.ui,
    fontSize:   12,
    color:      neutral.textMid,
    ...Platform.select({
      web: {
        textDecorationLine: 'underline',
        textDecorationColor: 'rgba(255,255,255,0.2)',
      } as any,
      default: { textDecorationLine: 'underline' },
    }),
  },
});
