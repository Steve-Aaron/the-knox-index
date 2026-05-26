import React from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { CardAvatar } from '@/components/card/CardAvatar';
import { LinkPill } from '@/components/primitives/LinkPill';
import { RadialScoreChart } from '@/components/card/RadialScoreChart';
import type { RawScoreValues } from '@/components/card/RadialScoreChart';
import { DashCard } from '@/components/primitives/DashCard';
import { DevLabel } from '@/components/primitives/DevLabel';
import { neutral, party, glass, accent } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { type, font } from '@/theme/typography';
import { breakpoints } from '@/theme/breakpoints';
import { fmtLabel } from '@/lib/format';
import type { Politician, AccountType } from '@/data/types';

/**
 * AccountHero
 * -----------
 * TWO separate DashCards side by side on desktop (2em gap),
 * stacked on mobile (1em gap).
 *
 * Card A — persona: identity, rank, score bars, stats, summary
 * Card B — radar:   RadialScoreChart with axis labels
 *
 * One job: surface who this person is and how they perform.
 */

interface Props {
  politician:  Politician;
  overallRank: number;
  totalCount:  number;
  rangeLabel:  string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDelta(delta: number | null): { text: string; color: string } {
  if (delta === null || delta === 0) return { text: '—', color: neutral.textDim };
  const sign  = delta > 0 ? '+' : '';
  const color = delta > 0 ? accent.mint : '#FF6B6B';
  const abs   = Math.abs(delta);
  const text  = sign + (abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : String(abs));
  return { text, color };
}

function fmtFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** Only show the role string if it looks like a proper title (not a single word like 'left'). */
function isValidRole(role: string): boolean {
  return /[\s,]/.test(role.trim());
}

// ── Sub-components ────────────────────────────────────────────────────────────

const TYPE_LABELS: Partial<Record<AccountType, string>> = {
  member_of_parliament:    'MP',
  political_party:         'Party',
  party_leader:            'Party Leader',
  prime_minister:          'Prime Minister',
  cabinet_minister:        'Cabinet Minister',
  shadow_cabinet_minister: 'Shadow Minister',
  council:                 'Council',
  other:                   'Other',
};

function TypeChip({ accountType }: { accountType: AccountType }) {
  const label = TYPE_LABELS[accountType] ?? fmtLabel(accountType);
  return (
    <View style={chipStyles.chip}>
      <Text style={chipStyles.text}>{label}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    borderWidth:       1,
    borderColor:       glass.borderHi,
    borderRadius:      radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical:   4,
    backgroundColor:   'rgba(255,255,255,0.06)',
  },
  text: { fontFamily: font.bold, fontSize: 11, color: neutral.textMid, letterSpacing: 0.4 },
});

function RankBadge({ rank, total, color }: { rank: number; total: number; color: string }) {
  return (
    <View style={[rankStyles.wrap, { borderColor: color + '50' }]}>
      <Text style={[rankStyles.number, { color }]}>#{rank}</Text>
      <Text style={rankStyles.of}>of {total}</Text>
    </View>
  );
}

const rankStyles = StyleSheet.create({
  wrap: {
    alignItems:        'center',
    borderWidth:       1,
    borderRadius:      radius.sm,
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor:   'rgba(255,255,255,0.05)',
    gap:               1,
  },
  number: { fontFamily: font.bold, fontSize: 30, lineHeight: 34 },
  of:     { ...type.caption, color: neutral.textDim, fontSize: 10 } as any,
});

/** Short axis labels — max 5 chars so they never wrap. */
const BAR_LABELS: Record<string, string> = {
  VIEWS:      'VIEWS',
  FREQUENCY:  'FREQ.',
  ENGAGEMENT: 'ENG.',
  FOLLOWERS:  'FOLL.',
};

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  const short = BAR_LABELS[label] ?? label.slice(0, 5);
  return (
    <View style={barStyles.row}>
      <Text style={barStyles.label} numberOfLines={1}>{short}</Text>
      <View style={barStyles.track}>
        <View
          style={[
            barStyles.fill,
            { width: `${score}%` as any, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={[barStyles.score, { color }]}>{score}</Text>
    </View>
  );
}

const barStyles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: {
    fontFamily:    font.bold,
    fontSize:      9,
    color:         neutral.textDim,
    letterSpacing: 1.1,
    width:         36,    // tight fixed width — short labels only
  },
  track: {
    flex:            1,
    height:          5,
    borderRadius:    3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow:        'hidden',
  },
  fill:  { height: 5, borderRadius: 3, opacity: 0.85 },
  score: { fontFamily: font.bold, fontSize: 12, width: 26, textAlign: 'right' },
});

// ── Main component ────────────────────────────────────────────────────────────

