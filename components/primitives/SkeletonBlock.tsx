import React from 'react';
import { ViewStyle } from 'react-native';
import { MotiView } from 'moti';
import { Easing } from 'react-native-reanimated';

/**
 * SkeletonBlock
 * -------------
 * A pulsing placeholder rectangle used during loading states.
 * Drop it in wherever real content will eventually appear.
 * One job: communicate "data is on its way".
 */
interface Props {
  width?:        number | string;
  height:        number;
  borderRadius?: number;
  style?:        ViewStyle;
}

export function SkeletonBlock({ width = '100%', height, borderRadius = 6, style }: Props) {
  return (
    <MotiView
      from={{ opacity: 0.25 }}
      animate={{ opacity: 0.6 }}
      transition={{
        type: 'timing',
        duration: 850,
        easing: Easing.inOut(Easing.ease),
        loop: true,
        repeatReverse: true,
      }}
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: 'rgba(255, 255, 255, 0.09)',
        },
        style,
      ]}
    />
  );
}
