import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { DashCard } from '@/components/primitives/DashCard';
import { DevLabel } from '@/components/primitives/DevLabel';
import { CardAvatar } from '@/components/card/CardAvatar';
import { Kicker } from '@/components/ui/Kicker';
import { Title } from '@/components/ui/Title';
import { useTenant } from '@/hooks/useTenant';
import { fmtCount } from '@/lib/format';
import { track } from '@/lib/analytics';
import { accent, colourFor, glass, neutral, trend } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { font, type } from '@/theme/typography';
import type { Politician } from '@/data/types';
import type { GrowthRow } from '@/data/useGrowth';

/**
 * FastestGrowing
 * ---------------
 * The accounts gaining followers fastest over the selected period, with
 * their photo, region or party, the followers gained and the % growth. Two
 * rankings: Absolute (most followers gained, the default) and Relative
 * (largest % growth). TikTok and X are added together per person. Tap a row
 * to open the account page.
 *
 * One job: rank accounts by follower growth.
 */
type Mode = 'absolute' | 'relative';

const MODES: { key: Mode; label: string }[] = [
  { key: 'absolute', label: 'ABSOLUTE' },
  { key: 'relative', label: 'RELATIVE' },
];

const INFO: Record<Mode, string> = {
  absolute: 'Followers gained over the period, from daily TikTok and X follower counts, added together per person. Ranked by the number of followers gained; accounts that started with fewer than 1,000 followers are left out.',
  relative: 'Follower growth over the period, from daily TikTok and X follower counts, added together per person. Ranked by % growth; accounts that started with fewer than 1,000 followers are left out.',
};

interface Props {
  /** Largest % growth first. */
  growth:       GrowthRow[];
  /** Most followers gained first. */
  growthAbsolute: GrowthRow[];
  /** The leaderboard's people, for names, photos and colours. */
  politicians:  Politician[];
  rangeLabel?:  string;
  /** Show each row's own start date (This year / Lifetime start at different times). */
  showSince?:   boolean;
  loading?:     boolean;
  topN?:        number;
}

interface Row extends GrowthRow { politician: Politician }

function fmtPct(pct: number): string {
  const v = pct * 100;
  return `+${v >= 100 ? Math.round(v) : v.toFixed(1)}%`;
}

