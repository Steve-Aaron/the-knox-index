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
 * colours; one that is not is greyed out. 'All' lights every platform.
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

const BRAND: Record<SocialPlatform, { name: string; glyph: string; bg: string; fg: string; border: string }> = {
  tiktok: { name: 'TikTok', glyph: 'tiktok',    bg: '#000000', fg: '#FFFFFF', border: '#FE2C55' },
  x:      { name: 'X',      glyph: 'x-twitter', bg: '#FFFFFF', fg: '#000000', border: '#FFFFFF' },
};

// TikTok's mark carries its cyan and pink offset; text-shadow draws it on web
const TIKTOK_SHADOW = '-1.5px -1px 0 #25F4EE, 1.5px 1px 0 #FE2C55';

function Glyph({ platform, on }: { platform: SocialPlatform; on: boolean }) {
  const brand = BRAND[platform];
  if (Platform.OS !== 'web') {
    return <Text style={[styles.fallback, { color: on ? brand.fg : neutral.textDim }]}>{platform === 'x' ? 'X' : '♪'}</Text>;
  }
  return React.createElement('i', {
    className: `fa-brands fa-${brand.glyph}`,
    'aria-hidden': true,
    style: {
      color:      on ? brand.fg : neutral.textDim,
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
        const picked = value === p;
        return (
          <Pressable
            key={p}
            onPress={() => onChange(p)}
            accessibilityRole="button"
            accessibilityLabel={brand.name}
            accessibilityState={{ selected: picked }}
            {...(Platform.OS === 'web' ? { title: brand.name } as any : {})}
            style={({ pressed }) => [
              styles.circle,
              inView
                ? { backgroundColor: brand.bg, borderColor: picked ? accent.indigo : brand.border }
                : styles.off,
              picked && styles.picked,
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
  allOn: {
    backgroundColor: 'rgba(95,100,189,0.18)',
    borderColor:     accent.indigo,
  },
  // The one platform picked on its own gets a second ring
  picked: {
    borderWidth: 2,
    ...Platform.select({
      web: { boxShadow: `0 0 0 2px rgba(95,100,189,0.35)` } as any,
      default: {},
    }),
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
