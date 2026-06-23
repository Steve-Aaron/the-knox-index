import React, { useCallback } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { MotiView } from 'moti';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { DevLabel } from '@/components/primitives/DevLabel';
import { neutral, glass, accent } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { type, font } from '@/theme/typography';
import {
  FIELD_META, FIELD_OPTIONS, opsForField, defaultOpForField, newRule,
  type Rule, type FieldId, type AnyOp,
} from '@/lib/advancedFilters';

/**
 * AdvancedFilterPanel
 * --------------------
 * Toggleable advanced filter UI for the Post Feed. Each row is a single
 * rule (field + operator + value). Multiple rules combine with AND.
 *
 * The parent owns the rule list state via `rules` / `onChange` so the
 * filter logic stays where the data lives (PostsTable). This panel is
 * pure UI — no business logic beyond formatting the dropdowns.
 *
 * One job: let the user build rules.
 */

interface Props {
  /** Hidden by default; PostsTable toggles via magnifying-glass button. */
  visible:   boolean;
  rules:     Rule[];
  onChange:  (next: Rule[]) => void;
  onClose?:  () => void;
}

export function AdvancedFilterPanel({ visible, rules, onChange, onClose }: Props) {
  const addRule = useCallback(() => {
    onChange([...rules, newRule()]);
  }, [rules, onChange]);

  const updateRule = useCallback((id: string, patch: Partial<Rule>) => {
    onChange(rules.map(r => (r.id === id ? { ...r, ...patch } : r)));
  }, [rules, onChange]);

  const removeRule = useCallback((id: string) => {
    onChange(rules.filter(r => r.id !== id));
  }, [rules, onChange]);

  const clearAll = useCallback(() => onChange([]), [onChange]);

  if (!visible) return null;

  return (
    <MotiView
      from={{ opacity: 0, translateY: -8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 220 }}
      style={styles.wrap}
    >
      <DevLabel name="AdvancedFilterPanel" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <FontAwesome6 name="filter" size={11} color={accent.indigo} solid />
          <Text style={styles.title}>ADVANCED FILTER</Text>
          {rules.length > 0 && (
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>{rules.length}</Text>
            </View>
          )}
        </View>
        {onClose ? (
          <Pressable onPress={onClose} style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}>
            <Text style={styles.closeBtnText}>×</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Description */}
      {rules.length === 0 && (
        <Text style={styles.emptyHint}>
          Build a filter by picking a field, an operator, then typing the value.
          Multiple rules combine with AND.
        </Text>
      )}

      {/* Rule rows */}
      <View style={styles.rules}>
        {rules.map((rule, i) => (
          <FilterRow
            key={rule.id}
            rule={rule}
            isFirst={i === 0}
            onUpdate={patch => updateRule(rule.id, patch)}
            onRemove={() => removeRule(rule.id)}
          />
        ))}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          onPress={addRule}
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
        >
          <FontAwesome6 name="plus" size={10} color={accent.indigo} solid />
          <Text style={styles.addBtnText}>Add filter row</Text>
        </Pressable>

        {rules.length > 0 && (
          <Pressable
            onPress={clearAll}
            style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.clearBtnText}>Clear all</Text>
          </Pressable>
        )}
      </View>
    </MotiView>
  );
}

// ── FilterRow ──────────────────────────────────────────────────────────────────

interface RowProps {
  rule:     Rule;
  isFirst:  boolean;
  onUpdate: (patch: Partial<Rule>) => void;
  onRemove: () => void;
}

function FilterRow({ rule, isFirst, onUpdate, onRemove }: RowProps) {
  const fieldType = FIELD_META[rule.field].type;
  const ops       = opsForField(rule.field);
  const needsTwo  = rule.op === 'between';

  const handleFieldChange = (next: FieldId) => {
    // When switching field, reset op to the default for the new type so we
    // never end up with e.g. a string field paired with a numeric operator.
    onUpdate({ field: next, op: defaultOpForField(next), value: '', value2: '' });
  };

  return (
    <View style={rowStyles.row}>
      {/* AND label for rows after the first */}
      {!isFirst && <Text style={rowStyles.andLabel}>AND</Text>}

      <View style={rowStyles.controls}>
        {/* Field dropdown */}
        <SimplePicker
          value={rule.field}
          options={FIELD_OPTIONS.map(f => ({ id: f.id, label: f.label }))}
          onChange={v => handleFieldChange(v as FieldId)}
          width={140}
        />

        {/* Operator dropdown */}
        <SimplePicker
          value={rule.op}
          options={ops.map(o => ({ id: o.id, label: o.label }))}
          onChange={v => onUpdate({ op: v as AnyOp })}
          width={120}
        />

        {/* Value input(s) */}
        <TextInput
          value={rule.value}
          onChangeText={v => onUpdate({ value: v })}
          placeholder={placeholderFor(fieldType, rule.op)}
          placeholderTextColor={neutral.textDim}
          style={[rowStyles.input, { flex: 1 }]}
          keyboardType={fieldType === 'number' ? 'numeric' : 'default'}
          autoCapitalize="none"
          autoCorrect={false}
          {...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} })}
        />

        {needsTwo && (
          <>
            <Text style={rowStyles.andSmall}>and</Text>
            <TextInput
              value={rule.value2 ?? ''}
              onChangeText={v => onUpdate({ value2: v })}
              placeholder={placeholderFor(fieldType)}
              placeholderTextColor={neutral.textDim}
              style={[rowStyles.input, { flex: 1 }]}
              keyboardType={fieldType === 'number' ? 'numeric' : 'default'}
              autoCapitalize="none"
              autoCorrect={false}
              {...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} })}
            />
          </>
        )}

        {/* Remove button */}
        <Pressable onPress={onRemove} style={({ pressed }) => [rowStyles.removeBtn, pressed && { opacity: 0.7 }]}>
          <FontAwesome6 name="xmark" size={12} color={neutral.textDim} solid />
        </Pressable>
      </View>
    </View>
  );
}

