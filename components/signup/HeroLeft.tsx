import React from 'react';
import { View, StyleSheet } from 'react-native';
import { spacing } from '@/theme/spacing';
import { HeroText } from './HeroText';
import { NewsletterForm } from './NewsletterForm';

/**
 * HeroLeft
 * ---------
 * Left column of the hero: headline block + signup form.
 * Stacks vertically — HeroText on top, NewsletterForm below.
 */

export function HeroLeft() {
  return (
    <View style={styles.wrap}>
      <HeroText />
      <NewsletterForm />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    gap:  spacing.xxl,
  },
});
