import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, PanResponder, Platform, useWindowDimensions } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { AnimatePresence } from 'moti';
import { DevLabel } from '@/components/primitives/DevLabel';
import { GlobeSvg } from './GlobeSvg';
import { MapMarker } from './MapMarker';
import { useMarkerRotation, type MarkerCandidate } from '@/hooks/useMarkerRotation';
import { MARKER_METRICS, markerExtent } from './MapMarker';
import { breakpoints } from '@/theme/breakpoints';
import { projectGlobe, placeMarkerCard, clampPhi, wrapLambda, type GlobeRotation, type GlobeView } from '@/lib/globe';
import type { Politician } from '@/data/types';

/**
 * WorldGlobe
 * -----------
 * Hero globe for the World Leaders tenant: a rotating sphere with looping
 * marker reveals, each pinned to its leader's own country.
 *
 * Interaction:
 *   drag    — spin the globe (horizontal spins, vertical tilts, clamped)
 *   release — the spin CARRIES ON and decays under friction, rather than
 *             stopping dead under your finger
 *   scroll  — zoom, between roughly two thirds and double size
 *   idle    — a slow eastward drift resumes once the momentum has bled off
 *
 * Cards stay VISIBLE and readable while all that happens: a card whose pin is
 * heading for the limb slides back towards the centre so it is never cropped,
 * and flips below its dot when there is no room above. The pin itself does not
 * move — only the card it carries. Nothing fades on grab: the clamping is what
 * keeps a card on screen, so hiding it as well only loses the content.
 *
 * Markers are projected through the SAME rotation as the coastlines
 * (lib/globe.ts), so a pin sits on its country by construction, and hides
 * itself when that country rotates to the far side.
 *
 * One job: orchestrate the globe, its gestures and its markers.
 *
 * Composes:
 *   - GlobeSvg          (sphere, decorative)
 *   - MapMarker x N     (one per active pin)
 *   - useMarkerRotation (spawn / expiry scheduling, shared with UkMap)
 */

/** Top videos considered for the rotation. */
const POOL_SIZE = 40;
/** House connector length — the short vertical line used across the dashboards. */
const STEM_HEIGHT = 20;
/** Degrees of eastward drift per second when idle. */
const DRIFT_PER_SECOND = 4;
/** How long after the throw ends before the idle drift takes back over. */
const RESUME_DELAY_MS = 1200;
/** Degrees of rotation per pixel dragged. */
const DRAG_SENSITIVITY = 0.32;
/** Friction on a throw: the fraction of its speed a spin keeps each second. */
const FRICTION_PER_SECOND = 0.12;
/** Below this speed (deg/s) the throw is over. */
const MOMENTUM_FLOOR = 1.5;
/** Cap on throw speed, so a violent flick cannot make the globe unreadable. */
const MAX_MOMENTUM = 420;
/** Keep the card this far inside the container edge. */
const EDGE_PADDING = 10;

const MIN_ZOOM = 0.65;
const MAX_ZOOM = 2;

interface Props {
  politicians: Politician[];
}

