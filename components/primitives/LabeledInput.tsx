import React from 'react';
import {
  View, Text, TextInput, StyleSheet, Platform,
  TextInputProps, ViewStyle, TextStyle,
} from 'react-native';
import { DevLabel } from '@/components/primitives/DevLabel';
import { neutral, glass } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { font } from '@/theme/typography';

/**
 * LabeledInput
 * -------------
 * TextInput with a small uppercase-style label above it and consistent dark-
 * glass styling. The bog-standard input shape used across /preferences and
 * the signup ProfilingModal — extracted so all of them share padding, focus
 * treatment, font, and outline override in one place.
 *
 * Pass any extra TextInput prop through `inputProps` — the wrapper doesn't
 * try to enumerate them.
 *
 * One job: a labelled, dark-glass single-line input.
 */

interface Props {
  label:        string;
  value:        string;
  onChange:     (next: string) => void;
  placeholder?: string;
  /** Catch-all for the underlying TextInput — autoCapitalize, keyboardType, etc. */
  inputProps?:  Omit<TextInputProps, 'value' | 'onChangeText' | 'placeholder' | 'style'>;
  /** Override the outer wrap (e.g. flex: 1 inside a row). */
  wrapStyle?:   ViewStyle;
  /** Override the input styling — usually for tighter padding inside modals. */
  inputStyle?:  TextStyle;
}

export function LabeledInput({
  label, value, onChange, placeholder, inputProps, wrapStyle, inputStyle,
}: Props) {
  return (
    <View style={[styles.wrap, wrapStyle]}>
      <DevLabel name="LabeledInput" />
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, inputStyle]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={neutral.textDim}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="next"
        {...inputProps}
        {...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 4,
  },
  label: {
    fontFamily:    font.bold,
    fontSize:      12,
    color:         neutral.textMid,
    marginBottom:  spacing.xs,
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor:   'rgba(255,255,255,0.05)',
    borderWidth:       1,
    borderColor:       glass.border,
    borderRadius:      radius.md,
    color:             neutral.text,
    fontFamily:        font.ui,
    fontSize:          16,
    paddingHorizontal: spacing.md,
    paddingVertical:   12,
  },
});
