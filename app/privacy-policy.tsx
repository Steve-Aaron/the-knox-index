import React from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { neutral, glass, accent } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { font } from '@/theme/typography';
import { breakpoints } from '@/theme/breakpoints';

/**
 * PrivacyScreen  (/privacy-policy)
 * --------------------------
 * Static privacy policy page for The Knox Index.
 * No auth gate — publicly accessible.
 *
 * One job: display the privacy policy clearly.
 */

// ── Policy sections ──────────────────────────────────────────────────────────

interface Section {
  title: string;
  body:  string;
}

const LAST_UPDATED = '1 May 2025';

const SECTIONS: Section[] = [
  {
    title: 'Overview',
    body:  'The Knox Index is operated by Knox Digital Ltd. This policy explains how we collect, use, and protect your personal data when you use our service. We take your privacy seriously and handle your data in accordance with UK GDPR and the Data Protection Act 2018.',
  },
  {
    title: 'Information we collect',
    body:  'We collect the email address you provide when registering for access. We may also collect optional profile information — such as your name, professional role, and areas of interest — that you choose to provide in your account preferences. This information helps us personalise your experience and send you relevant communications.',
  },
  {
    title: 'Log data',
    body:  'When you use The Knox Index, our servers automatically record certain information ("log data"). This may include your browser type and version, the pages you visit, the time and date of your visit, and your IP address. This data is used solely for the purposes of diagnosing technical issues and understanding how the service is used in aggregate.',
  },
  {
    title: 'Communications',
    body:  'If you register for access, we will use your email address to send you a one-click magic link and, where you have consented, occasional updates about The Knox Index. You can unsubscribe from marketing communications at any time by clicking the unsubscribe link in any email or by contacting us directly. Transactional emails related to your account (such as access links) are not subject to marketing opt-out.',
  },
  {
    title: 'Cookies',
    body:  'We use cookies to maintain your session and remember your preferences. A session cookie is set when you authenticate via magic link; this expires when you close your browser unless you choose to remain signed in. We also use analytics cookies (via Mixpanel) to understand how users interact with the service. You can manage your cookie preferences at any time via the cookie banner at the bottom of the page.',
  },
  {
    title: 'Third-party services',
    body:  'We use a small number of trusted third-party services to operate The Knox Index: Brevo for email delivery and contact management, Mixpanel for product analytics, and Vercel/Cloudflare for hosting. Each of these providers processes data on our behalf under data processing agreements and in accordance with their own privacy policies. We do not sell your data to any third party.',
  },
  {
    title: 'Data retention',
    body:  'We retain your personal data for as long as your account is active or as needed to provide the service. If you ask us to delete your account, we will remove your personal data within 30 days, except where we are required to retain it for legal or compliance purposes.',
  },
  {
    title: 'Your rights',
    body:  'Under UK GDPR, you have the right to access, correct, or delete the personal data we hold about you. You also have the right to restrict or object to our processing, and to data portability. To exercise any of these rights, please contact us at the address below. If you believe we have handled your data incorrectly, you have the right to lodge a complaint with the Information Commissioner\'s Office (ICO) at ico.org.uk.',
  },
  {
    title: 'Security',
    body:  'We take appropriate technical and organisational measures to protect your personal data against unauthorised access, alteration, disclosure, or destruction. Access to your data is restricted to authorised personnel only. However, no method of transmission over the internet is completely secure, and we cannot guarantee absolute security.',
  },
  {
    title: 'Changes to this policy',
    body:  'We may update this privacy policy from time to time. When we do, we will revise the "last updated" date at the top of this page. We encourage you to review this policy periodically. Continued use of The Knox Index after changes constitutes your acceptance of the revised policy.',
  },
  {
    title: 'Contact us',
    body:  'If you have any questions about this privacy policy or how we handle your data, please contact us at: privacy@knoxdigi.com\n\nKnox Digital Ltd\nRegistered in England and Wales',
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function PrivacyScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= breakpoints.tablet;
  const hPad   = isWide ? spacing.xl : spacing.base;

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#0D0D18', '#050509']} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safe} edges={['top']}>

        {/* ── Nav bar ──────────────────────────────────────────── */}
        <View style={[styles.nav, { paddingHorizontal: hPad }]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.65 }]}
          >
            <FontAwesome6 name="arrow-left" size={12} color={neutral.textMid} solid />
            <Text style={styles.backBtnText}>Back</Text>
          </Pressable>
          <Text style={styles.navKicker}>THE KNOX INDEX</Text>
        </View>

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
            <Text style={styles.kicker}>LEGAL</Text>
            <Text style={styles.title}>Privacy Policy</Text>
            <Text style={styles.subtitle}>
              Last updated: {LAST_UPDATED}
            </Text>
          </MotiView>

          {/* ── Policy card ──────────────────────────────────────── */}
          <MotiView
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 320, delay: 60 }}
            style={styles.card}
          >
            {SECTIONS.map((section, index) => (
              <View
                key={section.title}
                style={[
                  styles.section,
                  index < SECTIONS.length - 1 && styles.sectionBorder,
                ]}
              >
                <View style={styles.sectionHead}>
                  <View style={styles.sectionDot} />
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                </View>
                <Text style={styles.sectionBody}>{section.body}</Text>
              </View>
            ))}
          </MotiView>

          {/* ── Footer note ──────────────────────────────────────── */}
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: 320, delay: 180 }}
            style={styles.footer}
          >
            <FontAwesome6 name="shield-halved" size={14} color={neutral.textDim} solid />
            <Text style={styles.footerText}>
              Knox Digital Ltd is registered in England and Wales. We are committed to handling your data responsibly and transparently.
            </Text>
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

  // Nav
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

  // Layout
  scroll: {
    paddingTop:    spacing.xl,
    paddingBottom: spacing.xxxl,
    gap:           spacing.xl,
    maxWidth:      760,
    alignSelf:     'center' as any,
    width:         '100%' as any,
  },

  // Header
  kicker:   { fontFamily: font.bold, fontSize: 12, color: accent.indigo, letterSpacing: 1.5 },
  title:    { fontFamily: font.bold, fontSize: 32, color: neutral.text, marginTop: 4, letterSpacing: -0.5 },
  subtitle: { fontFamily: font.ui, fontSize: 12, color: neutral.textDim, marginTop: 6 },

  // Policy card
  card: {
    backgroundColor: glass.fill,
    borderWidth:     1,
    borderColor:     glass.border,
    borderRadius:    radius.lg,
    overflow:        'hidden',
    ...Platform.select({
      web: {
        backdropFilter:       'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      } as any,
      default: {},
    }),
  },

  // Sections
  section: {
    paddingHorizontal: spacing.xl,
    paddingVertical:   spacing.lg,
    gap:               spacing.sm,
  },
  sectionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: glass.border,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  sectionDot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: accent.indigo,
    flexShrink:      0,
  },
  sectionTitle: {
    fontFamily: font.bold,
    fontSize:   16,
    color:      neutral.text,
  },
  sectionBody: {
    fontFamily: font.ui,
    fontSize:   16,
    color:      neutral.textMid,
    lineHeight: 22,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           spacing.sm,
    paddingBottom: spacing.lg,
  },
  footerText: {
    fontFamily: font.ui,
    fontSize:   12,
    color:      neutral.textDim,
    lineHeight: 18,
    flex:       1,
  },
});
