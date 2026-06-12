import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Text,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { neutral, glass } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
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
  const router = useRouter();
  const handleClose = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View style={styles.root}>
      {/* Knox product gradient — dark for the top 75%, horizon glow at the foot */}
      <LinearGradient
        colors={['#1F1D1D', '#1F1D1D', '#35393B']}
        locations={[0, 0.75, 1]}
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

      {/* Close — return to the dashboard */}
      <Pressable
        onPress={handleClose}
        accessibilityRole="button"
        accessibilityLabel="Close sign up"
        hitSlop={8}
        style={styles.closeBtn}
      >
        <Text style={styles.closeIcon}>✕</Text>
      </Pressable>
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

  closeBtn: {
    position:        'absolute',
    top:             spacing.lg,
    right:           spacing.lg,
    width:           36,
    height:          36,
    borderRadius:    18,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth:     1,
    borderColor:     glass.border,
    zIndex:          100,
    ...Platform.select({ web: { position: 'fixed', cursor: 'pointer' } as any, default: {} }),
  },
  closeIcon: {
    color:      neutral.text,
    fontSize:   18,
    lineHeight: 20,
  },
});
