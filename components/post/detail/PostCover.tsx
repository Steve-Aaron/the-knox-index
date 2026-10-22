import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ShimmerImage } from '@/components/primitives/ShimmerImage';
import { formatters } from '@/components/primitives/CountUp';
import { neutral } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { font } from '@/theme/typography';

/**
 * PostCover
 * ----------
 * 9:16 cover thumbnail with a 'views' badge in the corner. Fixed size beside
 * the detail column, or full width when the detail is stacked (compact).
 *
 * One job: show a post's cover.
 */
interface Props {
  uri?:         string;
  views:        number;
  accentColour: string;
  /** Detail height; the cover is height × 9/16 wide. Ignored when compact. */
  width:        number;
  height:       number;
  compact?:     boolean;
}

export function PostCover({ uri, views, accentColour, width, height, compact = false }: Props) {
  const size = compact ? styles.coverCompact : { width, height };

  return (
    <View style={compact ? styles.wrapCompact : [styles.wrap, { width }]}>
      <ShimmerImage
        uri={uri || undefined}
        wrapStyle={size}
        resizeMode="cover"
        accentColour={accentColour}
        fallback={
          <View style={[size, styles.fallback]}>
            <Text style={styles.playIcon}>▶</Text>
          </View>
        }
      />
      <View style={styles.viewsBadge}>
        <Text style={styles.viewsNum}>{formatters.compact(views)}</Text>
        <Text style={styles.viewsLbl}> views</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexShrink: 0,
    position: 'relative',
    backgroundColor: '#111',
    overflow: 'hidden',
  },
  // Compact cover — 9:16 portrait at full width, matching the desktop ratio.
  wrapCompact: {
    width: '100%' as any,
    aspectRatio: 9 / 16,
    position: 'relative' as const,
    backgroundColor: '#111',
    overflow: 'hidden',
  },
  coverCompact: {
    width: '100%' as any,
    height: '100%' as any,
  },
  fallback: {
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: { fontSize: 24, color: neutral.textDim },
  viewsBadge: {
    position: 'absolute',
    bottom: spacing.xs,
    left: spacing.xs,
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  viewsNum: {
    fontFamily: font.mono,
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  viewsLbl: { fontFamily: font.ui, fontSize: 12, color: neutral.textMid, textTransform: 'none' },
});
