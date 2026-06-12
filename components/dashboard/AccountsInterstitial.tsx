import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  Linking,
} from 'react-native';
import { MotiView } from 'moti';
import { Kicker } from '@/components/ui/Kicker';
import { Title } from '@/components/ui/Title';
import { neutral, glass, accent, party } from '@/theme/colors';
import type { PartyKey } from '@/theme/colors';
import { font } from '@/theme/typography';
import { type } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { formatters } from '@/components/primitives/CountUp';
import { DevLabel } from '@/components/primitives/DevLabel';
import type { Politician } from '@/data/types';

/**
 * AccountsInterstitial
 * ---------------------
 * Full-screen modal listing every tracked TikTok account sorted by followers.
 * Shows name, handle, party, followers, total posts, and engagement rate.
 * Tapping a row opens the TikTok profile. Refresh button at the foot triggers
 * a live data refresh and closes the modal.
 *
 * One job: give the user transparency over exactly who is being tracked.
 */

interface Props {
  politicians: Politician[];
  onClose:     () => void;
  onRefresh:   () => void;
}

function tiktokUrl(handle: string): string {
  // handle is stored as "@username" — TikTok URL is tiktok.com/@username
  const clean = handle.startsWith('@') ? handle : `@${handle}`;
  return `https://www.tiktok.com/${clean}`;
}

/**
 * Engagement rate as a percentage. Prefers the range-aware aggregates from
 * the post table (always populated when posts exist in the range, includes
 * shares), and falls back to today's accountMetrics snapshot if the range
 * aggregates are empty.
 *
 * Was previously hard-coded to views24h / likesToday, which returns 0 for
 * any account whose daily accountMetrics row hasn't been ingested yet — that
 * was the cause of the empty 'Eng %' column.
 */
function engagementRate(p: Politician): number {
  const t = p.totals;
  if (t.viewsInRange > 0) {
    const numerator = t.likesInRange + t.commentsInRange + t.savesInRange + t.sharesInRange;
    return (numerator / t.viewsInRange) * 100;
  }
  if (t.views24h > 0) {
    const numerator = t.likesToday + t.commentsToday + t.savesToday;
    return (numerator / t.views24h) * 100;
  }
  return 0;
}

