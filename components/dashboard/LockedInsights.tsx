import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { DashCard } from '@/components/primitives/DashCard';
import { DevLabel } from '@/components/primitives/DevLabel';
import { Kicker } from '@/components/ui/Kicker';
import { Title } from '@/components/ui/Title';
import { accent, neutral } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { font, type } from '@/theme/typography';

/**
 * LockedInsights
 * ---------------
 * Stands in for the Fastest growing and Rising topics cards when the visitor
 * does not have the full view (signed out on The Knox Index, not yet approved
 * on a waitlist index). Says what is behind it and opens the sign-up.
 *
 * One job: the locked placeholder for the insights row.
 */

interface Props {
  body:   string;
  /** Button label; null when there is nothing to do (already on the waitlist). */
  cta:    string | null;
  onCta:  () => void;
}

export function LockedInsights({ body, cta, onCta }: Props) {
  return (
    <DashCard style={styles.wrap}>
      <DevLabel name="LockedInsights" />
      <View style={styles.inner}>
        <Kicker tone='dim'>LOCKED · FASTEST GROWING · RISING TOPICS</Kicker>
        <Title style={styles.title}>Who's growing fastest, and what's landing?</Title>
        <Text style={styles.body}>{body}</Text>
        {cta && (
          <Pressable
            onPress={onCta}
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.buttonText}>{cta}</Text>
          </Pressable>
        )}
      </View>
    </DashCard>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex:              1,
    paddingVertical:   spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  inner: {
    alignItems: 'center',
    gap:        spacing.sm,
    maxWidth:   520,
    alignSelf:  'center',
  },
  title: {
    fontSize:  16,
    marginTop: 2,
    textAlign: 'center',
  },
  body: {
    ...type.body,
    fontSize:   16,
    lineHeight: 20,
    color:      neutral.textMid,
    textAlign:  'center',
  },
  button: {
    marginTop:         spacing.sm,
    borderRadius:      radius.pill,
    backgroundColor:   accent.indigo,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.sm,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  buttonText: {
    fontFamily:    font.bold,
    fontSize:      12,
    letterSpacing: 1,
    color:         '#fff',
  },
});
