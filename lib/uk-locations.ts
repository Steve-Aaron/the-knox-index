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
  // England — major cities, north to south
  { id: 'newcastle',  name: 'Newcastle',  x: 640, y: 540 },
  { id: 'leeds',      name: 'Leeds',      x: 640, y: 640 },
  { id: 'manchester', name: 'Manchester', x: 590, y: 660 },
  { id: 'liverpool',  name: 'Liverpool',  x: 555, y: 660 },
  { id: 'sheffield',  name: 'Sheffield',  x: 615, y: 670 },
  { id: 'nottingham', name: 'Nottingham', x: 655, y: 700 },
  { id: 'birmingham', name: 'Birmingham', x: 620, y: 720 },
  { id: 'norwich',    name: 'Norwich',    x: 775, y: 730 },
  { id: 'bristol',    name: 'Bristol',    x: 565, y: 820 },
  { id: 'london',     name: 'London',     x: 700, y: 850 },
  { id: 'brighton',   name: 'Brighton',   x: 690, y: 880 },

  // Wales
  { id: 'cardiff',    name: 'Cardiff',    x: 510, y: 825 },

  // Southern Scotland — Central Belt and Borders
  { id: 'edinburgh',  name: 'Edinburgh',  x: 580, y: 430 },
  { id: 'glasgow',    name: 'Glasgow',    x: 510, y: 445 },
  { id: 'dumfries',   name: 'Dumfries',   x: 530, y: 450 },
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
