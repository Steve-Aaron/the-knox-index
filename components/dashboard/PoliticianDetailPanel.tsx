import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Linking,
  Platform,
} from 'react-native';
import { MotiView } from 'moti';
import { DashCard } from '@/components/primitives/DashCard';
import { DevLabel } from '@/components/primitives/DevLabel';
import { CardHeader } from '@/components/card/CardHeader';
import { RadialScoreChart, RawScoreValues } from '@/components/card/RadialScoreChart';
import { LinkPill } from '@/components/primitives/LinkPill';
import { InfoTip } from '@/components/primitives/InfoTip';
import { CountUp, formatters } from '@/components/primitives/CountUp';
import { StyleChip } from '@/components/primitives/StyleChip';
import { fmtDate } from '@/lib/format';
import { FollowerQualityFlag } from './FollowerQualityFlag';
import { neutral, party, glass } from '@/theme/colors';
import { font } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { type } from '@/theme/typography';
import type { Politician, ScoreKey } from '@/data/types';
import type { TimeRange } from '@/components/dashboard/TimeRangePicker';

/**
 * PoliticianDetailPanel
 * ----------------------
 * Right-side panel that surfaces the full detail view for the currently
 * selected politician: identity, radar chart, account totals, recent posts,
 * and a TikTok CTA. Animates in with a slide+fade whenever the active
 * politician changes. One job.
 */
interface Props {
  politician:  Politician;
  headlineKey: ScoreKey;
  /** Selected dashboard time range. Drives the frequency axis wording. */
  range:       TimeRange;
  panelHeight?: number;
}

