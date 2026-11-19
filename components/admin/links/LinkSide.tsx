import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DevLabel } from '@/components/primitives/DevLabel';
import { LinkPhoto } from './LinkPhoto';
import { neutral } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

/**
 * LinkSide
 * ---------
 * One half of a proposed tie-in: the platform account, or the person it is
 * being attached to. Both halves render through this same component so the
 * reviewer is comparing like with like rather than two different layouts.
 *
 * One job: present one identity.
 */

interface Props {
  label:   string;
  name:    string | null;
  photo:   string | null;
  handle?: string | null;
  meta?:   Array<string | null | undefined>;
  muted?:  boolean;
}

export function LinkSide({ label, name, photo, handle, meta = [], muted = false }: Props) {
  const lines = meta.filter(Boolean) as string[];

  return (
    <View style={styles.side}>
      <DevLabel name="LinkSide" />
      <LinkPhoto url={photo} name={name} />
      <View style={styles.body}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.name, muted && styles.mutedName]} numberOfLines={1}>
          {name ?? 'Nobody attached'}
        </Text>
        {handle ? <Text style={styles.handle} numberOfLines={1}>{handle}</Text> : null}
        {lines.map(line => (
          <Text key={line} style={styles.meta} numberOfLines={1}>{line}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  side:      { flexDirection: 'row', gap: spacing.md, flex: 1, minWidth: 260 },
  body:      { flex: 1, gap: 2 },
  label:     { color: neutral.textMid, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  name:      { color: neutral.text, fontSize: 16, fontWeight: '600' },
  mutedName: { color: neutral.textMid, fontStyle: 'italic', fontWeight: '400' },
  handle:    { color: neutral.strokeHi, fontSize: 13 },
  meta:      { color: neutral.textMid, fontSize: 12 },
});
