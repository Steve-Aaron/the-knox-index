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
import { GlassSurface } from '@/components/primitives/GlassSurface';
import { DevLabel } from '@/components/primitives/DevLabel';
import { CardHeader } from '@/components/card/CardHeader';
import { RadialScoreChart, RawScoreValues } from '@/components/card/RadialScoreChart';
import { LinkPill } from '@/components/primitives/LinkPill';
import { InfoTip } from '@/components/primitives/InfoTip';
import { CountUp, formatters } from '@/components/primitives/CountUp';
import { FollowerQualityFlag } from './FollowerQualityFlag';
import { neutral, party, glass } from '@/theme/colors';
import { font } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { type } from '@/theme/typography';
import type { Politician, ScoreKey } from '@/data/types';

/**
 * PoliticianDetailPanel
 * ----------------------
 * Right-side panel that surfaces the full detail view for the currently
 * selected politician: identity, radar chart, account totals, recent posts,
 * and a TikTok CTA. Animates in with a slide+fade whenever the active
 * politician changes. One job.
 */
interface Props {
  politician: Politician;
  headlineKey: ScoreKey;
  panelHeight?: number;
}

export function PoliticianDetailPanel({ politician, headlineKey, panelHeight }: Props) {
  const colour = party[politician.partyKey];

  // Raw values shown in the dot-hover popup on the radar chart.
  // Engagement uses yesterday's likes+comments+saves / yesterday's views
  // so the figure reflects current performance, not lifetime totals.
  const avgViews = politician.recentPosts.length > 0
    ? Math.round(politician.recentPosts.reduce((s, p) => s + p.views, 0) / politician.recentPosts.length)
    : 0;

  const rawValues: RawScoreValues = {
    views:      avgViews,
    frequency:  politician.totals.postsThisWeek,
    engagement: politician.totals.views24h > 0
      ? ((politician.totals.likesToday + politician.totals.commentsToday + politician.totals.savesToday)
          / politician.totals.views24h) * 100
      : 0,
    followers:  politician.totals.followers,
    knoxFactor: politician.scores.knoxFactor,
  };

  const wrapStyle = {
    flex: 1 as const,
    overflow: 'hidden' as const,
    ...(panelHeight != null ? { height: panelHeight } : {}),
  };

  return (
    <GlassSurface
      style={wrapStyle}
      radius={radius.lg}
    >
      <DevLabel name="PoliticianDetailPanel" />
      {/* Horizontal party-colour strip along the top */}
      <View style={[styles.partyStrip, { backgroundColor: colour.base }]} />

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
          <View style={styles.section}>
            <CardHeader
              name={politician.name}
              role={'On the ' + politician.role.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase())}
              partyLabel={'Associated with ' + politician.partyLabel}
              partyKey={politician.partyKey}
              initials={politician.avatarInitials}
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
          <View style={styles.chartWrap}>
            <View style={styles.chartHeader}>
              <SectionKicker label="Performance radar" />
              <InfoTip
                text="Each point on this chart is scored 0–100 relative to the best performer in the dataset. Hover any point to see the raw number. Knox Factor is the average of all five axes."
                width={260}
              />
            </View>
            <RadialScoreChart
              scores={politician.scores}
              partyKey={politician.partyKey}
              highlightKey={headlineKey}
              rawValues={rawValues}
              size={300}
            />
          </View>

          {/* ── Audience quality flag ────────────────── */}
          <FollowerQualityFlag politician={politician} />

          {/* ── Account totals ───────────────────────── */}
          <SectionKicker label="Account totals" />
          <View style={styles.totalsGrid}>
            <TotalTile label="Posts" value={politician.totals.posts} />
            <TotalTile label="Followers" value={politician.totals.followers} />
            <TotalTile label="Total likes" value={politician.totals.likes} />
            <TotalTile
              label="Avg views / post"
              value={avgViews}
              accentColor={colour.glow}
              zeroDash
            />
          </View>

          {/* ── Yesterday's activity ─────────────────── */}
          <SectionKicker label="Yesterday" />
          <View style={styles.totalsGrid}>
            <TotalTile label="Views"    value={politician.totals.views24h}      accentColor={colour.glow} zeroDash />
            <TotalTile label="Likes"    value={politician.totals.likesToday}     accentColor={colour.glow} zeroDash />
            <TotalTile label="Comments" value={politician.totals.commentsToday}  accentColor={colour.glow} zeroDash />
            <TotalTile label="Saves"    value={politician.totals.savesToday}     accentColor={colour.glow} zeroDash />
          </View>

          {/* ── Recent posts ─────────────────────────── */}
          <SectionKicker label="Recent posts" />
          {politician.recentPosts.length === 0 ? (
            <View style={styles.emptyPosts}>
              <Text style={styles.emptyPostsText}>No posts recorded for this account.</Text>
              <Text style={styles.emptyPostsSub}>They may not have posted recently or their content isn't being tracked yet.</Text>
            </View>
          ) : (
          <View style={styles.posts}>
            {politician.recentPosts.map(post => {
              const engRate = post.views > 0
                ? +(((post.likes + post.comments + post.shares) / post.views) * 100).toFixed(2)
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
                            style: { color: colour.glow, fontSize: 13, flexShrink: 0, marginTop: 2 },
                          })
                        : <Text style={[styles.postLinkIcon, { color: colour.glow }]}>↗</Text>
                      : null}
                  </View>

                  {/* AI summary — falls back to nothing when missing so the layout stays tight */}
                  {post.summary ? (
                    <Text style={styles.postSummary} numberOfLines={3}>{post.summary}</Text>
                  ) : null}

                  {/* Date + 4 stats: Views, Likes, Comments, Shares */}
                  <View style={styles.postMeta}>
                    {post.postDate ? (
                      <Text style={styles.postDate}>{post.postDate.slice(0, 10)}</Text>
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
    </GlassSurface>
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
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingLeft: spacing.xs,
    marginBottom: -spacing.xs,
  },

  // Section kicker
  sectionKicker: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 9,
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
    backgroundColor: glass.fill,
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
    fontSize: 9,
  },

  // Posts
  posts: {
    gap: spacing.sm,
  },
  postCard: {
    backgroundColor: glass.fill,
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
    fontSize: 13,
  },
  postCaption: {
    flex: 1,
    ...type.body,
    color: neutral.text,
    fontSize: 13,
    lineHeight: 18,
  },
  postSummary: {
    ...type.body,
    color: neutral.textMid,
    fontSize: 11,
    lineHeight: 16,
    fontStyle: 'italic',
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
    fontSize: 9,
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
    fontSize: 9,
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
    fontSize: 9,
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
    fontSize: 11,
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
    fontSize: 11,
  },
});