export function AccountsInterstitial({ politicians, onClose, onRefresh }: Props) {
  const sorted = useMemo(
    () => [...politicians].sort((a, b) => b.totals.followers - a.totals.followers),
    [politicians]
  );

  // Per-row follower counts still render in each account row below — only the
  // header's combined total has been removed at the user's request.

  const handleRefresh = useCallback(() => {
    onRefresh();
    onClose();
  }, [onRefresh, onClose]);

  const openTikTok = useCallback((p: Politician) => {
    Linking.openURL(tiktokUrl(p.handle));
  }, []);

  return (
    /* ── Backdrop ───────────────────────────────────────────────── */
    <View style={styles.backdrop}>
      <DevLabel name="AccountsInterstitial" />
      <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />

      {/* ── Sheet ───────────────────────────────────────────────── */}
      <MotiView
        from={{ opacity: 0, translateY: 24 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 260 }}
        style={styles.sheet}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Kicker style={{ letterSpacing: 1.2 }}>TRACKED ACCOUNTS</Kicker>
            <Title style={{ fontSize: 16, letterSpacing: -0.3 }}>
              {sorted.length} politicians
            </Title>
          </View>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        {/* Column headers */}
        <View style={styles.colHeaders}>
          <Text style={[styles.colHead, styles.colName]} numberOfLines={1}>Account</Text>
          <Text style={[styles.colHead, styles.colStat]} numberOfLines={1}>Followers</Text>
          <Text style={[styles.colHead, styles.colStat]} numberOfLines={1}>Posts</Text>
          <Text style={[styles.colHead, styles.colStat]} numberOfLines={1}>Eng %</Text>
        </View>

        {/* Scrollable account list */}
        <ScrollView
          style={styles.list}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        >
          {sorted.map((p, i) => {
            const colour = party[p.partyKey as PartyKey];
            const eng    = engagementRate(p);
            return (
              <MotiView
                key={p.id}
                from={{ opacity: 0, translateX: -6 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ type: 'timing', duration: 220, delay: Math.min(i * 18, 400) }}
              >
                <Pressable
                  onPress={() => openTikTok(p)}
                  style={({ pressed, hovered }: any) => [
                    styles.row,
                    hovered && styles.rowHovered,
                    pressed && { opacity: 0.7 },
                  ]}
                  accessibilityRole="link"
                  accessibilityLabel={`Open ${p.name} on TikTok`}
                >
                  {/* Party dot */}
                  <View style={[styles.partyDot, { backgroundColor: colour.base }]} />

                  {/* Name + handle */}
                  <View style={styles.colName}>
                    <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.handle} numberOfLines={1}>{p.handle}</Text>
                  </View>

                  {/* Followers */}
                  <Text style={[styles.stat, styles.colStat, { color: colour.glow }]}>
                    {formatters.compact(p.totals.followers)}
                  </Text>

                  {/* Total posts */}
                  <Text style={[styles.stat, styles.colStat]}>
                    {p.totals.posts.toLocaleString()}
                  </Text>

                  {/* Engagement rate */}
                  <Text style={[styles.stat, styles.colStat]}>
                    {eng > 0 ? `${eng.toFixed(1)}%` : '—'}
                  </Text>

                  {/* TikTok arrow */}
                  <Text style={styles.arrow}>↗</Text>
                </Pressable>
              </MotiView>
            );
          })}
        </ScrollView>

        {/* Footer — refresh */}
        <View style={styles.footer}>
          <Pressable
            onPress={handleRefresh}
            style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.refreshBtnText}>↻  Refresh data</Text>
          </Pressable>
        </View>
      </MotiView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...Platform.select({
      web:     { position: 'fixed' } as any,
      default: { position: 'absolute' },
    }),
    top:             0,
    left:            0,
    right:           0,
    bottom:          0,
    zIndex:          9000,
    backgroundColor: 'rgba(4,4,10,0.82)',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         spacing.lg,
  },

  sheet: {
    width:           '100%',
    maxWidth:        680,
    maxHeight:       '88%' as any,
    backgroundColor: '#1F1D1D',
    borderWidth:     1,
    borderColor:     glass.border,
    borderRadius:    radius.xl,
    overflow:        'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 32px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(95,100,189,0.12)',
      } as any,
      default: {
        shadowColor:   '#000',
        shadowOpacity: 0.8,
        shadowRadius:  40,
        shadowOffset:  { width: 0, height: 16 },
        elevation:     32,
      },
    }),
  },

  // Header
  header: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    justifyContent:  'space-between',
    padding:         spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: glass.border,
    gap:             spacing.md,
  },
  headerLeft: {
    flex: 1,
    gap:  4,
  },
  closeBtn: {
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth:     1,
    borderColor:     glass.border,
    alignItems:      'center',
    justifyContent:  'center',
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  closeBtnText: {
    fontFamily: font.bold,
    fontSize:   12,
    color:      neutral.textDim,
    lineHeight: 12,
  },

  // Column headers
  colHeaders: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: glass.border,
    backgroundColor:   'rgba(255,255,255,0.02)',
    gap:               spacing.sm,
  },
  colHead: {
    ...type.caption,
    fontSize:  12,
    color:     neutral.textDim,
    letterSpacing: 0.8,
  },

  // List
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    gap:               2,
  },

  // Row
  row: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius:    radius.md,
    gap:             spacing.sm,
    ...Platform.select({
      web: { cursor: 'pointer', transitionProperty: 'background-color', transitionDuration: '120ms' } as any,
      default: {},
    }),
  },
  rowHovered: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  partyDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
    flexShrink:   0,
  },

  // Name column
  colName: {
    flex:    1,
    minWidth: 0,
    gap:     1,
  },
  name: {
    fontFamily: font.bold,
    fontSize:   16,
    color:      neutral.text,
  },
  handle: {
    fontFamily: font.ui,
    fontSize:   12,
    color:      neutral.textDim,
  },

  // Stat columns
  colStat: {
    width:     74,
    textAlign: 'right' as const,
  },
  stat: {
    fontFamily: font.mono,
    fontSize:   12,
    color:      neutral.textMid,
  },

  // TikTok link arrow
  arrow: {
    fontFamily: font.bold,
    fontSize:   12,
    color:      neutral.textDim,
    marginLeft: 2,
    ...Platform.select({ web: { opacity: 0.5 } as any, default: {} }),
  },

  // Footer
  footer: {
    padding:         spacing.lg,
    borderTopWidth:  1,
    borderTopColor:  glass.border,
  },
  refreshBtn: {
    backgroundColor:  'rgba(95,100,189,0.14)',
    borderWidth:      1,
    borderColor:      'rgba(95,100,189,0.35)',
    borderRadius:     radius.pill,
    paddingVertical:  spacing.md,
    alignItems:       'center',
    justifyContent:   'center',
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  refreshBtnText: {
    fontFamily:    font.bold,
    fontSize:      16,
    color:         accent.indigo,
    letterSpacing: 0.2,
  },
});
