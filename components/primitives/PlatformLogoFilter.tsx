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
 * platform. A platform in the current view is drawn as a plain white mark;
 * one that is not is greyed out. 'All' lights every platform. Facebook and
 * Instagram follow, greyed and not pressable, until they are tracked.
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

type Logo = SocialPlatform | 'facebook' | 'instagram';

// Plain white marks on the page background, no brand-colour offsets
const BRAND: Record<Logo, { name: string; glyph: string; fallback: string }> = {
  tiktok:    { name: 'TikTok',    glyph: 'tiktok',     fallback: '♪' },
  x:         { name: 'X',         glyph: 'x-twitter',  fallback: 'X' },
  facebook:  { name: 'Facebook',  glyph: 'facebook-f', fallback: 'f' },
  instagram: { name: 'Instagram', glyph: 'instagram',  fallback: 'IG' },
};

/** Shown greyed out after the live platforms: not tracked yet. */
const COMING_SOON: readonly Logo[] = ['facebook', 'instagram'];

function Glyph({ logo, on }: { logo: Logo; on: boolean }) {
  const brand = BRAND[logo];
  const color = on ? '#FFFFFF' : neutral.textDim;
  if (Platform.OS !== 'web') {
    return <Text style={[styles.fallback, { color }]}>{brand.fallback}</Text>;
  }
  return React.createElement('i', {
    className: `fa-brands fa-${brand.glyph}`,
    'aria-hidden': true,
    style: { color, fontSize: 16 },
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
        <Text style={[styles.allText, allOn && styles.allTextOn]}>ALL</Text>
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
            <Glyph logo={p} on={inView} />
          </Pressable>
        );
      })}

      {COMING_SOON.filter(l => !(platforms as readonly Logo[]).includes(l)).map(l => (
        <View
          key={l}
          accessibilityLabel={`${BRAND[l].name}, coming soon`}
          {...(Platform.OS === 'web' ? { title: `${BRAND[l].name}: coming soon` } as any : {})}
          style={[styles.circle, styles.soon]}
        >
          <Glyph logo={l} on={false} />
        </View>
      ))}
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
    backgroundColor: 'transparent',
    borderColor:     'rgba(255,255,255,0.28)',
  },
  soon: {
    backgroundColor: 'transparent',
    borderColor:     glass.border,
    opacity:         0.35,
    ...Platform.select({ web: { cursor: 'not-allowed' } as any, default: {} }),
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
    fontSize:      10,
    letterSpacing: 0.6,
    color:         neutral.textDim,
  },
  allTextOn: {
    color: neutral.text,
  },
  fallback: {
    fontFamily: font.bold,
    fontSize:   15,
  },
});
