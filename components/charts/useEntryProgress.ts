import { useLayoutEffect } from 'react';
import {
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type EasingFunction,
  type SharedValue,
} from 'react-native-reanimated';

/**
 * Entry animation progress for the charts, 0 → 1. Holds at 0 until `play`
 * (the chart is in view), then replays whenever `trigger` (the data) changes.
 * Resets before paint, so new data never flashes fully drawn. With reduced
 * motion it jumps straight to 1.
 *
 * One job: drive a chart's draw-in.
 */
interface Timing {
  duration: number;
  easing:   EasingFunction;
  delay?:   number;
}

export function useEntryProgress(play: boolean, trigger: string, { duration, easing, delay = 0 }: Timing): SharedValue<number> {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    if (!play) return;
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withDelay(delay, withTiming(1, { duration, easing }));
  }, [play, trigger, reduceMotion, duration, easing, delay, progress]);

  return progress;
}
