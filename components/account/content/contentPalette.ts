import { dataVis } from '@/theme/colors';

/**
 * Slice colours for the content donut + table, largest slice first. The data-
 * vis palette reversed reads cool → warm (blue, purple, magenta, pink, coral,
 * orange, yellow), matching the Figma donut.
 */
const SLICE_COLORS = [...dataVis].reverse();

export function sliceColor(index: number): string {
  return SLICE_COLORS[index % SLICE_COLORS.length];
}
