import React from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { knox, neutral } from '@/theme/colors';

/**
 * VerifiedBadge
 * --------------
 * X's verified rosette, drawn in the Knox gradient instead of X blue.
 *
 * One job: mark a verified account.
 */
export function VerifiedBadge({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="Verified account">
      <Defs>
        <LinearGradient id="knoxVerified" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={knox.primaryOrange} />
          <Stop offset="0.5" stopColor={knox.primaryPink} />
          <Stop offset="1" stopColor={knox.accentPurple} />
        </LinearGradient>
      </Defs>
      <Path
        fill="url(#knoxVerified)"
        d="M12 1.5l2.6 1.9 3.2-.2 1 3 2.6 1.9-1 3.1 1 3.1-2.6 1.9-1 3-3.2-.2L12 22.5l-2.6-1.9-3.2.2-1-3L2.6 15.9l1-3.1-1-3.1 2.6-1.9 1-3 3.2.2z"
      />
      <Path d="M7.5 12.2l3 3 6-6.2" fill="none" stroke={neutral.felt} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