export function AccountHero({ politician, overallRank, totalCount, rangeLabel }: Props) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= breakpoints.desktop;
  const colour    = party[politician.partyKey];
  const delta     = fmtDelta(politician.totals.followerChange);

  const recentPosts = politician.recentPosts ?? [];
  const avgViews = recentPosts.length > 0
    ? Math.round(recentPosts.reduce((s, p) => s + p.views, 0) / recentPosts.length)
    : 0;

  const engViews = politician.totals.viewsInRange > 0
    ? politician.totals.viewsInRange : politician.totals.views24h;

  const engNumerator = politician.totals.viewsInRange > 0
    ? politician.totals.likesInRange + politician.totals.commentsInRange +
      politician.totals.savesInRange  + politician.totals.sharesInRange
    : politician.totals.likesToday + politician.totals.commentsToday + politician.totals.savesToday;

  const rawValues: RawScoreValues = {
    views:      avgViews,
    frequency:  politician.totals.postsInRange > 0 ? politician.totals.postsInRange : politician.totals.postsThisWeek,
    engagement: engViews > 0 ? (engNumerator / engViews) * 100 : 0,
    followers:  politician.totals.followers,
    knoxFactor: politician.scores.knoxFactor,
  };

  const validRole = politician.role && isValidRole(politician.role);

  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 320 }}
      style={[styles.container, isDesktop ? styles.containerDesktop : styles.containerMobile]}
    >
      <DevLabel name="AccountHero" />

      {/* ── Card A: Persona ─────────────────────────────────────────────── */}
      <DashCard style={styles.card} topAccent={undefined}>
        {/* Party gradient — strong diagonal wash from top-left */}
        <LinearGradient
          colors={[colour.base + 'CC', colour.base + '44', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.8, y: 0.55 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={styles.personaBody}>

          {/* Identity row */}
          <View style={styles.identity}>
            <CardAvatar
              partyKey={politician.partyKey}
              initials={politician.avatarInitials}
              avatarUrl={politician.avatarUrl}
              size={84}
            />
            <View style={styles.idText}>
              <Text style={styles.name}>{politician.name}</Text>
              <Text style={styles.partyLine}>
                {politician.partyLabel}
                {validRole ? ` · ${politician.role}` : ''}
              </Text>
              <View style={styles.handleRow}>
                <LinkPill
                  label={politician.handle}
                  url={`https://www.tiktok.com/${politician.handle}`}
                  accentColour={colour.base}
                />
              </View>
            </View>
          </View>

          {/* Account type chips */}
          {(politician.accountTypes ?? []).filter(t => t !== 'other').length > 0 && (
            <View style={styles.chipRow}>
              {(politician.accountTypes ?? [])
                .filter(t => t !== 'other')
                .map(t => <TypeChip key={t} accountType={t} />)}
            </View>
          )}

          {/* Rank + Knox score */}
          <View style={styles.rankRow}>
            <RankBadge rank={overallRank} total={totalCount} color={colour.base} />
            <View style={styles.knoxBlock}>
              <Text style={styles.knoxLabel}>KNOX SCORE</Text>
              <View style={styles.knoxValueRow}>
                <Text style={[styles.knoxValue, { color: colour.base }]}>
                  {politician.scores.knoxFactor}
                </Text>
                <Text style={styles.knoxSuffix}>/ 100</Text>
              </View>
            </View>
          </View>

          {/* Axis score bars */}
          <View style={styles.barsSection}>
            <Text style={styles.barsKicker}>PERFORMANCE AXES</Text>
            <View style={styles.bars}>
              <ScoreBar label="VIEWS"      score={politician.scores.views}      color={colour.base} />
              <ScoreBar label="FREQUENCY"  score={politician.scores.frequency}  color={colour.base} />
              <ScoreBar label="ENGAGEMENT" score={politician.scores.engagement} color={colour.base} />
              <ScoreBar label="FOLLOWERS"  score={politician.scores.followers}  color={colour.base} />
            </View>
          </View>

          {/* Stats strip */}
          <View style={styles.statsStrip}>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>FOLLOWERS</Text>
              <Text style={styles.statValue}>{fmtFollowers(politician.totals.followers)}</Text>
              {delta.text !== '—' && (
                <View style={[styles.deltaChip, { backgroundColor: delta.color + '20', borderColor: delta.color + '50' }]}>
                  <Text style={[styles.deltaText, { color: delta.color }]}>{delta.text} today</Text>
                </View>
              )}
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>POSTS</Text>
              <Text style={styles.statValue}>{politician.totals.posts}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>THIS WEEK</Text>
              <Text style={styles.statValue}>{politician.totals.postsThisWeek}</Text>
            </View>
          </View>

          {/* AI summary placeholder */}
          <View style={styles.summaryBox}>
            <Text style={styles.summaryKicker}>AI SUMMARY · COMING SOON</Text>
            <Text style={styles.summaryText}>
              An AI-generated summary of {politician.name.split(' ')[0]}'s content
              strategy, top themes, and social performance will appear here.
            </Text>
          </View>

        </View>
      </DashCard>

      {/* ── Card B: Radar ───────────────────────────────────────────────── */}
      <DashCard style={styles.card} topAccent={undefined}>
        <View style={styles.radarBody}>
          <View style={styles.radarHeader}>
            <Text style={styles.radarKicker}>PERFORMANCE RADAR</Text>
            <Text style={styles.radarSub}>{rangeLabel}</Text>
          </View>
          <View style={styles.radarChartWrap}>
            <RadialScoreChart
              scores={politician.scores}
              partyKey={politician.partyKey}
              rawValues={rawValues}
              size={isDesktop ? 360 : 300}
            />
          </View>
        </View>
      </DashCard>

    </MotiView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // Outer container — this IS the layout, not a card
  container: {
    gap: spacing.base,   // 1em mobile default
  },
  containerDesktop: {
    flexDirection: 'row',
    gap:           spacing.xxl,   // 2em desktop
    alignItems:    'stretch',
  },
  containerMobile: {
    flexDirection: 'column',
  },

  // Both cards share flex: 1 so they're equal width on desktop
  card: {
    flex:     1,
    overflow: 'hidden',
  },

  // ── Persona card body ──────────────────────────────────────────────────────
  personaBody: {
    padding: spacing.xl,
    gap:     spacing.lg,
    flex:    1,
  },

  identity: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           spacing.lg,
  },
  idText: {
    flex: 1,
    gap:  4,
    paddingTop: 4,
  },
  name: {
    fontFamily: font.bold,
    fontSize:   24,
    color:      neutral.text,
    lineHeight: 28,
    ...Platform.select({ web: { textShadow: '0 1px 8px rgba(0,0,0,0.7)' } as any, default: {} }),
  },
  partyLine: {
    ...type.body,
    color:    neutral.textMid,
    fontSize: 13,
  },
  handleRow: { flexDirection: 'row', marginTop: 4 },

  chipRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.xs,
  },

  rankRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xl,
  },
  knoxBlock: { gap: 2 },
  knoxLabel: {
    fontFamily:    font.bold,
    fontSize:      9,
    color:         neutral.textDim,
    letterSpacing: 1.4,
  },
  knoxValueRow: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           4,
  },
  knoxValue: {
    fontFamily: font.bold,
    fontSize:   40,
    lineHeight: 44,
  },
  knoxSuffix: {
    fontFamily: font.bold,
    fontSize:   14,
    color:      neutral.textDim,
  },

  barsSection: { gap: spacing.sm },
  barsKicker: {
    fontFamily:    font.bold,
    fontSize:      9,
    color:         neutral.textDim,
    letterSpacing: 1.4,
  },
  bars: { gap: 9 },

  statsStrip: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           spacing.lg,
  },
  statBlock: { gap: 3 },
  statLabel: {
    fontFamily:    font.bold,
    fontSize:      9,
    color:         neutral.textDim,
    letterSpacing: 1.4,
  },
  statValue: {
    fontFamily: font.bold,
    fontSize:   20,
    color:      neutral.text,
    lineHeight: 24,
  },
  statDivider: {
    width:           1,
    height:          36,
    backgroundColor: glass.border,
    alignSelf:       'center',
  },
  deltaChip: {
    borderWidth:       1,
    borderRadius:      radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
    alignSelf:         'flex-start',
    marginTop:         2,
  },
  deltaText: {
    fontFamily:    font.bold,
    fontSize:      10,
    letterSpacing: 0.3,
  },

  summaryBox: {
    borderWidth:     1,
    borderColor:     glass.border,
    borderRadius:    radius.md,
    borderStyle:     'dashed' as any,
    padding:         spacing.md,
    gap:             spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  summaryKicker: {
    fontFamily:    font.bold,
    fontSize:      9,
    color:         neutral.textDim,
    letterSpacing: 1.4,
  },
  summaryText: {
    ...type.body,
    color:      neutral.textMid,
    fontSize:   12,
    lineHeight: 18,
  },

  // ── Radar card body ────────────────────────────────────────────────────────
  radarBody: {
    flex:           1,
    padding:        spacing.xl,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing.md,
  },
  radarHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    alignSelf:     'flex-start',
  },
  radarKicker: {
    fontFamily:    font.bold,
    fontSize:      10,
    color:         neutral.textDim,
    letterSpacing: 1.6,
  },
  radarSub: {
    ...type.caption,
    color:    neutral.textDim,
    fontSize: 10,
  } as any,
  radarChartWrap: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    width:          '100%',
  },
});
