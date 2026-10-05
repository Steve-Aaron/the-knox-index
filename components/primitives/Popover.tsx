import React from 'react';
import { Interstitial } from '@/components/primitives/Interstitial';

/**
 * Popover (native)
 * -----------------
 * There is no anchored layer on iOS or Android worth the complexity here, so
 * the native build shows the same content as a takeover sheet. The web build
 * (Popover.web.tsx) is the real popover: a panel anchored to the badge, in the
 * browser's top layer.
 *
 * Both share this API, so callers never branch on platform.
 *
 * One job: show helper content anchored to a trigger.
 */

export interface AnchorRect {
  x:      number;
  y:      number;
  width:  number;
  height: number;
}

export interface PopoverProps {
  visible:     boolean;
  onClose:     () => void;
  /** Where the trigger is, in viewport coordinates. Ignored on native. */
  anchorRect:  AnchorRect | null;
  title?:      string;
  text?:       string;
  children?:   React.ReactNode;
  width?:      number;
}

export function Popover({ visible, onClose, title = 'What does this show?', text, children }: PopoverProps) {
  return (
    <Interstitial visible={visible} onClose={onClose} kicker={title.toUpperCase()} text={text} fullScreen>
      {children}
    </Interstitial>
  );
}
