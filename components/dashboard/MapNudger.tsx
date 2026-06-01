import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { DevLabel } from '@/components/primitives/DevLabel';
import { UkMapSvg } from './UkMapSvg';
import { UK_MARKER_LOCATIONS } from '@/lib/uk-locations';
import type { UkLocation } from '@/lib/uk-locations';
import { neutral, glass, accent, knox } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { font } from '@/theme/typography';

/**
 * MapNudger
 * ----------
 * Dev tool for fine-tuning city marker positions on the UK map. Unlike the
 * earlier click-to-position calibrator, this one starts from the existing
 * UK_MARKER_LOCATIONS array and lets you NUDGE each city by ±1, ±5, or ±20
 * pixels in any direction. Better suited when the relative positions are
 * already roughly right but individual cities need to drift a few pixels.
 *
 * Workflow:
 *   1. The map renders in a square box on the left, dots in current positions.
 *   2. Pick a city in the right-hand list (its dot turns indigo on the map).
 *   3. Adjust the step size (1 / 5 / 20 px).
 *   4. Click an arrow button OR press an arrow key — the dot moves by step.
 *   5. Repeat for every city that needs tuning.
 *   6. Click 'Copy as TypeScript' to grab the updated array.
 *
 * One job: visually align city dots without rewriting code each iteration.
 *
 * Dev only. Mounted from /map-debug, not linked from the main nav.
 */

const STEP_SIZES = [1, 5, 20] as const;
type StepSize = typeof STEP_SIZES[number];

