import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import { track } from '@/lib/analytics';
import { MotiView } from 'moti';
import type { BriefsApiResponse } from '@/data/types';
import { DashCard } from '@/components/primitives/DashCard';
import { DevLabel } from '@/components/primitives/DevLabel';
import { PostBangerCard } from './PostBangerCard';
import { Kicker } from '@/components/ui/Kicker';
import { Title } from '@/components/ui/Title';
import { neutral, party, glass, accent, brand } from '@/theme/colors';
import { font } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { type } from '@/theme/typography';
import { formatters } from '@/components/primitives/CountUp';
import type { Politician } from '@/data/types';
import type { TimeRange } from '@/components/dashboard/TimeRangePicker';

/**
 * SummaryPanel
 * -------------
 * Editorial briefing panel. Top: narrative paragraph (AI-generated content
 * from n8n — daily or weekly depending on the selected time range). Below:
 * computed insight chips derived from live data. Bottom: 'top narratives'
 * bullet list, revealed only when the user selects 'This week'.
 * One job: give the reader a human-language summary of what the numbers mean.
 */
interface Props {
  politicians:  Politician[];
  /** Drives the daily-vs-weekly swap. Defaults to 'yesterday' so existing
   *  call sites that haven't been updated keep their old behaviour. */
  range?:       TimeRange;
  panelHeight?: number;
}

const INSIGHT_COLOURS = [accent.mint, accent.indigo, accent.amber];

