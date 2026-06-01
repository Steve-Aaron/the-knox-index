import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Platform, ViewStyle } from 'react-native';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { DevLabel } from '@/components/primitives/DevLabel';
import { accent } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { font } from '@/theme/typography';

/**
 * PrimaryButton
 * --------------
 * Indigo pill button with idle / loading / saved / error states and an
 * optional left-aligned FontAwesome icon. Replaces the bespoke 'Save
 * preferences' button on /preferences, the 'Send link' button in the
 * change-email row, and the 'Save & continue' button in the signup
 * profiling modal.
 *
 * State semantics:
 *   - idle    : default indigo, accepts press
 *   - loading : shows ActivityIndicator, ignores press
 *   - saved   : green flash, intended to auto-revert to idle after ~2s
 *   - error   : red flash, intended to auto-revert to idle after ~3s
 *
 * The consumer owns the state transitions — this just renders them.
 *
 * One job: a single primary CTA button.
 */

export type ButtonState = 'idle' | 'loading' | 'saved' | 'error';

interface Props {
  state?:     ButtonState;
  /** Disable independently of state — e.g. form not valid yet. */
  disabled?:  boolean;
  onPress:    () => void;
  /** Label shown in idle state. State-specific labels are handled internally. */
  label:      string;
  /** Optional override labels for non-idle states. */
  savedLabel?: string;
  errorLabel?: string;
  /** FontAwesome 6 icon name shown left of the label in idle / saved / error. */
  iconName?:  string;
  style?:     ViewStyle | ViewStyle[];
}

export function PrimaryButton({
  state = 'idle',
  disabled = false,
  onPress,
  label,
  savedLabel = 'Saved',
  errorLabel = 'Error — try again',
  iconName,
  style,
}: Props) {
  const loading = state === 'loading';
  const saved   = state === 'saved';
  const errored = state === 'error';

  const displayLabel = errored ? errorLabel : saved ? savedLabel : label;
  const displayIcon  = errored ? 'triangle-exclamation' : saved ? 'check' : iconName;

  return (
    <Pressable
      onPress={onPress}
      disabled={loading || disabled}
      style={({ pressed }) => [
        styles.btn,
        saved   && styles.btnSaved,
        errored && styles.btnError,
        (loading || disabled) && { opacity: 0.65 },
        pressed && state === 'idle' && !disabled && { opacity: 0.88 },
        style,
      ]}
    >
      <DevLabel name="PrimaryButton" />
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <View style={styles.inner}>
          {displayIcon ? (
            <FontAwesome6 name={displayIcon as any} size={13} color="#fff" solid />
          ) : null}
          <Text style={styles.text}>{displayLabel}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor:   accent.indigo,
    borderRadius:      radius.pill,
    paddingVertical:   14,
    paddingHorizontal: spacing.xxl,
    alignItems:        'center',
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  btnSaved: { backgroundColor: '#1a8a4a' },
  btnError: { backgroundColor: '#8a2020' },
  inner:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  text:     { fontFamily: font.bold, fontSize: 16, color: '#fff', letterSpacing: 0.3 },
});
