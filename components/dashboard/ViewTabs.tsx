import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { MotiView } from 'moti';
import type { AccountType } from '@/data/types';
import { neutral, glass, accent } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { type } from '@/theme/typography';

/**
 * ViewTabs
 * ---------
 * Switches the leaderboard between account type groups.
 * 'all' shows everyone. 'senior_politicians' is a composite tab covering
 * shadow_cabinet_minister, cabinet_minister, and party_leader.
 *
 * One job: emit the chosen view type to the parent.
 */

export type ViewType =
  | 'all'
  | 'member_of_parliament'
  | 'political_party'
  | 'party_leader'
  | 'cabinet_minister'
  | 'senior_politicians';

/**
 * Maps each ViewType to the AccountType values it includes.
 * 'all' has no entry — it means no filter is applied.
 * 'senior_politicians' is a composite: cabinet ministers, party leaders,
 * shadow cabinet ministers, and the prime minister.
 */
export const VIEW_ACCOUNT_TYPES: Partial<Record<ViewType, AccountType[]>> = {
  member_of_parliament: ['member_of_parliament'],
  political_party:      ['political_party'],
  party_leader:         ['party_leader'],
  cabinet_minister:     ['cabinet_minister', 'prime_minister'],
  senior_politicians:   ['prime_minister', 'cabinet_minister', 'party_leader', 'shadow_cabinet_minister'],
};

interface Tab {
  value: ViewType;
  label: string;
  icon:  string;
  tip:   string;
}

const TABS: Tab[] = [
  { value: 'all',                  label: 'All',               icon: '⊞', tip: 'Everyone tracked'                                                                        },
  { value: 'member_of_parliament', label: 'MPs',               icon: '🏛', tip: 'Elected MPs, MSPs, AMs and other sitting members'                                        },
  { value: 'political_party',      label: 'Parties',           icon: '🏴', tip: 'Official party accounts'                                                                 },
  { value: 'party_leader',         label: 'Party Leaders',     icon: '👑', tip: 'Leaders of political parties'                                                            },
  { value: 'cabinet_minister',     label: 'Cabinet',           icon: '🗂', tip: 'Current cabinet ministers'                                                               },
  { value: 'senior_politicians',   label: 'Senior Politicians',icon: '⭐', tip: 'Cabinet ministers, party leaders, shadow cabinet and the Prime Minister combined'        },
];

interface Props {
  value:    ViewType;
  onChange: (v: ViewType) => void;
  counts?:  Partial<Record<ViewType, number>>;
}

export function ViewTabs({ value, onChange, counts }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {TABS.map(tab => {
        const active = value === tab.value;
        const count  = counts?.[tab.value];
        return (
          <Pressable
            key={tab.value}
            onPress={() => onChange(tab.value)}
            accessibilityLabel={tab.tip}
            style={({ pressed }) => [
              styles.tab,
              active && styles.tabActive,
              pressed && { opacity: 0.8 },
            ]}
          >
            {active && (
              <MotiView
                from={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'timing', duration: 180 }}
                style={StyleSheet.absoluteFill}
              >
                <View style={[StyleSheet.absoluteFill, styles.tabActiveBg]} />
              </MotiView>
            )}
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
              {tab.label}
            </Text>
            {count != null && (
              <View style={[styles.badge, active && styles.badgeActive]}>
                <Text style={[styles.badgeText, active && styles.badgeTextActive]}>
                  {count}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: glass.border,
    backgroundColor: glass.fill,
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  tabActive: {
    borderColor: accent.indigo,
  },
  tabActiveBg: {
    borderRadius: radius.pill,
    backgroundColor: 'rgba(124,131,255,0.10)',
  },
  tabIcon: {
    fontSize: 16,
  },
  tabLabel: {
    ...type.caption,
    color: neutral.textMid,
    fontSize: 12,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: accent.indigo,
  },
  badge: {
    backgroundColor: glass.fill,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: glass.border,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeActive: {
    borderColor: accent.indigo,
    backgroundColor: 'rgba(124,131,255,0.15)',
  },
  badgeText: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 12,
    fontWeight: '700',
  },
  badgeTextActive: {
    color: accent.indigo,
  },
});
