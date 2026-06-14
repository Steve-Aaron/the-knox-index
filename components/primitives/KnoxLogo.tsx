import React, { useId } from 'react';
import { View, StyleSheet, Platform, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path } from 'react-native-svg';

/**
 * KnoxLogo
 * ---------
 * One job: render the Knox wordmark as a sharp gradient SVG at any size.
 *
 * The wordmark is the brand mark of The Knox Index. The native gradient is
 * rebuilt with react-native-svg so it scales crisply on iOS/Android; web
 * uses the same component (RNSVG → DOM) so there's only one source of truth.
 *
 * Width drives the size — height is computed from the wordmark's intrinsic
 * 1338.39 × 269.35 viewBox so it never distorts.
 */

interface Props {
  /** Width in pixels. Height is derived to preserve aspect ratio. */
  width?: number;
  style?: StyleProp<ViewStyle>;
  /** Solid fill colour. Omit to use the Knox gradient (default). */
  color?: string;
}

const VIEW_W = 1338.39;
const VIEW_H = 269.35;
const ASPECT = VIEW_W / VIEW_H;

const LOGO_PATH =
  'M674.49,0l-47.23,269.35h-84.07l.4-2.3-.4.28-98.07-145-25.78,147.02h-84.07L382.49,0h84.07l98.46,144.75L590.41,0h84.07ZM1338.39,0h-112.62l-82,71.6L1087.33,0h-111.9l102.1,129.45-160.2,139.9h113.34l93-81.4,64.2,81.4h111.79l-109.82-139.32L1338.39,0ZM370.29,0h-129.25L112.39,107.89,131.3,0H47.23L0,269.35h84.07l20.54-117.15,101.44,117.15h120.68l-124.86-134.67L370.29,0ZM836.6,269.35h-73.36c-58.84,0-106.54-47.7-106.54-106.54v-15.51C656.69,65.95,722.64,0,803.99,0h86.32c58.08,0,105.16,47.08,105.16,105.16v5.3c0,87.75-71.13,158.88-158.88,158.88ZM910.58,124.2c0-23.05-18.68-41.73-41.73-41.73h-62.57c-37.06,0-67.11,30.04-67.11,67.11h0c0,19.6,15.89,35.49,35.49,35.49h75.05c33.62,0,60.87-27.25,60.87-60.87h0Z';

export function KnoxLogo({ width = 120, style, color }: Props) {
  const height = Math.round(width / ASPECT);
  // Unique gradient id per instance. A shared hardcoded id meant that whenever
  // more than one logo mounted, or the logo re-mounted on navigation, the
  // url(#id) reference could resolve to a since-removed def and the wordmark
  // rendered blank. A per-instance id avoids that collision entirely.
  const gradId = `knoxGrad-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <View style={[styles.wrap, { width, height }, style]}>
      <Svg width={width} height={height} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
        {!color && (
          <Defs>
            <LinearGradient id={gradId} x1="0" y1="134.67" x2={VIEW_W} y2="134.67" gradientUnits="userSpaceOnUse">
              <Stop offset="0"    stopColor="#fea15e" />
              <Stop offset="0.47" stopColor="#df3991" />
              <Stop offset="1"    stopColor="#674a8b" />
            </LinearGradient>
          </Defs>
        )}
        <Path d={LOGO_PATH} fill={color ?? `url(#${gradId})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...Platform.select({ web: { display: 'flex' } as any, default: {} }),
  },
});
