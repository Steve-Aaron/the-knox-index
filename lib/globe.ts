/**
 * lib/globe.ts
 * -------------
 * The globe's coordinate system: an orthographic projection of a rotating
 * sphere, plus the path builders that draw it.
 *
 * ONE definition of the maths, used by the land, the graticule and the marker
 * layer alike — so a pin cannot drift from the country under it, whatever the
 * rotation or zoom.
 *
 * Orthographic, for rotation (λ₀, φ₀) and a point (λ, φ) in radians:
 *   cos c = sin φ₀ · sin φ + cos φ₀ · cos φ · cos(λ − λ₀)
 *   x     = cx + R · cos φ · sin(λ − λ₀)
 *   y     = cy − R · (cos φ₀ · sin φ − sin φ₀ · cos φ · cos(λ − λ₀))
 *
 * `cos c < 0` means the point is on the far side of the sphere, facing away.
 *
 * This module imports nothing: the caller passes the geometry in. That keeps
 * the maths pure and directly testable (see scripts/check-tenants.mjs).
 *
 * One job: turn degrees into globe pixels.
 */

/** Flat [lon, lat, lon, lat, …] rings — the shape lib/world-geometry.ts holds. */
export type GeoRings = readonly (readonly number[])[];

const DEG = Math.PI / 180;

export interface GlobeRotation {
  /** Longitude at the centre of the disc, degrees. Increasing spins east. */
  lambda: number;
  /** Latitude at the centre, degrees. Clamped by clampPhi. */
  phi:    number;
}

export interface GlobeView {
  /** Disc radius in px. */
  radius:   number;
  /** Disc centre in px, within the measured box. */
  cx:       number;
  cy:       number;
  rotation: GlobeRotation;
}

export interface GlobePoint {
  x:       number;
  y:       number;
  /** False when the point is on the far side of the sphere. */
  visible: boolean;
}

/** Keep the pole from tipping past vertical, where dragging inverts. */
export function clampPhi(phi: number): number {
  return Math.max(-82, Math.min(82, phi));
}

/**
 * Wrap a longitude into [-180, 180) so a continuously spinning globe never
 * accumulates an unbounded number. -180 and 180 are the same meridian, and the
 * lower bound is the one kept.
 */
export function wrapLambda(lambda: number): number {
  return ((lambda + 180) % 360 + 360) % 360 - 180;
}

/** Longitude/latitude in degrees → globe pixels. */
export function projectGlobe(lon: number, lat: number, view: GlobeView): GlobePoint {
  const { radius, cx, cy, rotation } = view;

  const lambda  = lon * DEG;
  const phi     = lat * DEG;
  const lambda0 = rotation.lambda * DEG;
  const phi0    = rotation.phi * DEG;

  const cosPhi   = Math.cos(phi);
  const sinPhi   = Math.sin(phi);
  const cosDelta = Math.cos(lambda - lambda0);
  const sinDelta = Math.sin(lambda - lambda0);
  const cosPhi0  = Math.cos(phi0);
  const sinPhi0  = Math.sin(phi0);

  const cosC = sinPhi0 * sinPhi + cosPhi0 * cosPhi * cosDelta;

  return {
    x:       cx + radius * cosPhi * sinDelta,
    y:       cy - radius * (cosPhi0 * sinPhi - sinPhi0 * cosPhi * cosDelta),
    visible: cosC >= 0,
  };
}

/**
 * Push a far-side point out to the limb, along its own direction from the
 * centre. Coastlines then hug the edge of the disc as they rotate away instead
 * of snapping straight across it.
 */
function toLimb(p: GlobePoint, view: GlobeView): GlobePoint {
  const dx = p.x - view.cx;
  const dy = p.y - view.cy;
  const d  = Math.hypot(dx, dy) || 1;
  return { x: view.cx + (dx / d) * view.radius, y: view.cy + (dy / d) * view.radius, visible: false };
}

