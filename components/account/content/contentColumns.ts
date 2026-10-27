import { StyleSheet } from 'react-native';
import { useAccountLayout } from '../layout/accountLayout';

/**
 * Fixed numeric column widths, shared by the table header and rows so they
 * align. Phones get narrower columns (the 'vs prev' heading wraps onto two
 * lines there) so the label column keeps room for the topic name.
 */
const wide = StyleSheet.create({
  views: { width: 72 },
  share: { width: 56 },
  delta: { width: 112 },
});

const narrow = StyleSheet.create({
  views: { width: 56 },
  share: { width: 48 },
  delta: { width: 56 },
});

export type ContentColumns = typeof wide;

export function useContentColumns(): ContentColumns {
  return useAccountLayout().isMobile ? narrow : wide;
}
