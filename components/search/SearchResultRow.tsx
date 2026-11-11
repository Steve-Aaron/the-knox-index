import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { CardAvatar } from '@/components/card/CardAvatar';
import { LockIcon } from './SearchIcons';
import { neutral, glass, accent, knox } from '@/theme/colors';
import { font, weight } from '@/theme/typography';
import { radius } from '@/theme/spacing';
import type { SearchHit } from '@/lib/search';

/**
 * SearchResultRow
 * ----------------
 * One row of the search dropdown. Type: Politician (avatar) | Party (text
 * only). States: Default, Hovered, Active (keyboard highlight), Locked and
 * Locked + Pressed (pink lock) for guests.
 *
 * One job: render one hit and report the tap.
 */
interface Props {
  hit:         SearchHit;
  /** Description under a group's name, e.g. 'Party' or 'Region'. */
  groupNoun:   string;
  locked:      boolean;
  highlighted: boolean;
  onPress:     () => void;
  onHover?:    () => void;
}

export function SearchResultRow({ hit, groupNoun, locked, highlighted, onPress, onHover }: Props) {
  const isPerson    = hit.type === 'person';
  const name        = isPerson ? hit.person.name : hit.group.label;
  const description = isPerson ? hit.person.partyLabel : groupNoun;

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={onHover}
      accessibilityRole="link"
      accessibilityLabel={locked ? `${name}, locked` : name}
      style={({ hovered, pressed }: any) => [
        styles.row,
        !isPerson && styles.rowGroup,
        !locked && hovered && styles.rowHovered,
        !locked && highlighted && styles.rowActive,
        locked && (pressed || highlighted) && styles.rowLockedPressed,
      ]}
    >
      {({ pressed }: any) => (
        <>
          {isPerson && (
            <CardAvatar
              groupKey={hit.person.groupKey}
              initials={hit.person.avatarInitials}
              avatarUrl={hit.person.avatarUrl}
              size={36}
            />
          )}
          <View style={styles.text}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            <Text style={styles.description} numberOfLines={1}>{description}</Text>
          </View>
          {locked && (
            <View style={(pressed || highlighted) && styles.lockGlow}>
              <LockIcon color={pressed || highlighted ? knox.primaryPink : glass.border} />
            </View>
          )}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               12,
    height:            54,
    paddingHorizontal: 12,
    paddingVertical:   8,
    borderRadius:      radius.md,
    borderWidth:       1,
    borderColor:       glass.border,
    backgroundColor:   glass.card,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  rowGroup:   { paddingLeft: 24 },
  rowHovered: { borderColor: neutral.strokeHi, backgroundColor: 'transparent' },
  rowActive: {
    borderColor:     accent.indigo,
    backgroundColor: accent.indigo + '2E',  // 18%
  },
  rowLockedPressed: { borderColor: knox.primaryPink + '29' },  // 16%

  text: {
    flex:     1,
    minWidth: 0,
    gap:      1,
  },
  name: {
    fontFamily: font.bold,
    fontWeight: weight.bold,
    fontSize:   16,
    color:      neutral.text,
  },
  description: {
    fontFamily:    font.ui,
    fontWeight:    weight.semiBold,
    fontSize:      12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color:         neutral.textDim,
  },
  lockGlow: Platform.select({
    web: { filter: 'drop-shadow(2px 1px 2px rgba(232,60,145,0.4)) drop-shadow(-2px -1px 2px rgba(232,60,145,0.4))' } as any,
    default: {},
  }) as any,
});
