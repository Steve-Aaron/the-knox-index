import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Linking, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { KnoxLogo } from './KnoxLogo';
import { neutral, glass, knox } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { font } from '@/theme/typography';
import { breakpoints } from '@/theme/breakpoints';

/**
 * HeaderNav
 * ----------
 * Three-slot top bar:
 *
 *   [ Sign up ]   [ centred logo ]   [ Dashboard ]
 *
 * Both sides are plain text NavLinks — same size, same weight, same
 * letter-spacing — so the row reads as a balanced editorial header.
 * The centre slot is the Knox wordmark, which doubles as a home link.
 *
 * On narrow viewports the layout stays flat (no stacking); the logo
 * shrinks and the side links tighten up via reduced horizontal padding.
 */

export type HeaderNavItem = {
  label:    string;
  to?:      string;
  href?:    string;
};

interface Props {
  activeRoute?: string;
  /** Left-hand action. Defaults to 'Sign up'. */
  leftItem?:    HeaderNavItem;
  /** Right-hand action. Defaults to 'Dashboard'. */
  rightItem?:   HeaderNavItem;
}

const DEFAULT_LEFT:  HeaderNavItem = { label: 'Sign up',   to: '/signup' };
const DEFAULT_RIGHT: HeaderNavItem = { label: 'Dashboard', to: '/' };

export function HeaderNav({ activeRoute, leftItem = DEFAULT_LEFT, rightItem = DEFAULT_RIGHT }: Props) {
  const { width } = useWindowDimensions();
  const isMobile  = width < breakpoints.tablet;
  const logoWidth = isMobile ? 88 : 132;

  return (
    <View style={[styles.wrap, isMobile && styles.wrapMobile]}>
      <View style={styles.sideLeft}>
        <NavLink item={leftItem} active={leftItem.to === activeRoute} />
      </View>

      <Pressable
        onPress={() => router.push('/')}
        accessibilityRole="link"
        accessibilityLabel="Knox Index — home"
        style={({ pressed }) => [styles.brand, pressed && { opacity: 0.75 }]}
      >
        <KnoxLogo width={logoWidth} />
      </Pressable>

      <View style={styles.sideRight}>
        <NavLink item={rightItem} active={rightItem.to === activeRoute} />
      </View>
    </View>
  );
}

// ── NavLink ───────────────────────────────────────────────────────────────────

function NavLink({ item, active }: { item: HeaderNavItem; active: boolean }) {
  const handlePress = () => {
    if (item.href) Linking.openURL(item.href);
    else if (item.to) router.push(item.to as any);
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="link"
      style={({ pressed }) => [styles.link, pressed && { opacity: 0.7 }]}
    >
      {({ hovered }: any) => (
        <>
          <Text style={[
            styles.linkLabel,
            active  && styles.linkLabelActive,
            hovered && styles.linkLabelHovered,
          ]}>
            {item.label}
          </Text>
          <View style={[styles.underline, (active || hovered) && styles.underlineActive]} />
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical:   spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: glass.border,
    gap:               spacing.md,
  },
  wrapMobile: {
    paddingHorizontal: spacing.md,
  },

  sideLeft: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'flex-start',
  },
  sideRight: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'flex-end',
  },
  brand: {
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },

  link: {
    position:          'relative',
    paddingVertical:   spacing.xs,
    paddingHorizontal: spacing.sm,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {},
    }),
  },
  linkLabel: {
    fontFamily:    font.bold,
    fontWeight:    '700',
    fontSize:      12,
    color:         neutral.textMid,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    ...Platform.select({
      web: {
        transitionProperty: 'color',
        transitionDuration: '180ms',
      } as any,
      default: {},
    }),
  },
  linkLabelHovered: { color: neutral.text },
  linkLabelActive:  { color: knox.primaryPink },

  underline: {
    position:        'absolute' as any,
    left:            0,
    right:           0,
    bottom:          0,
    height:          2,
    backgroundColor: knox.primaryPink,
    transform:       [{ scaleY: 0 }],
    ...Platform.select({
      web: {
        transitionProperty: 'transform',
        transitionDuration: '220ms',
        transformOrigin:    'bottom',
      } as any,
      default: {},
    }),
  },
  underlineActive: { transform: [{ scaleY: 1 }] },
});
