import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { DevLabel } from '@/components/primitives/DevLabel';
import { accent, glass, neutral } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { font, type } from '@/theme/typography';
import type { PlatformFilter, SocialPlatform } from '@/lib/platforms';

/**
 * PlatformLogoFilter
 * -------------------
 * The platform filter as a row of circular logos: 'All', then one circle per
 * platform. A platform that is in the current view is drawn in its brand
 * white on black; one that is not is greyed out. 'All' lights every platform.
 * Used on the dashboard and the account page.
 *
 * One job: pick a platform filter value, showing which platforms are in view.
 */
interface Props {
  /** The platforms this view offers, in display order. */
  platforms: readonly SocialPlatform[];
  value:     PlatformFilter;
  onChange:  (next: PlatformFilter) => void;
  label?:    string;
}

const SIZE = 36;

// Both marks sit white on black, as the platforms draw them
const BRAND: Record<SocialPlatform, { name: string; glyph: string }> = {
  tiktok: { name: 'TikTok', glyph: 'tiktok' },
  x:      { name: 'X',      glyph: 'x-twitter' },
};

// TikTok's mark carries its cyan and pink offset; text-shadow draws it on web
const TIKTOK_SHADOW = '-1.5px -1px 0 #25F4EE, 1.5px 1px 0 #FE2C55';

function Glyph({ platform, on }: { platform: SocialPlatform; on: boolean }) {
  const brand = BRAND[platform];
  if (Platform.OS !== 'web') {
    return <Text style={[styles.fallback, { color: on ? '#FFFFFF' : neutral.textDim }]}>{platform === 'x' ? 'X' : '♪'}</Text>;
  }
  return React.createElement('i', {
    className: `fa-brands fa-${brand.glyph}`,
    'aria-hidden': true,
    style: {
      color:      on ? '#FFFFFF' : neutral.textDim,
      fontSize:   16,
      textShadow: on && platform === 'tiktok' ? TIKTOK_SHADOW : 'none',
    },
  });
}

export function PlatformLogoFilter({ platforms, value, onChange, label = 'PLATFORM' }: Props) {
  const allOn = value === 'all';

  return (
    <View style={styles.row}>
      <DevLabel name="PlatformLogoFilter" />
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <Pressable
        onPress={() => onChange('all')}
        accessibilityRole="button"
        accessibilityLabel="All platforms"
        accessibilityState={{ selected: allOn }}
        style={({ pressed }) => [styles.circle, allOn ? styles.allOn : styles.off, pressed && styles.pressed]}
      >
        <Text style={[styles.allText, allOn && styles.allTextOn]}>All</Text>
      </Pressable>

      {platforms.map(p => {
        const brand = BRAND[p];
        const inView = allOn || value === p;
        return (
          <Pressable
            key={p}
            onPress={() => onChange(p)}
            accessibilityRole="button"
            accessibilityLabel={brand.name}
            accessibilityState={{ selected: value === p }}
            {...(Platform.OS === 'web' ? { title: brand.name } as any : {})}
            style={({ pressed }) => [
              styles.circle,
              inView ? styles.on : styles.off,
              pressed && styles.pressed,
            ]}
          >
            <Glyph platform={p} on={inView} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  label: {
    ...type.caption,
    color:       neutral.textDim,
    fontSize:    12,
    flexShrink:  0,
    marginRight: spacing.xs,
  },
  circle: {
    width:          SIZE,
    height:         SIZE,
    borderRadius:   SIZE / 2,
    borderWidth:    1.5,
    alignItems:     'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor:             'pointer',
        transitionProperty: 'background-color, border-color, opacity',
        transitionDuration: '160ms',
      } as any,
      default: {},
    }),
  },
  off: {
    backgroundColor: glass.fill,
    borderColor:     glass.border,
    opacity:         0.6,
  },
  on: {
    backgroundColor: '#000000',
    borderColor:     'rgba(255,255,255,0.28)',
  },
  allOn: {
    backgroundColor: 'rgba(95,100,189,0.18)',
    borderColor:     accent.indigo,
  },
  pressed: {
    opacity: 0.75,
  },
  allText: {
    fontFamily: font.bold,
    fontSize:   11,
    color:      neutral.textDim,
  },
  allTextOn: {
    color: neutral.text,
  },
  fallback: {
    fontFamily: font.bold,
    fontSize:   15,
  },
});
