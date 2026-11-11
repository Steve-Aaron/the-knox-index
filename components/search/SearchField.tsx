import React, { forwardRef, useState } from 'react';
import { TextInput, Pressable, StyleSheet, Platform } from 'react-native';
import { SearchIcon, CloseIcon } from './SearchIcons';
import { neutral, glass, accent, party } from '@/theme/colors';
import { font, weight } from '@/theme/typography';
import { radius } from '@/theme/spacing';

/**
 * SearchField
 * ------------
 * The pill input of the header search. Figma states: Default, Hovered,
 * Active (focused) and Typing (a value is entered — shows the clear button).
 *
 * One job: take the query.
 */
interface Props {
  value:        string;
  placeholder:  string;
  onChangeText: (text: string) => void;
  onFocus:      () => void;
  onClear:      () => void;
  onSubmit:     () => void;
  /** Web key presses — arrows and Escape drive the dropdown. */
  onKey:        (key: string) => void;
  autoFocus?:   boolean;
}

export const SearchField = forwardRef<TextInput, Props>(function SearchField(
  { value, placeholder, onChangeText, onFocus, onClear, onSubmit, onKey, autoFocus },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const active = focused || value.length > 0;

  return (
    <Pressable
      // Pressable only for the web hover state; the TextInput takes the taps.
      accessible={false}
      style={({ hovered }: any) => [
        styles.field,
        hovered && styles.fieldHovered,
        active  && styles.fieldActive,
      ]}
    >
      <SearchIcon color={active ? neutral.text : neutral.textMid} />
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={neutral.textMid}
        selectionColor={party.reform.glow}
        style={styles.input}
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        accessibilityLabel={placeholder}
        onFocus={() => { setFocused(true); onFocus(); }}
        onBlur={() => setFocused(false)}
        onSubmitEditing={onSubmit}
        onKeyPress={e => onKey(e.nativeEvent.key)}
      />
      {value.length > 0 && (
        <Pressable onPress={onClear} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search" style={styles.clear}>
          <CloseIcon color={neutral.textMid} />
        </Pressable>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  field: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    height:            32,
    paddingHorizontal: 14,
    borderRadius:      radius.pill,
    borderWidth:       1,
    borderColor:       glass.border,
    backgroundColor:   glass.fill,
    overflow:          'hidden',
    ...Platform.select({
      web: { transitionProperty: 'border-color, background-color', transitionDuration: '180ms' } as any,
      default: {},
    }),
  },
  fieldHovered: { borderColor: neutral.strokeHi },
  fieldActive: {
    borderColor:     accent.indigo,
    backgroundColor: accent.indigo + '2E',  // 18%
  },
  input: {
    flex:       1,
    minWidth:   0,
    height:     '100%',
    padding:    0,
    fontFamily: font.ui,
    fontWeight: weight.regular,
    fontSize:   14,
    color:      neutral.textDim,
    ...Platform.select({
      web: { outlineStyle: 'none', caretColor: party.reform.glow } as any,
      default: {},
    }),
  },
  clear: {
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
});