export function SummaryPanel({ politicians, range = 'yesterday', panelHeight }: Props) {
  const isWeekly = range === 'week';
  const [brief, setBrief]             = useState<BriefsApiResponse | null>(null);
  const [briefLoading, setBriefLoading] = useState(true);
  const [briefError, setBriefError]   = useState<string | null>(null);

  // ── Summary hover: fire summary_hover_2s once per mount if the pointer
  //    rests on the summary panel for at least 2 seconds (web only).
  const hoverTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverFiredRef   = useRef(false);
  const handleMouseEnter = useCallback(() => {
    if (hoverFiredRef.current) return;
    hoverTimerRef.current = setTimeout(() => {
      hoverFiredRef.current = true;
      track('summary_hover_2s');
    }, 2000);
  }, []);
  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);
  useEffect(() => () => { if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current); }, []);

  useEffect(() => {
    let cancelled = false;

    setBriefLoading(true);
    setBriefError(null);

    fetch('/api/briefs')
      .then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return await r.json() as BriefsApiResponse;
      })
      .then(data => {
        if (cancelled) return;
        setBrief(data);
        setBriefLoading(false);
      })
      .catch(e => {
        if (cancelled) return;
        const uiMessage = e instanceof Error && /^HTTP \d+$/.test(e.message)
          ? e.message
          : 'Briefing unavailable';
        setBriefError(uiMessage);
        setBriefLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const insights = useMemo(() => {
    const sorted = [...politicians].sort(
      (a, b) => b.scores.knoxFactor - a.scores.knoxFactor
    );
    const top = sorted[0];
    const allPosts = politicians.flatMap(p =>
      (p.recentPosts ?? []).map(post => ({ ...post, politician: p }))
    );
    const mostViral = [...allPosts].sort((a, b) => b.views - a.views)[0];
    const totalFollowers = politicians.reduce(
      (s, p) => s + p.totals.followers,
      0
    );

    return [
      {
        id: 'i1',
        label: '#1 this week',
        value: top?.name ?? '—',
        sub: `Knox Factor · ${top?.scores.knoxFactor ?? 0}`,
        accentColor: party[top?.partyKey ?? 'unknown'].glow,
      },
      {
        id: 'i2',
        label: 'Most viral post',
        value: mostViral ? formatters.compact(mostViral.views) + ' views' : '—',
        sub: mostViral?.politician.name ?? '',
        accentColor: accent.pink,
      },
      {
        id: 'i3',
        label: 'Total reach tracked',
        value: formatters.compact(totalFollowers),
        sub: 'combined followers',
        accentColor: accent.mint,
      },
    ];
  }, [politicians]);

  // Top 6 posts by views across all politicians
  const topBangers = useMemo(() => {
    return politicians
      .flatMap(p => (p.recentPosts ?? []).map(post => ({ post, politician: p })))
      .sort((a, b) => b.post.views - a.post.views)
      .slice(0, 6);
  }, [politicians]);

  // Posting activity stats: who posted vs who didn't
  const postingStats = useMemo(() => {
    const posted    = politicians.filter(p => (p.recentPosts ?? []).length > 0);
    const silent    = politicians.filter(p => (p.recentPosts ?? []).length === 0);
    // Unique party labels among those who posted
    const partiesPosted = [...new Set(posted.map(p => p.partyLabel))].sort();
    return { posted: posted.length, silent: silent.length, partiesPosted };
  }, [politicians]);

  const wrapStyle = {
    flex: 1 as const,
    overflow: 'hidden' as const,
    ...(panelHeight != null ? { height: panelHeight } : {}),
  };

  // Web hover props — attach to the outer surface so any pointer rest counts.
  const hoverProps = Platform.OS === 'web'
    ? ({ onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave } as any)
    : {};

  return (
    <DashCard style={wrapStyle} {...hoverProps}>
      <DevLabel name="SummaryPanel" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ── Header ───────────────────────────────── */}
        <MotiView
          from={{ opacity: 0, translateY: 6 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 320 }}
        >
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Kicker tone='dim' style={{ marginBottom: spacing.xs }}>
                {isWeekly ? 'WEEKLY BRIEFING' : 'DAILY BRIEFING'}
              </Kicker>
              <Title style={{ fontFamily: font.ui, fontSize: 24, fontWeight: '800', letterSpacing: -0.5, lineHeight: 26 }}>
                {isWeekly ? 'This week on TikTok' : 'Today on TikTok'}
              </Title>
            </View>
            {brief && !brief.isToday && (
              <View style={styles.staleBadge}>
                <Text style={styles.staleBadgeText}>
                  {brief.brief.briefDate}
                </Text>
              </View>
            )}
          </View>
        </MotiView>

        {/* ── AI narrative — daily or weekly, driven by selected time range ───── */}
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 400, delay: 80 }}
        >
          <View style={styles.narrativeCard}>
            <View style={[styles.narrativeBar, { backgroundColor: accent.indigo }]} />
            {briefLoading ? (
              <Text style={[styles.narrativeText, styles.narrativeLoading]}>
                Loading briefing…
              </Text>
            ) : (() => {
              const summaryText = isWeekly
                ? brief?.brief.briefWeeklySummary
                : brief?.brief.briefDailySummary;
              if (summaryText) {
                return <Text style={styles.narrativeText}>{summaryText}</Text>;
              }
              return (
                <Text style={[styles.narrativeText, styles.narrativeLoading]}>
                  {briefError
                    ? `Error: ${briefError}`
                    : 'No briefing available yet — check back later.'}
                </Text>
              );
            })()}
          </View>
        </MotiView>

        {/* ── Computed insight chips ───────────────── */}
        <Text style={styles.sectionKicker}>KEY STATS THIS WEEK</Text>
        <View style={styles.insights}>
          {insights.map((item, i) => (
            <MotiView
              key={item.id}
              from={{ opacity: 0, translateX: -8 }}
              animate={{ opacity: 1, translateX: 0 }}
              transition={{ type: 'timing', duration: 280, delay: 120 + i * 60 }}
            >
              <View style={[styles.insightRow, { borderLeftColor: item.accentColor }]}>
                <Text style={styles.insightLabel}>{item.label.toUpperCase()}</Text>
                <Text
                  style={[styles.insightValue, { color: item.accentColor }]}
                  numberOfLines={1}
                >
                  {item.value}
                </Text>
                {item.sub ? (
                  <Text style={styles.insightSub} numberOfLines={1}>
                    {item.sub}
                  </Text>
                ) : null}
              </View>
            </MotiView>
          ))}
        </View>

        {/* ── What banged — post cards ─────────────── */}
        {topBangers.length > 0 ? (
          <>
            <Text style={styles.sectionKicker}>TOP POSTS</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.bangersRow}
            >
              {topBangers.map(({ post, politician }, i) => (
                <PostBangerCard
                  key={post.postId}
                  post={post}
                  politicianName={politician.name}
                  partyKey={politician.partyKey}
                  delay={i * 60}
                />
              ))}
            </ScrollView>

            {/* Posting activity summary */}
            <View style={styles.postingStats}>
              <Text style={styles.postingStatsText}>
                <Text style={styles.postingStatsHighlight}>{postingStats.posted}</Text>
                <Text style={styles.postingStatsDim}> of {politicians.length} tracked accounts posted this week · </Text>
                <Text style={styles.postingStatsHighlight}>{postingStats.silent}</Text>
                <Text style={styles.postingStatsDim}> were silent.</Text>
              </Text>
              {postingStats.partiesPosted.length > 0 && (
                <Text style={styles.postingStatsParties}>
                  Posted:{' '}
                  <Text style={styles.postingStatsHighlight}>
                    {postingStats.partiesPosted.join(' · ')}
                  </Text>
                </Text>
              )}
            </View>
          </>
        ) : null}

        {/* ── AI-generated top narratives — only shown when 'This week' is selected ── */}
        {isWeekly && (brief?.brief.topNarrativesThisWeek?.length || briefLoading) ? (
          <>
            <Text style={styles.sectionKicker}>TOP NARRATIVES THIS WEEK</Text>
            <View style={styles.narratives}>
              {briefLoading
                ? [0, 1, 2].map(i => (
                    <View key={i} style={[styles.narrativeItem, styles.narrativeSkeleton]} />
                  ))
                : brief!.brief.topNarrativesThisWeek.map((n, i) => (
                    <MotiView
                      key={i}
                      from={{ opacity: 0, translateY: 8 }}
                      animate={{ opacity: 1, translateY: 0 }}
                      transition={{ type: 'timing', duration: 300, delay: 300 + i * 80 }}
                    >
                      <View style={styles.narrativeItem}>
                        <View style={[styles.narrativeDot, { backgroundColor: INSIGHT_COLOURS[i % INSIGHT_COLOURS.length] }]} />
                        <View style={styles.narrativeContent}>
                          <Text style={styles.narrativeHeadline}>{n.headline}</Text>
                          <Text style={styles.narrativeBody}>{n.body}</Text>
                        </View>
                      </View>
                    </MotiView>
                  ))
              }
            </View>
          </>
        ) : null}
      </ScrollView>
    </DashCard>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // Header
  headerRow: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    gap:            spacing.md,
  },
  staleBadge: {
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth:     1,
    borderColor:     'rgba(251,191,36,0.3)',
    borderRadius:    radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical:   3,
    alignSelf:       'flex-start',
    marginTop:       4,
  },
  staleBadgeText: {
    fontFamily:    font.bold,
    fontSize:      9,
    color:         '#fbbf24',
    letterSpacing: 0.6,
  },
  subtitle: {
    fontFamily: font.ui,
    fontSize: 24,
    fontWeight: '800',
    color: accent.indigo,
    letterSpacing: -0.5,
    lineHeight: 26,
  },

  // Narrative card
  narrativeCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: glass.fill,
    borderWidth: 1,
    borderColor: glass.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  narrativeBar: {
    width: 2,
    borderRadius: 2,
    opacity: 0.7,
    alignSelf: 'stretch',
  },
  narrativeText: {
    flex: 1,
    ...type.body,
    color: neutral.textMid,
    fontSize: 16,
    lineHeight: 20,
  },

  // Bangers horizontal strip
  bangersRow: {
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },

  // Posting activity stats
  postingStats: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: glass.border,
  },
  postingStatsText: {
    ...type.body,
    fontSize: 12,
    lineHeight: 18,
  },
  postingStatsDim: {
    color: neutral.textDim,
  },
  postingStatsHighlight: {
    color: neutral.text,
    fontFamily: font.bold,
  },
  postingStatsParties: {
    ...type.body,
    fontSize: 12,
    color: neutral.textDim,
    lineHeight: 16,
  },

  // Section kicker
  sectionKicker: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 12,
    marginBottom: -spacing.sm,
  },

  // Insight rows
  insights: {
    gap: spacing.sm,
  },
  insightRow: {
    backgroundColor: glass.fill,
    borderWidth: 1,
    borderColor: glass.border,
    borderLeftWidth: 3,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  insightLabel: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 12,
  },
  insightValue: {
    fontFamily: font.mono,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  insightSub: {
    ...type.body,
    color: neutral.textMid,
    fontSize: 12,
  },

  // Top narratives
  narratives: {
    gap: spacing.md,
  },
  narrativeItem: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  narrativeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    flexShrink: 0,
  },
  narrativeContent: {
    flex: 1,
    gap: 4,
  },
  narrativeHeadline: {
    ...type.body,
    color: neutral.text,
    fontSize: 16,
    fontWeight: '700',
  },
  narrativeBody: {
    ...type.body,
    color: neutral.textMid,
    fontSize: 12,
    lineHeight: 18,
  },
  narrativeLoading: {
    color: neutral.textDim,
    fontStyle: 'italic',
  },
  narrativeSkeleton: {
    height: 52,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
  },

});
