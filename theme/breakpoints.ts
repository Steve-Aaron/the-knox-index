import { useWindowDimensions } from 'react-native';

/**
 * Breakpoint tokens. One source of truth for any responsive decision.
 * Values are in CSS-pixel widths at common device sizes.
 */
export const breakpoints = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
  wide: 1440,
} as const;

export type Breakpoint = keyof typeof breakpoints;

/**
 * useBreakpoint
 * --------------
 * Returns the active breakpoint based on current window width. Updates
 * automatically on resize via useWindowDimensions.
 */
export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  if (width >= breakpoints.wide) return 'wide';
  if (width >= breakpoints.desktop) return 'desktop';
  if (width >= breakpoints.tablet) return 'tablet';
  return 'mobile';
}

/**
 * Dashboard grid constants.
 */
export const GRID_COLS = 12;
export const GRID_GAP = 16; // px
export const GRID_MAX_WIDTH = 1440;
