import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { neutral, glass, knox } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';

/**
 * Popover (web)
 * --------------
 * A helper panel anchored to its trigger, rendered into the browser's TOP
 * LAYER so no card, sticky header or overflow:hidden ancestor can clip it.
 *
 * It uses the native Popover API when the browser has it, which is what puts
 * it above every z-index on the page, and falls back to a portal with a high
 * z-index where it does not.
 *
 * Placement: below the trigger, flipped above when the viewport bottom is
 * close, and clamped horizontally so it never runs off the side. A caret
 * points back at the trigger.
 *
 * Dismissal: click anywhere outside, Escape, scroll, or resize.
 *
 * One job: show helper content anchored to a trigger, above everything.
 */

export interface AnchorRect {
  x:      number;
  y:      number;
  width:  number;
  height: number;
}

export interface PopoverProps {
  visible:    boolean;
  onClose:    () => void;
  anchorRect: AnchorRect | null;
  title?:     string;
  text?:      string;
  children?:  React.ReactNode;
  width?:     number;
}

/** Gap between the trigger and the panel, and the minimum edge margin. */
const GAP    = 10;
const MARGIN = 12;
const CARET  = 7;

export function Popover({
  visible, onClose, anchorRect, title = 'What does this show?', text, children, width = 280,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number; above: boolean; caretLeft: number } | null>(null);

  // Position once the panel has a measured height, so a flip above the trigger
  // uses the real height rather than an estimate.
  useLayoutEffect(() => {
    if (!visible || !anchorRect) { setPosition(null); return; }

    const panelHeight = panelRef.current?.offsetHeight ?? 140;
    const viewportW   = window.innerWidth;
    const viewportH   = window.innerHeight;

    const anchorCentre = anchorRect.x + anchorRect.width / 2;
    const belowTop     = anchorRect.y + anchorRect.height + GAP;
    const above        = belowTop + panelHeight > viewportH - MARGIN;

    const top  = above ? Math.max(MARGIN, anchorRect.y - GAP - panelHeight) : belowTop;
    const left = Math.max(MARGIN, Math.min(viewportW - width - MARGIN, anchorCentre - width / 2));

    setPosition({
      left,
      top,
      above,
      // The caret tracks the trigger even when the panel has been pushed
      // sideways to stay on screen.
      caretLeft: Math.max(CARET * 2, Math.min(width - CARET * 2, anchorCentre - left)),
    });
  }, [visible, anchorRect, width]);

  // Top layer, where the browser supports it.
  useEffect(() => {
    const node = panelRef.current as any;
    if (!node || typeof node.showPopover !== 'function') return;
    try {
      if (visible) node.showPopover();
      else if (node.matches?.(':popover-open')) node.hidePopover();
    } catch { /* already open or closed */ }
  }, [visible, position]);

  // Escape, outside click, scroll and resize all dismiss.
  useEffect(() => {
    if (!visible) return;

    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onPointerDown = (e: PointerEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) onClose();
    };

    window.addEventListener('keydown', onKey);
    // Capture, so a handler that stops propagation cannot trap the popover open.
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('resize', onClose);

    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('resize', onClose);
    };
  }, [visible, onClose]);

  if (!visible || typeof document === 'undefined') return null;

  const panel = (
    <div
      ref={panelRef}
      // 'manual' rather than 'auto': dismissal is handled above, and 'auto'
      // would close the panel on the same click that opened it. Cast because
      // this React version's typings predate the Popover API; browsers that do
      // not know the attribute ignore it and get the portal fallback.
      {...({ popover: 'manual' } as any)}
      data-component="infoPopover"
      role="dialog"
      aria-label={title}
      style={{
        position:        'fixed',
        left:            position?.left ?? -9999,
        top:             position?.top ?? -9999,
        width,
        margin:          0,
        padding:         `${spacing.md}px ${spacing.base}px`,
        borderRadius:    radius.md,
        border:          `1px solid ${glass.borderHi}`,
        background:      'rgba(31, 29, 29, 0.96)',
        backdropFilter:  'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        boxShadow:       '0 18px 48px rgba(0,0,0,0.55)',
        color:           neutral.text,
        zIndex:          2147483647,
        opacity:         position ? 1 : 0,
        transition:      'opacity 120ms ease',
        overflow:        'visible',
      }}
    >
      {/* Caret — a rotated square poking out of the edge nearest the trigger. */}
      {position ? (
        <span
          aria-hidden
          style={{
            position:   'absolute',
            left:       position.caretLeft - CARET,
            [position.above ? 'bottom' : 'top']: -CARET,
            width:      CARET * 2,
            height:     CARET * 2,
            transform:  'rotate(45deg)',
            background: 'rgba(31, 29, 29, 0.96)',
            borderRight:  position.above ? `1px solid ${glass.borderHi}` : 'none',
            borderBottom: position.above ? `1px solid ${glass.borderHi}` : 'none',
            borderLeft:   position.above ? 'none' : `1px solid ${glass.borderHi}`,
            borderTop:    position.above ? 'none' : `1px solid ${glass.borderHi}`,
          } as React.CSSProperties}
        />
      ) : null}

      <p style={{
        margin:        '0 0 6px',
        fontSize:      10,
        letterSpacing: 1.4,
        textTransform: 'uppercase',
        color:         knox.primaryOrange,
      }}>
        {title}
      </p>

      {text ? (
        <p style={{ margin: 0, fontSize: 13, lineHeight: '19px', color: neutral.textDim }}>{text}</p>
      ) : null}

      {children}
    </div>
  );

  return createPortal(panel, document.body);
}
