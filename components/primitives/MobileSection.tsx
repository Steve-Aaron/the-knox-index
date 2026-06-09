import React from 'react';
import { Platform, useWindowDimensions, StyleProp, ViewStyle } from 'react-native';
import { MotiView } from 'moti';
import { breakpoints } from '@/theme/breakpoints';

/**
 * MobileSection
 * --------------
 * Layout-only wrapper for a dashboard section. It changes NOTHING about the
 * data, scoring or behaviour — purely presentation for the mobile viewport.
 *
 * On the mobile viewport (width < tablet):
 *   - caps the section's height (default 1200px) and lets it scroll internally
 *     on web, so one tall section can't make the page enormous
 *   - fades + slides the section in on mount, staggered by `index`
 *
 * On tablet / desktop it renders its children untouched, so existing layouts
 * are unaffected.
 */
interface Props {
  /** Stagger order for the entrance animation (0-based). */
  index?: number;
  /** Max height before the section scrolls internally on mobile. */
  maxHeight?: number;
  children: React.ReactNode;
}

export function MobileSection({ index = 0, maxHeight = 1200, children }: Props) {
  const { width } = useWindowDimensions();
  const isMobile = width < breakpoints.tablet;

  // Tablet / desktop: untouched.
  if (!isMobile) return <>{children}</>;

  // Cap + scroll only makes sense on web; native Views don't scroll without a
  // ScrollView, so there we just animate and let content size naturally.
  const mobileStyle: StyleProp<ViewStyle> =
    Platform.OS === 'web'
      // Vertical scroll only — overflowX hidden so a wide child can never
      // introduce a horizontal scrollbar on the section.
      ? ({ width: '100%', maxWidth: '100%', maxHeight, overflowY: 'auto', overflowX: 'hidden' } as any)
      : { width: '100%' };

  return (
    <MotiView
      from={{ opacity: 0, translateY: 18 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 420, delay: Math.min(index, 9) * 70 }}
      style={mobileStyle}
    >
      {children}
    </MotiView>
  );
}