export function WorldGlobe({ politicians }: Props) {
  const { width: viewportWidth } = useWindowDimensions();
  const isMobile = viewportWidth < breakpoints.tablet;

  const [box,      setBox]      = useState({ width: 0, height: 0 });
  const [rotation, setRotation] = useState<GlobeRotation>({ lambda: -20, phi: 18 });
  const [zoom,     setZoom]     = useState(1);

  // Refs mirror the state so the animation frame and the gesture handlers can
  // read the latest values without being re-created on every frame.
  const rotationRef  = useRef(rotation);
  const draggingRef  = useRef(false);
  const resumeAtRef  = useRef(0);
  const containerRef = useRef<View | null>(null);
  /** Cumulative drag offsets from the last gesture frame. */
  const dragRef      = useRef({ dx: 0, dy: 0 });
  /** Timestamp of the last drag frame, for velocity. */
  const dragTimeRef  = useRef(0);
  /** Spin carried over from the throw, in degrees per second. */
  const momentumRef  = useRef({ lambda: 0, phi: 0 });
  const zoomRef      = useRef(zoom);
  rotationRef.current = rotation;
  zoomRef.current     = zoom;

  const onWrapLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox(prev => (prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);

  // ── Idle drift ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (box.width === 0) return;
    let frame = 0;
    let last  = Date.now();

    const step = () => {
      const now     = Date.now();
      const elapsed = (now - last) / 1000;
      last = now;

      if (!draggingRef.current) {
        const momentum = momentumRef.current;
        const moving   = Math.abs(momentum.lambda) > MOMENTUM_FLOOR || Math.abs(momentum.phi) > MOMENTUM_FLOOR;

        if (moving) {
          // Carry the throw on, bleeding speed off exponentially. Exponential
          // decay is frame-rate independent, so the same flick travels the same
          // distance at 60Hz and at 120Hz.
          rotationRef.current = {
            lambda: wrapLambda(rotationRef.current.lambda + momentum.lambda * elapsed),
            phi:    clampPhi(rotationRef.current.phi + momentum.phi * elapsed),
          };

          const decay = Math.pow(FRICTION_PER_SECOND, elapsed);
          momentumRef.current = { lambda: momentum.lambda * decay, phi: momentum.phi * decay };

          // A throw that has tipped the globe keeps its tilt; it does not snap
          // back. Once the spin dies the idle drift picks up from wherever it
          // ended, after the usual pause.
          if (Math.abs(momentumRef.current.lambda) <= MOMENTUM_FLOOR && Math.abs(momentumRef.current.phi) <= MOMENTUM_FLOOR) {
            momentumRef.current = { lambda: 0, phi: 0 };
            resumeAtRef.current = now + RESUME_DELAY_MS;
          }

          setRotation(rotationRef.current);
        } else if (now >= resumeAtRef.current) {
          rotationRef.current = {
            ...rotationRef.current,
            lambda: wrapLambda(rotationRef.current.lambda + DRIFT_PER_SECOND * elapsed),
          };
          setRotation(rotationRef.current);
        }
      }

      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [box.width]);

  // ── Drag to spin ────────────────────────────────────────────────────────────
  /** Let go: hand the current velocity to the animation loop as a throw. */
  const release = useCallback(() => {
    draggingRef.current = false;
    dragRef.current     = { dx: 0, dy: 0 };

    const clamp = (v: number) => Math.max(-MAX_MOMENTUM, Math.min(MAX_MOMENTUM, v));
    momentumRef.current = {
      lambda: clamp(momentumRef.current.lambda),
      phi:    clamp(momentumRef.current.phi),
    };
    resumeAtRef.current = Date.now() + RESUME_DELAY_MS;
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Do NOT claim the gesture on touch-down: a tap belongs to whatever is
        // under it (a video card opens TikTok). Only an actual drag of more
        // than a couple of pixels becomes a spin.
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder:  (_e, g) => Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
        // CAPTURE on movement, so a drag that begins on a card is still a spin:
        // the card gives the gesture up as soon as the pointer travels, while a
        // stationary press stays with the card and opens the post.
        onMoveShouldSetPanResponderCapture: (_e, g) => Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
        onPanResponderGrant: () => {
          draggingRef.current = true;
          dragRef.current     = { dx: 0, dy: 0 };
          dragTimeRef.current = Date.now();
          // Taking hold of the globe kills the previous throw.
          momentumRef.current = { lambda: 0, phi: 0 };
        },
        onPanResponderMove: (_e, g) => {
          // dx/dy are cumulative, so track the delta since the last frame.
          const prev = dragRef.current;
          const dx   = g.dx - prev.dx;
          const dy   = g.dy - prev.dy;
          dragRef.current = { dx: g.dx, dy: g.dy };

          const now     = Date.now();
          const elapsed = Math.max(0.008, (now - dragTimeRef.current) / 1000);
          dragTimeRef.current = now;

          const sensitivity = DRAG_SENSITIVITY / zoomRef.current;
          const dLambda     = dx * sensitivity;
          const dPhi        = -dy * sensitivity;

          rotationRef.current = {
            lambda: wrapLambda(rotationRef.current.lambda + dLambda),
            phi:    clampPhi(rotationRef.current.phi + dPhi),
          };
          setRotation(rotationRef.current);

          // Smoothed velocity: a plain last-frame delta makes the throw jump
          // around on a stuttery frame, and a plain average ignores the flick
          // at the end of the gesture. 70/30 favours the most recent motion.
          const instantLambda = dLambda / elapsed;
          const instantPhi    = dPhi / elapsed;
          momentumRef.current = {
            lambda: momentumRef.current.lambda * 0.3 + instantLambda * 0.7,
            phi:    momentumRef.current.phi    * 0.3 + instantPhi    * 0.7,
          };
        },
        onPanResponderRelease: () => release(),
        onPanResponderTerminate: () => release(),
      }),
    [release],
  );

  // ── Pointer and wheel (web) ─────────────────────────────────────────────────
  // react-native-web exposes neither onWheel nor a pointer-down that fires
  // before the responder system, so both go on the DOM node directly.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node || typeof node.addEventListener !== 'function') return;

    // CAPTURE phase: the zoom belongs to the globe wherever the pointer is,
    // including over a video card, so nothing lower down can swallow it first.
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.0015);
      setZoom(prev => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev * factor)));
      resumeAtRef.current = Date.now() + RESUME_DELAY_MS;
    };

    node.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => node.removeEventListener('wheel', onWheel, { capture: true } as any);
  }, [box.width]);

  // ── View + markers ──────────────────────────────────────────────────────────
  const view = useMemo<GlobeView>(() => ({
    radius:   (Math.min(box.width, box.height) / 2) * 0.86 * zoom,
    cx:       box.width / 2,
    cy:       box.height / 2,
    rotation,
  }), [box.width, box.height, zoom, rotation]);

  const candidates = useMemo<MarkerCandidate[]>(() => {
    const all = politicians.flatMap(p => {
      // Coordinates come from metadata.person via the API. No lookup table.
      const place = p.coordinates;
      if (!place) return [];

      return (p.recentPosts ?? [])
        .filter(post => !!post.videoMp4)
        .map(post => ({
          anchor:   { id: p.handle, name: p.country, x: 0, y: 0, lon: place.lng, lat: place.lat },
          post,
          groupKey: p.groupKey,
          handle:   p.handle,
        }));
    });

    return all.sort((a, b) => b.post.views - a.post.views).slice(0, POOL_SIZE);
  }, [politicians]);

  const markers = useMarkerRotation(candidates);

  /**
   * Keep a card on screen while its pin carries on to the limb.
   *
   * The dot and stem stay exactly on the country; only the card slides, and
   * only as far as it must. A pin near the left edge gets a card nudged right,
   * a pin near the top gets its card flipped underneath. Once the dot itself
   * leaves the near side the whole marker goes, which is what the caller
   * checks before calling this.
   */
  const placeCard = useCallback((x: number, y: number) => placeMarkerCard({
    x,
    y,
    width:     box.width,
    height:    box.height,
    cardWidth: MARKER_METRICS.cardWidth * (isMobile ? MARKER_METRICS.mobileScale : 1),
    extent:    markerExtent(STEM_HEIGHT, isMobile),
    padding:   EDGE_PADDING,
  }), [box.width, box.height, isMobile]);

  return (
    <View
      ref={containerRef}
      style={[styles.wrap, Platform.OS === 'web' && styles.grab]}
      onLayout={onWrapLayout}
      {...panResponder.panHandlers}
      {...(Platform.OS === 'web' ? { dataSet: { component: 'worldGlobe' } } as any : {})}
    >
      <DevLabel name="WorldGlobe" />

      {box.width > 0 && (
        <>
          <GlobeSvg view={view} width={box.width} height={box.height} />

          {/* Marker layer — same projection as the coastlines, so pins track
              their country as it turns and go only when that country rotates
              to the far side. Cards stay put through a drag: placeCard() keeps
              them inside the container, so there is nothing to hide from. */}
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <AnimatePresence>
              {markers.map(m => {
                const { lon, lat } = m.anchor;
                if (lon === undefined || lat === undefined) return null;

                const point = projectGlobe(lon, lat, view);
                if (!point.visible) return null;

                const { cardOffsetX, placement } = placeCard(point.x, point.y);

                return (
                  <View
                    key={m.key}
                    pointerEvents="box-none"
                    style={{ position: 'absolute', left: point.x, top: point.y }}
                  >
                    <MapMarker
                      location={m.anchor}
                      post={m.post}
                      groupKey={m.groupKey}
                      handle={m.handle}
                      stemHeight={STEM_HEIGHT}
                      cardOffsetX={cardOffsetX}
                      placement={placement}
                    />
                  </View>
                );
              })}
            </AnimatePresence>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex:        1,
    width:       '100%',
    aspectRatio: 1,
    alignSelf:   'center',
    position:    'relative',
    overflow:    'visible',
  },
  grab: Platform.select({
    web: {
      cursor:           'grab',
      touchAction:      'none',
      userSelect:       'none',
      WebkitUserSelect: 'none',
    } as any,
    default: {},
  }) as any,
});