function fmtSince(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function FastestGrowing({ growth: byPct, growthAbsolute, politicians, rangeLabel, showSince = false, loading = false, topN = 8 }: Props) {
  const subject = useTenant().brand.subjectShort;
  const [mode, setMode] = useState<Mode>('absolute');
  const growth = mode === 'absolute' ? growthAbsolute : byPct;

  const pick = (next: Mode) => {
    if (next === mode) return;
    try { track('fastest_growing_mode_changed', { mode: next, old_mode: mode }); } catch {}
    setMode(next);
  };

  // Match each growth row to its leaderboard entry (person, or a single account)
  const rows = useMemo<Row[]>(() => {
    const byPerson = new Map(politicians.filter(p => p.personId).map(p => [p.personId!, p]));
    const byId = new Map(politicians.map(p => [String(p.id), p]));
    return growth
      .map(g => ({ ...g, politician: (g.personId && byPerson.get(g.personId)) || g.accountIds.map(id => byId.get(id)).find(Boolean) }))
      .filter((r): r is Row => !!r.politician && r.gain > 0)
      .slice(0, topN);
  }, [growth, politicians, topN]);

  // Bars scale to the ranking's own measure
  const measure = (r: Row) => (mode === 'absolute' ? r.gain : r.pct);
  const maxMeasure = rows.length ? Math.max(...rows.map(measure)) : 0;

  return (
    <DashCard
      style={styles.wrap}
      infoText={INFO[mode]}
      infoTitle="Fastest growing"
    >
      <DevLabel name="FastestGrowing" />

      <View>
        <Kicker tone='dim'>FASTEST GROWING{rangeLabel ? ` · ${rangeLabel.toUpperCase()}` : ''}</Kicker>
        <Title style={{ fontSize: 16, marginTop: 2 }}>
          {mode === 'absolute' ? `Which ${subject} gained the most followers?` : `Which ${subject} are gaining followers fastest?`}
        </Title>
      </View>

      <View style={styles.modes} accessibilityRole="tablist">
        {MODES.map(m => {
          const on = m.key === mode;
          return (
            <Pressable
              key={m.key}
              onPress={() => pick(m.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={({ hovered }: any) => [styles.mode, on && styles.modeOn, hovered && !on && styles.modeHover]}
            >
              <Text style={[styles.modeText, on && styles.modeTextOn]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {rows.length === 0 ? (
        <Text style={styles.empty}>{loading ? 'Loading…' : 'No follower growth to show for this period yet.'}</Text>
      ) : (
        <View style={styles.list}>
          {rows.map((r, i) => {
            const p = r.politician;
            const colour = colourFor(p.groupKey);
            const slug = p.slug ?? p.handle.replace(/^@/, '');
            return (
              <Pressable
                key={r.key}
                onPress={() => router.push(`/account/${slug}`)}
                accessibilityRole="link"
                accessibilityLabel={`${p.name}, +${fmtCount(r.gain)} followers, ${fmtPct(r.pct)}, open account`}
                style={({ pressed, hovered }: any) => [styles.row, hovered && styles.rowHover, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.rank}>{i + 1}</Text>
                <CardAvatar groupKey={p.groupKey} initials={p.avatarInitials} avatarUrl={p.avatarUrl} size={36} />
                <View style={styles.who}>
                  <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                  <Text style={[styles.group, { color: colour.glow }]} numberOfLines={1}>
                    {p.groupLabel}{showSince ? ` · since ${fmtSince(r.since)}` : ''}
                  </Text>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${maxMeasure > 0 ? (measure(r) / maxMeasure) * 100 : 0}%`, backgroundColor: colour.base }]} />
                  </View>
                </View>
                <View style={styles.nums}>
                  {/* The ranking's measure leads; the other sits under it */}
                  <Text style={styles.pct}>{mode === 'absolute' ? `+${fmtCount(r.gain)}` : fmtPct(r.pct)}</Text>
                  <Text style={styles.gain}>{mode === 'absolute' ? fmtPct(r.pct) : `+${fmtCount(r.gain)}`}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </DashCard>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex:              1,
    paddingTop:        spacing.xl,
    paddingBottom:     spacing.md,
    paddingHorizontal: spacing.lg,
    gap:               spacing.md,
  },
  modes: {
    flexDirection: 'row',
    gap:           6,
  },
  mode: {
    paddingVertical:   5,
    paddingHorizontal: 12,
    borderRadius:      999,
    borderWidth:       1,
    borderColor:       glass.border,
    backgroundColor:   glass.fill,
    ...Platform.select({
      web: { cursor: 'pointer', transitionProperty: 'background-color, border-color', transitionDuration: '160ms' } as any,
      default: {},
    }),
  },
  modeOn: {
    backgroundColor: 'rgba(95,100,189,0.18)',
    borderColor:     accent.indigo,
  },
  modeHover: {
    backgroundColor: glass.fillHi,
  },
  modeText: {
    fontFamily:    font.bold,
    fontSize:      10,
    letterSpacing: 0.8,
    color:         neutral.textDim,
  },
  modeTextOn: {
    color: neutral.text,
  },
  empty: {
    ...type.body,
    fontSize: 13,
    color:    neutral.textMid,
  },
  list: {
    gap: spacing.xs,
  },
  row: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius:    10,
    ...Platform.select({
      web: { cursor: 'pointer', transitionProperty: 'background-color', transitionDuration: '160ms' } as any,
      default: {},
    }),
  },
  rowHover: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  rank: {
    fontFamily: font.mono,
    fontSize:   12,
    color:      neutral.textDim,
    width:      16,
  },
  who: {
    flex:     1,
    minWidth: 0,
    gap:      2,
  },
  name: {
    ...type.body,
    fontSize: 14,
    color:    neutral.text,
  },
  group: {
    ...type.caption,
    fontSize: 10,
  },
  track: {
    height:          3,
    borderRadius:    2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow:        'hidden',
    marginTop:       3,
  },
  fill: {
    height:       '100%',
    borderRadius: 2,
  },
  nums: {
    alignItems: 'flex-end',
    minWidth:   64,
  },
  pct: {
    fontFamily: font.mono,
    fontSize:   14,
    fontWeight: '700',
    color:      trend.up,
  },
  gain: {
    fontFamily: font.mono,
    fontSize:   11,
    color:      neutral.textDim,
  },
});
