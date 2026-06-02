import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
  TextStyle,
  ViewStyle,
  TextInputProps,
} from 'react-native';
import { neutral, glass } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { font } from '@/theme/typography';
import { DevLabel } from '@/components/primitives/DevLabel';

/**
 * PrefixedInput
 * --------------
 * Generic 'fixed-prefix + editable suffix' input.
 *
 *   ┌──────────────────────────────┬─────────────────────────┐
 *   │ https://www.linkedin.com/in/ │ janesmith               │
 *   └──────────────────────────────┴─────────────────────────┘
 *      prefix wrap (static text)     TextInput (handle only)
 *
 * Variants like LinkedinInput wrap this primitive with their own preset
 * prefix and sanitiser. Add new variants alongside, don't bloat this one.
 *
 * Props:
 *   prefix    — the static left-hand text (e.g. 'https://www.linkedin.com/in/').
 *   value     — current handle / suffix string.
 *   onChange  — receives the sanitised value on every keystroke / paste.
 *   sanitize  — optional. Runs on every change BEFORE onChange fires; lets a
 *               variant strip a pasted full URL down to just the handle.
 *
 * One job: render a two-zone input that looks and behaves like a single field.
 */

export interface PrefixedInputProps {
  prefix:        string;
  value:         string;
  onChange:      (next: string) => void;
  sanitize?:     (raw: string) => string;
  placeholder?:  string;
  autoFocus?:    boolean;
  keyboardType?: TextInputProps['keyboardType'];
  /** Override the inner input's padding / font etc. — joined-look props are enforced. */
  inputStyle?:   TextStyle;
  /** Override the outer row, e.g. to switch border colour for focus states. */
  rowStyle?:     ViewStyle;
}

export function PrefixedInput({
  prefix,
  value,
  onChange,
  sanitize,
  placeholder,
  autoFocus,
  keyboardType = 'url',
  inputStyle,
  rowStyle,
}: PrefixedInputProps) {
  const handleChange = (text: string) => {
    onChange(sanitize ? sanitize(text) : text);
  };

  return (
    <View style={[styles.row, rowStyle]}>
      <DevLabel name="PrefixedInput" />
      <View style={styles.prefixWrap}>
        <Text
          style={styles.prefix}
          numberOfLines={1}
          ellipsizeMode="head"
          // Static prefix — never selectable. selectable={false} disables RN
          // text selection on native; userSelect/cursor in the style handles web.
          selectable={false}
        >
          {prefix}
        </Text>
      </View>
      <TextInput
        style={[styles.input, inputStyle, styles.inputJoined]}
        value={value}
        onChangeText={handleChange}
        placeholder={placeholder}
        placeholderTextColor={neutral.textDim}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={keyboardType}
        returnKeyType="next"
        autoFocus={autoFocus}
        {...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Outer row carries the visible border; both children flatten their corners
  // against the divider so the whole thing reads as one continuous field.
  // flexShrink + maxWidth on the prefix wrap keep the input usable on narrow
  // columns — the prefix ellipsises from the head ('…linkedin.com/in/') first.
  row: {
    flexDirection:   'row',
    alignItems:      'stretch',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth:     1,
    borderColor:     glass.border,
    borderRadius:    radius.md,
    overflow:        'hidden',
  },
  prefixWrap: {
    justifyContent:    'center',
    paddingHorizontal: spacing.sm,
    // Solid dark fill so the prefix reads as a distinct, non-editable chip
    // attached to the input — improves contrast and signals 'don't type here'.
    backgroundColor:   '#1F1F1F',
    borderRightWidth:  1,
    borderRightColor:  glass.border,
    flexShrink:        1,
    maxWidth:          '60%' as any,
    // Make the whole prefix area visibly non-interactive on web — the default
    // cursor (not the text I-beam) signals 'you can't put a caret here'.
    ...Platform.select({
      web: {
        cursor:     'default',
        userSelect: 'none',
      } as any,
      default: {},
    }),
  },
  prefix: {
    fontFamily: font.mono,
    fontSize:   13,
    color:      neutral.textDim,
    // Belt-and-braces: also disable user-select on the inner Text so highlight-
    // drag from inside the prefix glyph itself is suppressed on web.
    ...Platform.select({
      web: {
        userSelect:        'none',
        WebkitUserSelect:  'none',
        cursor:            'default',
      } as any,
      default: {},
    }),
  },
  // Default input look — consumer can override paddings via inputStyle.
  input: {
    color:             neutral.text,
    fontFamily:        font.ui,
    fontSize:          16,
    paddingHorizontal: spacing.md,
    paddingVertical:   12,
  },
  // Mandatory joined-look props — always win over any inputStyle override.
  inputJoined: {
    flex:            1,
    minWidth:        0 as any,
    borderWidth:     0,
    borderRadius:    0,
    backgroundColor: 'transparent',
  },
});
