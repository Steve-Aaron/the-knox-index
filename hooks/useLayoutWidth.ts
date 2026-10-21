import { useCallback, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

/**
 * useLayoutWidth
 * ---------------
 * Measures a View's rendered width so SVG charts can size themselves to a
 * percentage-width container. Returns 0 until the first layout pass.
 *
 *   const [width, onLayout] = useLayoutWidth();
 *   <View onLayout={onLayout}>{width > 0 && <Chart size={width} />}</View>
 */
export function useLayoutWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.width);
    setWidth(prev => (prev === next ? prev : next));
  }, []);
  return [width, onLayout];
}