/**
 * One `d` string for every landmass — a single Path element rather than 258 of
 * them, which is what keeps a spinning globe cheap to re-render.
 */
export function buildLandPath(view: GlobeView, rings: GeoRings): string {
  const parts: string[] = [];

  for (const ring of rings) {
    let open      = false;
    let lastPoint: GlobePoint | null = null;

    for (let i = 0; i < ring.length; i += 2) {
      const point = projectGlobe(ring[i], ring[i + 1], view);

      if (point.visible) {
        if (!open) {
          // Enter through the limb so the coast meets the edge cleanly.
          if (lastPoint && !lastPoint.visible) {
            const edge = toLimb(lastPoint, view);
            parts.push(`M${edge.x.toFixed(1)},${edge.y.toFixed(1)}`);
            parts.push(`L${point.x.toFixed(1)},${point.y.toFixed(1)}`);
          } else {
            parts.push(`M${point.x.toFixed(1)},${point.y.toFixed(1)}`);
          }
          open = true;
        } else {
          parts.push(`L${point.x.toFixed(1)},${point.y.toFixed(1)}`);
        }
      } else if (open) {
        const edge = toLimb(point, view);
        parts.push(`L${edge.x.toFixed(1)},${edge.y.toFixed(1)}`);
        open = false;
      }

      lastPoint = point;
    }

    if (open) parts.push('Z');
  }

  return parts.join('');
}

/**
 * Meridians and parallels, as one path. Purely decorative: it is what makes
 * the rotation readable when an ocean is facing the viewer.
 */
export function buildGraticulePath(view: GlobeView, step = 30): string {
  const parts: string[] = [];

  const line = (points: [number, number][]) => {
    let open = false;
    for (const [lon, lat] of points) {
      const p = projectGlobe(lon, lat, view);
      if (!p.visible) { open = false; continue; }
      parts.push(`${open ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`);
      open = true;
    }
  };

  for (let lon = -180; lon < 180; lon += step) {
    const meridian: [number, number][] = [];
    for (let lat = -80; lat <= 80; lat += 5) meridian.push([lon, lat]);
    line(meridian);
  }

  for (let lat = -60; lat <= 60; lat += step) {
    const parallel: [number, number][] = [];
    for (let lon = -180; lon <= 180; lon += 5) parallel.push([lon, lat]);
    line(parallel);
  }

  return parts.join('');
}

// ── Marker cards ──────────────────────────────────────────────────────────────

export interface CardPlacementInput {
  /** The pin's position within the container, px. */
  x:          number;
  y:          number;
  /** Container size, px. */
  width:      number;
  height:     number;
  /** Rendered card width, px. */
  cardWidth:  number;
  /** Vertical space the marker needs on one side of its dot, px. */
  extent:     number;
  /** Minimum gap to the container edge, px. */
  padding:    number;
}

export interface CardPlacement {
  /** Horizontal nudge for the card, px. 0 when it already fits. */
  cardOffsetX: number;
  placement:   'above' | 'below';
}

/**
 * Where a marker's card should sit so it stays fully visible while its pin
 * keeps moving. The pin does not move: only the card slides, and only as far
 * as it must.
 *
 * Pure, so the behaviour is checked in scripts/check-tenants.mjs rather than
 * by dragging a globe and squinting.
 */
export function placeMarkerCard({
  x, y, width, height, cardWidth, extent, padding,
}: CardPlacementInput): CardPlacement {
  const halfCard = cardWidth / 2;
  const minX     = halfCard + padding;
  const maxX     = Math.max(minX, width - halfCard - padding);
  const clampedX = Math.max(minX, Math.min(maxX, x));

  const fitsAbove = y - extent >= padding;
  const fitsBelow = y + extent <= height - padding;

  return {
    cardOffsetX: clampedX - x,
    // Above unless the top would crop it and there is room the other way.
    placement:   fitsAbove || !fitsBelow ? 'above' : 'below',
  };
}
