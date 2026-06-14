import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Linking, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { KnoxLogo } from './KnoxLogo';
import { logout } from '@/lib/logout';
import { useRegisteredFlag } from '@/hooks/useRegisteredFlag';
import { neutral, glass, accent } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { font } from '@/theme/typography';
import { breakpoints } from '@/theme/breakpoints';

/**
 * HeaderNav
 * ----------
 * Two-slot top bar:
 *
 *   [ logo ]                                   [ Sign up  Log in ]
 *
 * The Knox wordmark sits on the left and doubles as the home link (so a
 * separate 'Dashboard' link would be redundant). The auth actions sit on the
 * right. Tapping the logo reloads the dashboard (full refresh on web).
 *
 * On narrow viewports the layout stays flat (no stacking); the logo
 * shrinks and the side links tighten up via reduced horizontal padding.
 */

export type HeaderNavItem = {
  label:    string;
  to?:      string;
  href?:    string;
  /** Action item — takes precedence over to/href. */
  onPress?: () => void;
};

interface Props {
  activeRoute?: string;
  /** Left-hand actions. Defaults are auth-aware — see useRegisteredFlag. */
  leftItems?:   HeaderNavItem[];
  /** Right-hand actions. Defaults to 'Dashboard'. */
  rightItems?:  HeaderNavItem[];
}

const SIGNED_OUT_LINKS: HeaderNavItem[] = [
  { label: 'Sign up', to: '/signup' },
  { label: 'Log in',  to: '/login'  },
];
const SIGNED_IN_LINKS: HeaderNavItem[] = [
  { label: 'Preferences', to: '/preferences' },
  { label: 'Log out',     onPress: () => { logout(); } },
];

export function HeaderNav({ activeRoute, leftItems, rightItems }: Props) {
  const { width }    = useWindowDimensions();
  const isRegistered = useRegisteredFlag();
  const isMobile     = width < breakpoints.tablet;
  const logoWidth    = isMobile ? 88 : 132;

  // Right-hand auth actions. Either prop can still override the default list.
  const links = rightItems ?? leftItems ?? (isRegistered ? SIGNED_IN_LINKS : SIGNED_OUT_LINKS);

  // Logo = home. On web do a real refresh to '/' (rebuilds the dashboard and
  // re-fetches), on native push the route.
  const goHome = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.assign('/');
    else router.push('/');
  };

  return (
    <View style={[styles.wrap, isMobile && styles.wrapMobile]}>
      <View style={styles.sideLeft}>
        <Pressable
          onPress={goHome}
          accessibilityRole="link"
          accessibilityLabel="Knox Index — home"
          style={({ pressed }) => [styles.brand, pressed && { opacity: 0.75 }]}
        >
          <KnoxLogo width={logoWidth} />
        </Pressable>
      </View>

      <View style={styles.sideRight}>
        {links.map(item => (
          <NavLink key={item.label} item={item} active={item.to === activeRoute} compact={isMobile} />
        ))}
      </View>
    </View>
  );
}

// ── NavLink ───────────────────────────────────────────────────────────────────

function NavLink({ item, active, compact }: { item: HeaderNavItem; active: boolean; compact?: boolean }) {
  const handlePress = () => {
    if (item.onPress) item.onPress();
    else if (item.href) Linking.openURL(item.href);
    else if (item.to) router.push(item.to as any);
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="link"
      style={({ pressed }) => [styles.link, compact && styles.linkCompact, pressed && { opacity: 0.7 }]}
    >
      {({ hovered }: any) => (
        <>
          <Text style={[
            styles.linkLabel,
            compact && styles.linkLabelCompact,
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
    gap:            spacing.sm,
  },
  sideRight: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'flex-end',
    gap:            spacing.sm,
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
  // Mobile (<768px): two links must fit beside the logo — tighten padding,
  // type size and tracking so the signed-out left side never wraps at 375px.
  linkCompact: {
    paddingHorizontal: spacing.xs,
  },
  linkLabelCompact: {
    fontSize:      11,
    letterSpacing: 0.6,
  },

  linkLabelHovered: { color: neutral.text },
  linkLabelActive:  { color: accent.indigo },

  underline: {
    position:        'absolute' as any,
    left:            0,
    right:           0,
    bottom:          0,
    height:          2,
    backgroundColor: accent.indigo,
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
