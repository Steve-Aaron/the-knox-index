import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { neutral } from '@/theme/colors';
import { HeroSection }        from './HeroSection';
import { EndorsementsSection } from './EndorsementsSection';
import { SignupFooter }        from './SignupFooter';

/**
 * SignupPage
 * -----------
 * Root component for the /signup route.
 *
 * Structure:
 *   SignupPage
 *   └── ScrollView
 *       ├── HeroSection          (headline + form left | phone mockup right)
 *       ├── EndorsementsSection  (animated logo strip)
 *       ├── QuotesSection        (n × QuoteCard)
 *       └── SignupFooter
 *
 * TO ADD A QUOTE: drop another <QuoteCard /> inside <QuotesSection>.
 * TO ADD A LOGO: add an entry in assets/logos/index.ts.
 */

export function SignupPage() {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#1A1820', '#1F1D1D']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >

          {/* ── 1. Hero ─────────────────────────────────────── */}
          <HeroSection />

          {/* ── 2. Endorsements ─────────────────────────────── */}
          <EndorsementsSection />

          {/* ── 3. Footer ───────────────────────────────────── */}
          <SignupFooter />

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: neutral.felt,
  },

  safe: {
    flex: 1,
  },

  scroll: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
  },
});
