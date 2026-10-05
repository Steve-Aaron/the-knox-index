/**
 * lib/mapFit.ts
 * --------------
 * Where an SVG actually lands inside its box under
 * preserveAspectRatio='xMidYMid meet': scaled to fit, centred, letterboxed on
 * the longer axis.
 *
 * Marker layers need this. Positioning a pin as a percentage of the WRAP only
 * lines up when the wrap happens to match the viewBox aspect; anywhere else the
 * pins drift off the coastline. Measuring the drawn rectangle and placing pins
 * inside it makes them correct at every size.
 *
 * One job: viewBox + box → the drawn rectangle.
 */

export interface DrawnRect {
  /** Pixel offsets of the drawn map inside the measured box. */
  left:   number;
  top:    number;
  width:  number;
  height: number;
  /** Drawn pixels per viewBox unit. */
  scale:  number;
}

export function fitViewBox(
  box: { width: number; height: number },
  viewBoxWidth: number,
  viewBoxHeight: number,
): DrawnRect {
  if (box.width <= 0 || box.height <= 0) {
    return { left: 0, top: 0, width: 0, height: 0, scale: 0 };
  }
  const scale  = Math.min(box.width / viewBoxWidth, box.height / viewBoxHeight);
  const width  = viewBoxWidth  * scale;
  const height = viewBoxHeight * scale;
  return {
    left:  (box.width  - width)  / 2,
    top:   (box.height - height) / 2,
    width,
    height,
    scale,
  };
}
