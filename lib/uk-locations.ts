/**
 * lib/uk-locations.ts
 * --------------------
 * Marker anchor coordinates in the same 1024x1024 viewBox space that the
 * UK map renders into. Y points DOWN (top-left origin) — these are the
 * post-transform coords used directly by react-native-svg.
 *
 * Selection currently covers England, Wales, and Southern Scotland (Central
 * Belt + Borders). Northern Scotland and Northern Ireland are intentionally
 * excluded from the marker rotation.
 *
 * Coords below are the original eyeballed values from the first cut of the
 * hero — the user reported these as the best-positioned of all variations
 * we tried. If positions need to be more precise in future, rebuild the
 * MapCalibrator (see git history for 'MapCalibrator') and ensure the wrap
 * matches the hero's layout exactly during calibration.
 */

export interface UkLocation {
  id:   string;
  name: string;
  x:    number;   // 0..1024 in viewBox space
  y:    number;
}

export const UK_MARKER_LOCATIONS: UkLocation[] = [
  // England — major cities, north to south.
  // Coords reprojected 2026-06 from each city's real latitude/longitude,
  // calibrated to the silhouette's coastline extremes (see git history).
  { id: 'newcastle',  name: 'Newcastle',  x: 614, y: 473 },
  { id: 'leeds',      name: 'Leeds',      x: 619, y: 602 },
  { id: 'manchester', name: 'Manchester', x: 575, y: 637 },
  { id: 'liverpool',  name: 'Liverpool',  x: 527, y: 645 },
  { id: 'sheffield',  name: 'Sheffield',  x: 624, y: 648 },
  { id: 'nottingham', name: 'Nottingham', x: 644, y: 695 },
  { id: 'birmingham', name: 'Birmingham', x: 597, y: 747 },
  { id: 'norwich',    name: 'Norwich',    x: 800, y: 731 },
  { id: 'bristol',    name: 'Bristol',    x: 553, y: 860 },
  { id: 'london',     name: 'London',     x: 709, y: 854 },
  { id: 'brighton',   name: 'Brighton',   x: 708, y: 929 },

  // Wales
  { id: 'cardiff',    name: 'Cardiff',    x: 515, y: 857 },

  // Southern Scotland — Central Belt and Borders
  { id: 'edinburgh',  name: 'Edinburgh',  x: 515, y: 366 },
  { id: 'glasgow',    name: 'Glasgow',    x: 447, y: 376 },
  { id: 'dumfries',   name: 'Dumfries',   x: 488, y: 463 },
];

/**
 * @deprecated kept as an alias for backwards compatibility while callers
 * migrate to the broader UK_MARKER_LOCATIONS name. Remove on next pass.
 */
export const ENGLAND_WALES_LOCATIONS = UK_MARKER_LOCATIONS;

/**
 * IDs of Scottish markers. The hero map uses this to shorten the connector
 * stem from the dot to the video card for these locations (Scotland sits
 * close to the top of the viewBox, so a full-length stem would push the
 * card off-canvas).
 */
export const SCOTTISH_LOCATION_IDS: ReadonlySet<string> = new Set([
  'edinburgh',
  'glasgow',
  'dumfries',
]);
