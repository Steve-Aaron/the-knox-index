import { useBreakpoint } from '@/theme/breakpoints';

/**
 * Layout tokens for the account page. One place to tune widget sizing.
 *
 * Desktop grid (≥1024px), widths are proportional (flex ratios), so they
 * behave as percentages of the row after gaps:
 *
 *   ┌ side 25% ─┐ ┌──────────── main 75% ─────────────┐
 *   │ Profile   │ │ Time range · platform · KPIs       │
 *   │           │ ├── Performance 50% ─┬─ Content 50% ─┤
 *   ├───────────┤ │                    │               │
 *   │ Key stats │ ├────────────────────┴───────────────┤
 *   └───────────┘ │ Best-performing posts              │
 *                 └────────────────────────────────────┘
 */
export const ACCOUNT_LAYOUT = {
  /** Fixed height of the tall widgets on desktop. Auto on smaller screens. */
  widgetHeight: 620,
  sideFlex:     1,
  mainFlex:     3,
  gap:          24,
} as const;

export interface AccountLayout {
  isDesktop:    boolean;
  isTablet:     boolean;
  isMobile:     boolean;
  /** Height for the tall widgets, or undefined to size to content. */
  widgetHeight: number | undefined;
}

export function useAccountLayout(): AccountLayout {
  const bp = useBreakpoint();
  const isDesktop = bp === 'desktop' || bp === 'wide';
  return {
    isDesktop,
    isTablet:     bp === 'tablet',
    isMobile:     bp === 'mobile',
    widgetHeight: isDesktop ? ACCOUNT_LAYOUT.widgetHeight : undefined,
  };
}