function placeholderFor(type: 'string' | 'number' | 'date', op?: AnyOp): string {
  if (type === 'number') return '0';
  if (type === 'date')   return 'YYYY-MM-DD';
  if (op === 'matches')  return 'regex e.g. ^lab|reform$';
  return 'value...';
}

// ── SimplePicker — minimal native-feeling dropdown ────────────────────────────
// RN doesn't ship a built-in <select> primitive, so we use a Pressable that
// cycles through options on each press. Adequate for this small set of
// options (<12 fields, <6 operators). For a larger field set, swap for a
// proper popover-driven picker.

interface PickerOption { id: string; label: string }
interface PickerProps {
  value:    string;
  options:  PickerOption[];
  onChange: (next: string) => void;
  width?:   number;
}

function SimplePicker({ value, options, onChange, width }: PickerProps) {
  // On web, use a real <select> element for proper dropdown UX.
  if (Platform.OS === 'web') {
    return (
      <View style={[rowStyles.pickerWrap, width ? { width } : null]}>
        {React.createElement('select' as any, {
          value,
          onChange: (e: any) => onChange(e.target.value),
          style: webSelectStyle,
        }, options.map(o => React.createElement('option' as any, { key: o.id, value: o.id }, o.label)))}
      </View>
    );
  }

  // Native fallback — cycle through options on press.
  const idx = options.findIndex(o => o.id === value);
  const cycle = () => {
    const next = options[(idx + 1) % options.length];
    onChange(next.id);
  };
  const label = options[idx]?.label ?? value;
  return (
    <Pressable onPress={cycle} style={[rowStyles.picker, width ? { width } : null]}>
      <Text style={rowStyles.pickerText} numberOfLines={1}>{label}</Text>
      <FontAwesome6 name="chevron-down" size={9} color={neutral.textDim} solid />
    </Pressable>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const webSelectStyle: any = {
  width:            '100%',
  height:           32,
  backgroundColor:  'rgba(255,255,255,0.05)',
  border:           `1px solid ${glass.border}`,
  borderRadius:     6,
  color:            neutral.text,
  fontFamily:       font.ui,
  fontSize:         13,
  padding:          '0 8px',
  cursor:           'pointer',
  outline:          'none',
};

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: 'rgba(124,131,255,0.06)',
    borderWidth:     1,
    borderColor:     accent.indigo + '40',
    borderRadius:    radius.md,
    padding:         spacing.md,
    gap:             spacing.sm,
    marginTop:       spacing.xs,
  },
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  title: {
    fontFamily:    font.bold,
    fontSize:      10,
    color:         accent.indigo,
    letterSpacing: 1.5,
  },
  countPill: {
    backgroundColor:   accent.indigo,
    paddingHorizontal: 6,
    paddingVertical:   1,
    borderRadius:      radius.pill,
  },
  countPillText: {
    fontFamily: font.bold,
    fontSize:   10,
    color:      '#fff',
  },
  closeBtn: {
    width:           24,
    height:          24,
    alignItems:      'center',
    justifyContent:  'center',
    borderRadius:    12,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  closeBtnText: {
    fontFamily: font.bold,
    fontSize:   18,
    color:      neutral.textDim,
    lineHeight: 18,
  },
  emptyHint: {
    fontFamily: font.ui,
    fontSize:   12,
    color:      neutral.textDim,
    lineHeight: 16,
  },
  rules: {
    gap: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap:           spacing.sm,
    marginTop:     spacing.xs,
  },
  addBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: spacing.md,
    paddingVertical:   6,
    borderRadius:      radius.pill,
    borderWidth:       1,
    borderColor:       accent.indigo + '50',
    backgroundColor:   accent.indigo + '15',
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  addBtnText: {
    fontFamily:    font.bold,
    fontSize:      11,
    color:         accent.indigo,
    letterSpacing: 0.3,
  },
  clearBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical:   6,
    borderRadius:      radius.pill,
    borderWidth:       1,
    borderColor:       glass.border,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  clearBtnText: {
    fontFamily: font.bold,
    fontSize:   11,
    color:      neutral.textDim,
  },
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'column',
    gap:           4,
  },
  andLabel: {
    fontFamily:    font.bold,
    fontSize:      9,
    color:         neutral.textDim,
    letterSpacing: 1.4,
    marginLeft:    spacing.xs,
  },
  controls: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    flexWrap:      'wrap',
  },
  pickerWrap: {},
  picker: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    paddingHorizontal: 8,
    height:            32,
    backgroundColor:  'rgba(255,255,255,0.05)',
    borderWidth:      1,
    borderColor:      glass.border,
    borderRadius:     6,
    gap:              6,
  },
  pickerText: {
    fontFamily: font.ui,
    fontSize:   13,
    color:      neutral.text,
  },
  input: {
    minWidth:          80,
    height:            32,
    backgroundColor:  'rgba(255,255,255,0.05)',
    borderWidth:      1,
    borderColor:      glass.border,
    borderRadius:     6,
    color:            neutral.text,
    fontFamily:       font.ui,
    fontSize:         13,
    paddingHorizontal: 8,
  },
  andSmall: {
    fontFamily: font.ui,
    fontSize:   11,
    color:      neutral.textDim,
  },
  removeBtn: {
    width:           28,
    height:          28,
    alignItems:      'center',
    justifyContent:  'center',
    borderRadius:    14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth:     1,
    borderColor:     glass.border,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
});
