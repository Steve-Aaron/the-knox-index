/**
 * Title
 * ------
 * Canonical heading text. Pulls from `type.title` (Figtree / bold / 24px /
 * -0.4 letterSpacing). Used as the section heading that typically sits
 * directly below a <Kicker>.
 *
 * Replaces every per-screen `styles.title` redefinition.
 *
 * Usage:
 *   <Title>Daily brief</Title>
 *   <Title tone='dim'>Settings</Title>
 *   <Title size='display'>Knox Index</Title>
 */
import React from 'react';
import { StyleSheet, Text, type TextStyle, type TextProps } from 'react-native';

import { neutral } from '../../theme/colors';
import { type as typeTokens } from '../../theme/typography';

type TitleTone = 'default' | 'dim';
type TitleSize = 'display' | 'title';

type TitleProps = Omit<TextProps, 'children'> & {
  children: React.ReactNode;
  /**
   * Visual tone.
   *  - default: brand white text (neutral.text)
   *  - dim:     muted secondary text (neutral.textMid)
   */
  tone?: TitleTone;
  /**
   * Type ramp size.
   *  - title:   default heading size (24px)
   *  - display: hero size (44px)
   */
  size?: TitleSize;
  style?: TextStyle | TextStyle[];
};

const styles = StyleSheet.create({
  title:    typeTokens.title,
  display:  typeTokens.display,
  default:  { color: neutral.text },
  dim:      { color: neutral.textMid },
});

export function Title({ children, tone = 'default', size = 'title', style, ...rest }: TitleProps) {
  const sizeStyle = size === 'display' ? styles.display : styles.title;
  const toneStyle = tone === 'dim' ? styles.dim : styles.default;
  return (
    <Text {...rest} style={[sizeStyle, toneStyle, style]}>
      {children}
    </Text>
  );
}

export default Title;
