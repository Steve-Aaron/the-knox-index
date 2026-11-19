/**
 * Shared polar geometry for the SVG charts. 0° points straight up and angles
 * grow clockwise, matching how the radar and donut are read.
 */
export interface Point {
  x: number;
  y: number;
}

export function polar(cx: number, cy: number, radius: number, angleDeg: number): Point {
  const a = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
}

/**
 * SVG path for a ring segment (donut slice) between two angles.
 * Uses outer arc → inner arc reversed, so the slice fills as one shape.
 */
export function ringSegmentPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startDeg: number,
  endDeg: number,
): string {
  const sweep = endDeg - startDeg;
  const largeArc = sweep > 180 ? 1 : 0;
  const o1 = polar(cx, cy, outerR, startDeg);
  const o2 = polar(cx, cy, outerR, endDeg);
  const i1 = polar(cx, cy, innerR, endDeg);
  const i2 = polar(cx, cy, innerR, startDeg);
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${o2.x} ${o2.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${i2.x} ${i2.y}`,
    'Z',
  ].join(' ');
}
