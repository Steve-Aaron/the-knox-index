import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KnoxLogo } from '@/components/primitives/KnoxLogo';
import { GlassSurface } from '@/components/primitives/GlassSurface';
import { EntranceFade } from '@/components/primitives/EntranceFade';
import { DevLabel } from '@/components/primitives/DevLabel';
import { neutral, brand } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { font } from '@/theme/typography';

/**
 * AuthScreen
 * -----------
 * Shared shell for standalone auth pages (/login, /forgot-password).
 * Centres a glassmorphic card on the dark felt background with the Knox
 * wordmark above, a kicker + title inside, and the page's content below.
 *
 * One job: give every auth page the same dark glass frame.
 */

interface Props {
  /** Small uppercase label above the title, e.g. 'SIGN IN'. */
  kicker:    string;
  title:     string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function AuthScreen({ kicker, title, subtitle, children }: Props) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(420, width - spacing.lg * 2);

  return (
    <SafeAreaView style={styles.root}>
      <DevLabel name="AuthScreen" />
      <View style={styles.center}>
        <EntranceFade>
          <View style={styles.logoWrap}>
            <KnoxLogo width={Math.min(200, cardWidth * 0.55)} />
          </View>
        </EntranceFade>

        <EntranceFade delay={80}>
          <GlassSurface radius={radius.lg} topAccent={brand.gradient as any} style={{ width: cardWidth }}>
            <View style={styles.cardInner}>
              <Text style={styles.kicker}>{kicker}</Text>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              {children}
            </View>
          </GlassSurface>
        </EntranceFade>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: neutral.felt,
  },
  center: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        spacing.lg,
  },
  logoWrap: {
    alignItems:   'center',
    marginBottom: spacing.xl,
  },
  cardInner: {
    padding: spacing.xl,
  },
  kicker: {
    fontFamily:    font.bold,
    fontSize:      10,
    letterSpacing: 2,
    color:         neutral.textMid,
    textTransform: 'uppercase',
    marginBottom:  spacing.xs,
  },
  title: {
    fontFamily:   font.bold,
    fontSize:     24,
    color:        neutral.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily:   font.ui,
    fontSize:     14,
    lineHeight:   21,
    color:        neutral.textMid,
    marginBottom: spacing.md,
  },
});
