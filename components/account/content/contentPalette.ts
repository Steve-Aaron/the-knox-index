/**
 * Slice colours for the content donut + table, largest slice first, from the
 * Figma "Content / Alt palette" card: cool → warm (blue, purple, plum,
 * magenta, pink, coral, orange, yellow). Eight at most, so every named slice
 * stays distinguishable; everything grouped into "Other" is neutral grey.
 */
const SLICE_COLORS = [
  '#7E96FB',
  '#9565C7',
  '#A43C92',
  '#D92A93',
  '#FE527D',
  '#FF7967',
  '#FF9751',
  '#FFC14E',
] as const;

export const OTHER_COLOR = '#B6B6CC';

/** Most slices the donut names before the rest go into "Other". */
export const MAX_NAMED_SLICES = SLICE_COLORS.length;

export function sliceColor(index: number): string {
  return SLICE_COLORS[index] ?? OTHER_COLOR;
}
