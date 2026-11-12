import React from 'react';
import Svg, { Path } from 'react-native-svg';

/**
 * SearchIcons
 * ------------
 * The header search's glyphs: magnifier, clear (×) and lock. Source artwork
 * lives in assets/icons/ (search.svg, close.svg, lock.svg); paths are inlined
 * so the colour can be set per state.
 *
 * One job: draw the search glyphs.
 */

const SEARCH_PATH = 'M10.7161 5.35806C10.7161 2.40443 8.3117 0 5.35806 0C2.40443 0 0 2.40443 0 5.35806C0 8.3117 2.40443 10.7161 5.35806 10.7161C6.59711 10.7161 7.72901 10.2942 8.63988 9.58423L12.0556 13L13 12.0556L9.58423 8.63988C10.3153 7.70187 10.7135 6.5473 10.7161 5.35806ZM1.33952 5.35806C1.33952 3.14116 3.14116 1.33952 5.35806 1.33952C7.57496 1.33952 9.37661 3.14116 9.37661 5.35806C9.37661 7.57496 7.57496 9.37661 5.35806 9.37661C3.14116 9.37661 1.33952 7.57496 1.33952 5.35806Z';
const CLOSE_PATH  = 'M3 3L7 7M7 7L11 11M7 7L11 3M7 7L3 11';
const LOCK_PATH   = 'M16 19V21M20 15H22C22.5304 15 23.0391 15.2107 23.4142 15.5858C23.7893 15.9609 24 16.4696 24 17V23C24 23.5304 23.7893 24.0391 23.4142 24.4142C23.0391 24.7893 22.5304 25 22 25H10C9.46957 25 8.96086 24.7893 8.58579 24.4142C8.21071 24.0391 8 23.5304 8 23V17C8 16.4696 8.21071 15.9609 8.58579 15.5858C8.96086 15.2107 9.46957 15 10 15H12M20 15H12M20 15V11C20 9.93913 19.5786 8.92172 18.8284 8.17157C18.0783 7.42143 17.0609 7 16 7C14.9391 7 13.9217 7.42143 13.1716 8.17157C12.4214 8.92172 12 9.93913 12 11V15';

export function SearchIcon({ color }: { color: string }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 13 13" fill="none">
      <Path d={SEARCH_PATH} fill={color} />
    </Svg>
  );
}

export function CloseIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <Path d={CLOSE_PATH} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

export function LockIcon({ color }: { color: string }) {
  return (
    <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
      <Path d={LOCK_PATH} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