export function PoliticianDetailPanel({ politician, headlineKey, range, panelHeight }: Props) {
  const colour = party[politician.partyKey];

  // Range-aware avg views — fed into the radar chart's hover popup so the
  // figure tracks the dashboard's time range.
  const recentPosts = politician.recentPosts ?? [];
  const avgViews = recentPosts.length > 0
    ? Math.round(recentPosts.reduce((s, p) => s + p.views, 0) / recentPosts.length)
    : 0;

  // Lifetime avg views — used in the 'Account totals' tile, which is always
  // lifetime regardless of the selected range. Sourced from totalViews /
  // totalPosts (both lifetime snapshots from accountMetrics), so the figure
  // doesn't shift when the user changes the range picker.
  const lifetimeAvgViews = politician.totals.posts > 0
    ? Math.round(politician.totals.views / politician.totals.posts)
    : 0;

  const engViews = politician.totals.viewsInRange > 0
    ? politician.totals.viewsInRange
    : politician.totals.views24h;
  const engNumerator =
    (politician.totals.viewsInRange > 0
      ? politician.totals.likesInRange + politician.totals.commentsInRange +
        politician.totals.savesInRange + politician.totals.sharesInRange
      : politician.totals.likesToday + politician.totals.commentsToday + politician.totals.savesToday);

  // Activity reflects the selected window, matching the radar's axis label:
  //   yesterday / week → past 7 days (postsThisWeek)
  //   month / year / lifetime → the range-bound count (postsInRange)
  const isShortRange = range === 'yesterday' || range === 'week';
  const frequencyValue = isShortRange
    ? politician.totals.postsThisWeek
    : politician.totals.postsInRange;

  const rawValues: RawScoreValues = {
    virality:   politician.totals.followers > 0 ? avgViews / politician.totals.followers : 0,
    frequency:  frequencyValue,
    engagement: engViews > 0 ? (engNumerator / engViews) * 100 : 0,
    followers:  politician.totals.followers,
    knoxFactor: politician.scores.knoxFactor,
  };

  const wrapStyle = {
    flex: 1 as const,
    overflow: 'hidden' as const,
    ...(panelHeight != null ? { height: panelHeight } : {}),
  };

  return (
    <DashCard
      style={wrapStyle}
      topAccent={undefined}
      infoText="Full profile for the selected politician. The radar chart shows their score 0–100 relative to every other tracked account across views, engagement, posting frequency, followers and Knox Factor (the average). Recent posts are listed below."
      infoTitle="Politician Profile"
    >
      <DevLabel name="PoliticianDetailPanel" />
      {/* Horizontal party-colour strip along the top */}
      <View
        style={[styles.partyStrip, { backgroundColor: colour.base }]}
        {...(Platform.OS === 'web' ? { 'data-container_name': 'card_party_strip' } as any : {})}
      />

      <MotiView
        key={politician.id}
        from={{ opacity: 0, translateX: 14 }}
        animate={{ opacity: 1, translateX: 0 }}
        transition={{ type: 'spring', damping: 22, stiffness: 180, mass: 0.9 }}
        style={styles.motionWrap}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {/* ── Identity ─────────────────────────────── */}
          <View
            style={styles.section}
            {...(Platform.OS === 'web' ? { 'data-container_name': 'card_identity_section' } as any : {})}
          >
            <CardHeader
              name={politician.name}
              role={'On the ' + politician.role.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase())}
              partyLabel={'Associated with ' + politician.partyLabel}
              partyKey={politician.partyKey}
              initials={politician.avatarInitials}
              avatarUrl={politician.avatarUrl}
            />
            <View style={styles.linkRow}>
              <LinkPill
                label={politician.handle}
                url={`https://www.tiktok.com/${politician.handle}`}
                accentColour={colour.glow}
              />
            </View>
          </View>

          {/* ── Radar chart ──────────────────────────── */}
          <View
            style={styles.chartWrap}
            {...(Platform.OS === 'web' ? { 'data-container_name': 'chart_wrap_radar' } as any : {})}
          >
            <View style={styles.chartHeader}>
              <SectionKicker label="Performance radar" />
              <View style={styles.chartHeaderTip}>
                <InfoTip
                  text="Each point on this chart is scored 0–100 relative to the best performer in the dataset. Hover any point to see the raw number. Knox Factor is the average of all five axes."
                  width={260}
                  align="left"
                />
              </View>
            </View>
            <RadialScoreChart
              scores={politician.scores}
              radial={politician.radial}
              partyKey={politician.partyKey}
              highlightKey={headlineKey}
              rawValues={rawValues}
              range={range}
              size={300}
            />
          </View>

          {/* ── Audience quality flag ────────────────── */}
          <FollowerQualityFlag politician={politician} />

          {/* ── Account totals — LIFETIME, range-independent ───────────────── */}
          <SectionKicker label="Account totals" />
          <View
            style={styles.totalsGrid}
            {...(Platform.OS === 'web' ? { 'data-container_name': 'card_account_totals' } as any : {})}
          >
            <TotalTile label="Posts" value={politician.totals.posts} />
            <TotalTile label="Followers" value={politician.totals.followers} />
            <TotalTile label="Total likes" value={politician.totals.likes} />
            <TotalTile
              label="Avg views / post"
              value={lifetimeAvgViews}
              accentColor={colour.glow}
              zeroDash
            />
          </View>

          {/* ── Past 7 days activity ─────────────────── */}
          <SectionKicker label="Past 7 days" />
          <View
            style={styles.totalsGrid}
            {...(Platform.OS === 'web' ? { 'data-container_name': 'card_past7days_totals' } as any : {})}
          >
            <TotalTile label="Views"    value={politician.totals.viewsInRange}    accentColor={colour.glow} zeroDash />
            <TotalTile label="Likes"    value={politician.totals.likesInRange}    accentColor={colour.glow} zeroDash />
            <TotalTile label="Comments" value={politician.totals.commentsInRange} accentColor={colour.glow} zeroDash />
            <TotalTile label="Saves"    value={politician.totals.savesInRange}    accentColor={colour.glow} zeroDash />
          </View>

          {/* ── Recent posts ─────────────────────────── */}
          <SectionKicker label="Recent posts" />
          {recentPosts.length === 0 ? (
            <View style={styles.emptyPosts}>
              <Text style={styles.emptyPostsText}>No posts recorded for this account.</Text>
              <Text style={styles.emptyPostsSub}>They may not have posted recently or their content isn't being tracked yet.</Text>
            </View>
          ) : (
          <View
            style={styles.posts}
            {...(Platform.OS === 'web' ? { 'data-container_name': 'card_recent_posts_list' } as any : {})}
          >
            {recentPosts.map(post => {
              const engRate = post.views > 0
                ? +(((post.likes + post.comments + (post.saves ?? 0) + post.shares) / post.views) * 100).toFixed(2)
                : 0;
              return (
                <Pressable
                  key={post.postId}
                  onPress={post.postUrl ? () => Linking.openURL(post.postUrl!) : undefined}
                  style={({ pressed, hovered }: any) => [
                    styles.postCard,
                    post.postUrl && hovered && { borderColor: colour.base, backgroundColor: 'rgba(255,255,255,0.04)' },
                    post.postUrl && pressed && { opacity: 0.8 },
                  ]}
                  accessibilityRole={post.postUrl ? 'link' : undefined}
                >
                  {/* Caption + TikTok icon */}
                  <View style={styles.postCaptionRow}>
                    <Text style={styles.postCaption} numberOfLines={3}>{post.caption}</Text>
                    {post.postUrl
                      ? Platform.OS === 'web'
                        ? React.createElement('i', {
                            className: 'fa-brands fa-tiktok',
                            style: { color: '#FFFFFF', fontSize: 16, flexShrink: 0, marginTop: 2 },
                          })
                        : <Text style={[styles.postLinkIcon, { color: '#FFFFFF' }]}>↗</Text>
                      : null}
                  </View>

                  {/* AI summary — falls back to nothing when missing so the layout stays tight */}
                  {post.summary ? (
                    <Text style={styles.postSummary} numberOfLines={3}>{post.summary}</Text>
                  ) : null}

                  {/* Content styles — surface what kind of post this is */}
                  {(post.styles ?? []).length > 0 ? (
                    <View style={styles.postStyles}>
                      {(post.styles ?? []).slice(0, 4).map(s => (
                        <StyleChip key={s} label={s} tint={colour.glow} compact />
                      ))}
                    </View>
                  ) : null}

                  {/* Date + 4 stats: Views, Likes, Comments, Shares */}
                  <View style={styles.postMeta}>
                    {post.postDate ? (
                      <Text style={styles.postDate}>{fmtDate(post.postDate)}</Text>
                    ) : null}
                    <View style={styles.postStats}>
                      <PostStat label="Views"    value={post.views}    accentColor={colour.glow} />
                      <View style={styles.postStatDivider} />
                      <PostStat label="Likes"    value={post.likes}    accentColor={colour.glow} />
                      <View style={styles.postStatDivider} />
                      <PostStat label="Comments" value={post.comments} accentColor={colour.glow} />
                      <View style={styles.postStatDivider} />
                      <PostStat label="Shares"   value={post.shares}   accentColor={colour.glow} />
                    </View>
                  </View>

                  {/* Engagement rate strip */}
                  <View style={styles.engRow}>
                    <Text style={styles.engLabel}>ENGAGEMENT RATE</Text>
                    <Text style={[styles.engValue, { color: colour.glow }]}>
                      {post.views > 0 ? `${engRate}%` : '—'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          )}

          {/* ── CTA ──────────────────────────────────── */}
          <Pressable
            style={({ pressed }) => [
              styles.cta,
              { borderColor: colour.base, opacity: pressed ? 0.7 : 1 },
            ]}
            // @ts-ignore — web hoverStyle
            hoverStyle={Platform.OS === 'web' ? { backgroundColor: `${colour.base}22` } : undefined}
            onPress={() =>
              Linking.openURL(`https://www.tiktok.com/${politician.handle}`)
            }
          >
            <Text style={[styles.ctaText, { color: colour.glow }]}>
              OPEN TIKTOK PROFILE
            </Text>
          </Pressable>
        </ScrollView>
      </MotiView>
    </DashCard>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionKicker({ label }: { label: string }) {
  return <Text style={styles.sectionKicker}>{label.toUpperCase()}</Text>;
}

function TotalTile({
  label,
  value,
  accentColor,
  signed   = false,
  zeroDash = false,
}: {
  label:      string;
  value:      number;
  accentColor?: string;
  signed?:    boolean;
  zeroDash?:  boolean;   // show '—' instead of '0' when value is zero
}) {
  const fmt = (n: number) => {
    if (zeroDash && n === 0) return '—';
    const abs = formatters.compact(Math.abs(n));
    return signed ? (n >= 0 ? `+${abs}` : `-${abs}`) : abs;
  };
  return (
    <View style={styles.totalTile}>
      <CountUp
        value={value}
        format={fmt}
        style={[
          styles.totalValue,
          accentColor ? { color: accentColor } : null,
          zeroDash && value === 0 ? { color: neutral.textDim } : null,
        ]}
      />
      <Text style={styles.totalLabel}>{label.toUpperCase()}</Text>
    </View>
  );
}

function PostStat({
  label,
  value,
  accentColor,
}: {
  label: string;
  value: number;
  accentColor: string;
}) {
  return (
    <View style={styles.postStat}>
      <Text style={[styles.postStatValue, { color: accentColor }]}>
        {formatters.compact(value)}
      </Text>
      <Text style={styles.postStatLabel}>{label.toUpperCase()}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  partyStrip: {
    height: 3,
    width: '100%',
    opacity: 0.9,
  },
  motionWrap: {
    flex: 1,
  },
  scroll: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // Identity
  section: {
    gap: spacing.sm,
  },
  linkRow: {
    flexDirection: 'row',
    marginTop: -spacing.xs,
  },

  // Chart
  chartWrap: {
    alignItems: 'center',
    marginVertical: -spacing.sm,
    marginHorizontal: -spacing.lg,   // negate scroll container padding so chart is edge-to-edge
    paddingHorizontal: 0,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingLeft: spacing.lg,
    marginBottom: -spacing.xs,
  },
  chartHeaderTip: {
    marginTop: 3,
  },

  // Section kicker
  sectionKicker: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 12,
    marginBottom: -spacing.sm,
  },

  // Totals grid
  totalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  totalTile: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: glass.card,
    borderWidth: 1,
    borderColor: glass.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 3,
  },
  totalValue: {
    fontFamily: font.mono,
    fontSize: 20,
    fontWeight: '700',
    color: neutral.text,
    letterSpacing: -0.4,
  },
  totalLabel: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 12,
  },

  // Posts
  posts: {
    gap: spacing.sm,
  },
  postCard: {
    backgroundColor: glass.card,
    borderWidth: 1,
    borderColor: glass.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    ...Platform.select({
      web: {
        transitionProperty: 'border-color, background-color',
        transitionDuration: '160ms',
        cursor: 'pointer',
      } as any,
      default: {},
    }),
  },
  postCaptionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  postLink: {
    paddingTop: 2,
    flexShrink: 0,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  postLinkIcon: {
    fontSize: 16,
  },
  postCaption: {
    flex: 1,
    ...type.body,
    color: neutral.text,
    fontSize: 16,
    lineHeight: 18,
  },
  postSummary: {
    ...type.body,
    color: neutral.textMid,
    fontSize: 12,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  postStyles: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           4,
  },
  engRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: glass.border,
  },
  engLabel: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 12,
  },
  engValue: {
    fontFamily: font.mono,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  postDate: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 12,
    textTransform: 'none' as const,
    flexShrink: 0,
  },
  postStats: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  postStat: {
    gap: 2,
  },
  postStatValue: {
    fontFamily: font.mono,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  postStatLabel: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 12,
  },
  postStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: glass.border,
    alignSelf: 'flex-end',
    marginBottom: 2,
  },

  // Empty posts state
  emptyPosts: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs,
    alignItems: 'center',
  },
  emptyPostsText: {
    ...type.body,
    color: neutral.textMid,
    fontSize: 12,
    textAlign: 'center',
  },
  emptyPostsSub: {
    ...type.body,
    color: neutral.textDim,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },

  // CTA
  cta: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...Platform.select({
      web: {
        transitionProperty: 'background-color',
        transitionDuration: '160ms',
        cursor: 'pointer',
      } as any,
      default: {},
    }),
  },
  ctaText: {
    ...type.caption,
    fontSize: 12,
  },
});