export function MapNudger() {
  const [locations,  setLocations]  = useState<UkLocation[]>(UK_MARKER_LOCATIONS);
  const [selectedId, setSelectedId] = useState<string>(UK_MARKER_LOCATIONS[0].id);
  const [stepSize,   setStepSize]   = useState<StepSize>(5);
  const [copied,     setCopied]     = useState(false);

  const selected = locations.find(l => l.id === selectedId);

  // Nudge the currently selected city by (dx, dy) in viewBox units.
  const nudge = useCallback((dx: number, dy: number) => {
    setLocations(prev => prev.map(loc =>
      loc.id === selectedId ? { ...loc, x: loc.x + dx, y: loc.y + dy } : loc
    ));
  }, [selectedId]);

  // Keyboard arrows on web — faster than clicking buttons for every city.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault();
      const dx = e.key === 'ArrowLeft' ? -stepSize : e.key === 'ArrowRight' ? stepSize : 0;
      const dy = e.key === 'ArrowUp'   ? -stepSize : e.key === 'ArrowDown'  ? stepSize : 0;
      nudge(dx, dy);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [nudge, stepSize]);

  const reset = useCallback(() => {
    setLocations(UK_MARKER_LOCATIONS);
  }, []);

  const generateTs = useCallback(() => {
    const indent = '  ';
    const lines = locations.map(l =>
      `${indent}{ id: ${JSON.stringify(l.id)}, name: ${JSON.stringify(l.name)}, x: ${l.x}, y: ${l.y} },`
    );
    return `export const UK_MARKER_LOCATIONS: UkLocation[] = [\n${lines.join('\n')}\n];`;
  }, [locations]);

  const handleCopy = useCallback(() => {
    if (Platform.OS !== 'web') return;
    navigator.clipboard.writeText(generateTs()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [generateTs]);

  return (
    <View style={styles.root}>
      <DevLabel name="MapNudger" />

      {/* ── Map column ────────────────────────────────────────────── */}
      <View style={styles.mapCol}>
        <View style={styles.mapBox}>
          <UkMapSvg />

          {/* City dots — selected one is bigger and indigo. */}
          {locations.map(loc => {
            const isSelected = loc.id === selectedId;
            return (
              <Pressable
                key={loc.id}
                onPress={() => setSelectedId(loc.id)}
                pointerEvents="auto"
                style={{
                  position: 'absolute',
                  left:     `${(loc.x / 1024) * 100}%` as any,
                  top:      `${(loc.y / 1024) * 100}%` as any,
                }}
              >
                <View style={[styles.dotAnchor, isSelected && styles.dotAnchorSelected]}>
                  <View style={[styles.dot, isSelected && styles.dotSelected]} />
                </View>
                <Text style={[styles.dotLabel, isSelected && styles.dotLabelSelected]} numberOfLines={1}>
                  {loc.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Selected city + nudge pad sits under the map for thumb-friendly use. */}
        <View style={styles.padWrap}>
          <View style={styles.padHeader}>
            <Text style={styles.padCity} numberOfLines={1}>
              {selected ? selected.name : 'Pick a city →'}
            </Text>
            {selected && (
              <Text style={styles.padCoords}>
                x: <Text style={styles.padCoordValue}>{selected.x}</Text>
                {'  '}y: <Text style={styles.padCoordValue}>{selected.y}</Text>
              </Text>
            )}
          </View>

          {/* Step-size selector */}
          <View style={styles.stepRow}>
            <Text style={styles.stepLabel}>STEP</Text>
            {STEP_SIZES.map(size => (
              <Pressable
                key={size}
                onPress={() => setStepSize(size)}
                style={({ pressed }) => [
                  styles.stepBtn,
                  size === stepSize && styles.stepBtnActive,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={[styles.stepBtnText, size === stepSize && styles.stepBtnTextActive]}>
                  {size}px
                </Text>
              </Pressable>
            ))}
          </View>

          {/* + layout for arrows: up top, left/right middle, down bottom. */}
          <View style={styles.dpadRow}>
            <View style={styles.dpadCell} />
            <NudgeButton icon="arrow-up" onPress={() => nudge(0, -stepSize)} />
            <View style={styles.dpadCell} />
          </View>
          <View style={styles.dpadRow}>
            <NudgeButton icon="arrow-left"  onPress={() => nudge(-stepSize, 0)} />
            <View style={styles.dpadCell} />
            <NudgeButton icon="arrow-right" onPress={() => nudge(stepSize, 0)} />
          </View>
          <View style={styles.dpadRow}>
            <View style={styles.dpadCell} />
            <NudgeButton icon="arrow-down" onPress={() => nudge(0, stepSize)} />
            <View style={styles.dpadCell} />
          </View>

          {Platform.OS === 'web' && (
            <Text style={styles.keyboardHint}>
              Or use ← → ↑ ↓ on the keyboard
            </Text>
          )}
        </View>
      </View>

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <View style={styles.sidebar}>
        <Text style={styles.kicker}>MAP NUDGER</Text>
        <Text style={styles.title}>Tune each city by pixel steps</Text>
        <Text style={styles.copy}>
          Pick a city, choose a step size, then arrow it into place. When all
          dots sit right, hit Copy and paste the result over{' '}
          <Text style={styles.code}>UK_MARKER_LOCATIONS</Text>.
        </Text>

        <Text style={styles.sectionKicker}>CITIES</Text>
        <ScrollView style={styles.cityList} contentContainerStyle={styles.cityListInner}>
          {locations.map(loc => {
            const isSelected = loc.id === selectedId;
            const original   = UK_MARKER_LOCATIONS.find(o => o.id === loc.id);
            const dirty      = original && (original.x !== loc.x || original.y !== loc.y);
            return (
              <Pressable
                key={loc.id}
                onPress={() => setSelectedId(loc.id)}
                style={({ pressed }) => [
                  styles.cityRow,
                  isSelected && styles.cityRowSelected,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={[styles.cityIndexText, isSelected && { color: accent.indigo }]}>
                  {isSelected ? '◉' : '○'}
                </Text>
                <Text style={[styles.cityName, isSelected && styles.cityNameSelected]} numberOfLines={1}>
                  {loc.name}
                </Text>
                {dirty && <View style={styles.dirtyDot} />}
                <Text style={styles.cityCoords} numberOfLines={1}>
                  {loc.x},{loc.y}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.actionRow}>
          <Pressable
            onPress={reset}
            style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.secondaryBtnText}>Reset all</Text>
          </Pressable>
          <Pressable
            onPress={handleCopy}
            style={({ pressed }) => [
              styles.copyBtn,
              copied && styles.copyBtnSaved,
              pressed && { opacity: 0.88 },
            ]}
          >
            <Text style={styles.copyBtnText}>
              {copied ? '✓ Copied' : 'Copy as TypeScript'}
            </Text>
          </Pressable>
        </View>

        <ScrollView style={styles.previewBox} contentContainerStyle={{ padding: spacing.md }}>
          <Text style={styles.previewText} selectable>
            {generateTs()}
          </Text>
        </ScrollView>
      </View>
    </View>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

interface NudgeButtonProps {
  icon:    string;
  onPress: () => void;
}

function NudgeButton({ icon, onPress }: NudgeButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.nudgeBtn,
        pressed && styles.nudgeBtnPressed,
      ]}
    >
      <FontAwesome6 name={icon as any} size={18} color={neutral.text} solid />
    </Pressable>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex:           1,
    flexDirection:  'row',
    gap:            spacing.xl,
    padding:        spacing.xl,
    backgroundColor: '#0D0D1C',
  },

  // ── Map column ───────────────────────────────────────────────────────────
  mapCol: { flex: 1, gap: spacing.md, maxWidth: 900 },
  mapBox: {
    aspectRatio:     1,
    width:           '100%',
    position:        'relative',
    borderWidth:     1,
    borderColor:     glass.border,
    borderRadius:    radius.lg,
    overflow:        'hidden',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },

  // Dots — bigger touch target than visual dot so they're easier to click.
  dotAnchor: {
    position:       'absolute',
    width:          14,
    height:         14,
    transform:      [{ translateX: -7 }, { translateY: -7 }],
    alignItems:     'center',
    justifyContent: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  dotAnchorSelected: {
    width:  18,
    height: 18,
    transform: [{ translateX: -9 }, { translateY: -9 }],
  },
  dot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: knox.primaryPink,
    borderWidth:     1,
    borderColor:     '#fff',
  },
  dotSelected: {
    width:           12,
    height:          12,
    borderRadius:    6,
    backgroundColor: accent.indigo,
  },
  dotLabel: {
    position:          'absolute',
    left:              12,
    top:               2,
    fontFamily:        font.bold,
    fontSize:          10,
    color:             neutral.text,
    backgroundColor:   'rgba(0,0,0,0.55)',
    paddingHorizontal: 4,
    paddingVertical:   1,
    borderRadius:      3,
  },
  dotLabelSelected: {
    color:           '#fff',
    backgroundColor: accent.indigo,
  },

  // ── Nudge pad ────────────────────────────────────────────────────────────
  padWrap: {
    gap:             spacing.sm,
    padding:         spacing.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius:    radius.md,
    borderWidth:     1,
    borderColor:     glass.border,
  },
  padHeader: {
    flexDirection:   'row',
    alignItems:      'baseline',
    justifyContent:  'space-between',
  },
  padCity: {
    fontFamily: font.bold,
    fontSize:   16,
    color:      neutral.text,
  },
  padCoords: {
    fontFamily: font.mono,
    fontSize:   13,
    color:      neutral.textMid,
  },
  padCoordValue: {
    fontFamily: font.bold,
    color:      accent.indigo,
  },

  stepRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  stepLabel: {
    fontFamily:    font.bold,
    fontSize:      10,
    color:         neutral.textDim,
    letterSpacing: 1.4,
    marginRight:   spacing.xs,
  },
  stepBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical:   6,
    borderRadius:      radius.sm,
    borderWidth:       1,
    borderColor:       glass.border,
    backgroundColor:   'rgba(255,255,255,0.04)',
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  stepBtnActive: {
    backgroundColor: accent.indigo,
    borderColor:     accent.indigo,
  },
  stepBtnText:       { fontFamily: font.mono, fontSize: 12, color: neutral.textMid },
  stepBtnTextActive: { color: '#fff', fontFamily: font.bold },

  dpadRow: {
    flexDirection: 'row',
    gap:           spacing.xs,
    alignSelf:     'center',
  },
  dpadCell: { width: 44, height: 44 },
  nudgeBtn: {
    width:           44,
    height:          44,
    alignItems:      'center',
    justifyContent:  'center',
    borderRadius:    radius.md,
    borderWidth:     1,
    borderColor:     glass.borderHi,
    backgroundColor: 'rgba(255,255,255,0.05)',
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  nudgeBtnPressed: {
    backgroundColor: accent.indigo,
    borderColor:     accent.indigo,
  },
  keyboardHint: {
    fontFamily: font.ui,
    fontSize:   11,
    color:      neutral.textDim,
    textAlign:  'center',
    marginTop:  spacing.xs,
  },

  // ── Sidebar ──────────────────────────────────────────────────────────────
  sidebar: {
    width:           360,
    gap:             spacing.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth:     1,
    borderColor:     glass.border,
    borderRadius:    radius.lg,
    padding:         spacing.lg,
  },
  kicker:  { fontFamily: font.bold, fontSize: 11, color: accent.indigo, letterSpacing: 1.5 },
  title:   { fontFamily: font.bold, fontSize: 22, color: neutral.text, lineHeight: 26 },
  copy:    { fontFamily: font.ui,   fontSize: 13, color: neutral.textMid, lineHeight: 19 },
  code:    { fontFamily: font.mono, color: neutral.text },

  sectionKicker: {
    fontFamily:    font.bold,
    fontSize:      10,
    color:         neutral.textDim,
    letterSpacing: 1.5,
    marginTop:     spacing.sm,
  },
  cityList: { maxHeight: 280 },
  cityListInner: { gap: 4 },
  cityRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   6,
    borderRadius:      radius.sm,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  cityRowSelected: {
    backgroundColor: 'rgba(124,131,255,0.12)',
    borderWidth:     1,
    borderColor:     accent.indigo,
  },
  cityIndexText: { fontFamily: font.mono, fontSize: 12, color: neutral.textDim, width: 18, textAlign: 'center' },
  cityName: { flex: 1, fontFamily: font.ui, fontSize: 14, color: neutral.textMid },
  cityNameSelected: { fontFamily: font.bold, color: neutral.text },
  dirtyDot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: accent.amber,
    marginHorizontal: 4,
  },
  cityCoords: {
    fontFamily: font.mono,
    fontSize:   11,
    color:      neutral.textDim,
  },

  actionRow: {
    flexDirection: 'row',
    gap:           spacing.sm,
  },
  secondaryBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical:   10,
    borderRadius:      radius.pill,
    borderWidth:       1,
    borderColor:       glass.border,
    backgroundColor:   'rgba(255,255,255,0.04)',
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  secondaryBtnText: { fontFamily: font.bold, fontSize: 12, color: neutral.textMid, letterSpacing: 0.3 },
  copyBtn: {
    flex:              1,
    backgroundColor:   accent.indigo,
    paddingVertical:   10,
    paddingHorizontal: spacing.lg,
    borderRadius:      radius.pill,
    alignItems:        'center',
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  copyBtnSaved: { backgroundColor: '#1a8a4a' },
  copyBtnText:  { fontFamily: font.bold, fontSize: 13, color: '#fff', letterSpacing: 0.3 },

  previewBox: {
    maxHeight:       260,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius:    radius.md,
    borderWidth:     1,
    borderColor:     glass.border,
  },
  previewText: {
    fontFamily: font.mono,
    fontSize:   11,
    color:      neutral.textMid,
    lineHeight: 16,
  },
});
