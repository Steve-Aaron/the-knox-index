import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderNav } from '@/components/primitives/HeaderNav';
import { Kicker } from '@/components/ui/Kicker';
import { Title } from '@/components/ui/Title';
import { neutral, glass, knox, brand } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { font, type } from '@/theme/typography';

/**
 * /contact — placeholder route
 * -----------------------------
 * Stub page. The full contact experience lives on the dashboard's
 * <ContactFooter /> for now; this route exists so HeaderNav can link to it
 * and so deep-linking from emails works once we build the dedicated form.
 *
 * One job: stand in for the future contact page without 404-ing the link.
 */

export default function ContactScreen() {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={brand.productGradient as unknown as [string, string]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <HeaderNav activeRoute="/contact" />

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Kicker style={{ color: knox.primaryPink, letterSpacing: 2 }}>TODO</Kicker>
          <Title size='display' style={{ fontSize: 40, letterSpacing: -0.5 }}>Contact page</Title>
          <Text style={styles.body}>
            This page is a placeholder while we build the dedicated contact form.
            In the meantime, drop us a line at{' '}
            <Text
              style={styles.link}
              onPress={() => Linking.openURL('mailto:hello@knoxdigi.com')}
            >
              hello@knoxdigi.com
            </Text>
            {' '}or use the enquiry form at the bottom of the dashboard.
          </Text>

          <Pressable
            onPress={() => Linking.openURL('mailto:hello@knoxdigi.com')}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.ctaText}>Email us</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: brand.black },
  safe:   { flex: 1 },
  scroll: {
    padding: spacing.xl,
    gap:     spacing.md,
    maxWidth:  720,
    alignSelf: 'center' as any,
    width:     '100%' as any,
  },
  body: {
    ...type.body,
    color:      neutral.textMid,
    fontSize:   16,
    lineHeight: 24,
  },
  link: {
    color: knox.primaryPink,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  cta: {
    alignSelf:         'flex-start',
    borderWidth:       1,
    borderColor:       knox.primaryPink,
    paddingHorizontal: spacing.xl,
    paddingVertical:   spacing.md,
    marginTop:         spacing.md,
    backgroundColor:   glass.fillHi,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  ctaText: {
    fontFamily:    font.bold,
    fontSize:      12,
    color:         neutral.text,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
