import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { PAGE_MAX_WIDTH } from '@/theme/layoutTokens';

/**
 * PageContainer
 * --------------
 * Caps a page's content at PAGE_MAX_WIDTH and centres it, so wide viewports
 * get side margins instead of stretched widgets.
 *
 * `inset` is for pages whose sections pad themselves horizontally (the
 * dashboard): the cap grows by that padding on each side, so the content
 * inside still tops out at exactly PAGE_MAX_WIDTH.
 *
 * One job: the standard width of a page.
 */
interface Props {
  /** Horizontal padding the children apply themselves, per side. */
  inset?:   number;
  style?:   StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export function PageContainer({ inset = 0, style, children }: Props) {
  return (
    <View style={[styles.page, { maxWidth: PAGE_MAX_WIDTH + inset * 2 }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    width:     '100%',
    alignSelf: 'center',
  },
});
