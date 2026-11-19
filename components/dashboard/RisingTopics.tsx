import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { DashCard } from '@/components/primitives/DashCard';
import { DevLabel } from '@/components/primitives/DevLabel';
import { Kicker } from '@/components/ui/Kicker';
import { Title } from '@/components/ui/Title';
import { accent, glass, neutral, secondary } from '@/theme/colors';
import { fmtCount } from '@/lib/format';
import { fmtTopic } from '@/lib/topicLabel';
import { track } from '@/lib/analytics';
import { spacing, radius } from '@/theme/spacing';
import { font, type } from '@/theme/typography';
import type { RisingTopic } from '@/lib/rising';

/**
 * RisingTopics
 * -------------
 * The topics picking up fastest against the period before: the big topics
 * are always the most talked about, so this ranks by growth instead of size.
 * Two modes: Volume (how much more a topic is being posted about) and Impact
 * (how much harder each post on it is landing: average views per post). Each row shows the
 * figure then and now, and how many times larger it is ('New' when there was
 * nothing before).
 *
 * One job: list the fastest-rising topics.
 */
type Mode = 'posts' | 'impact';

const MODES: { key: Mode; label: string }[] = [
  { key: 'posts',  label: 'VOLUME' },
  { key: 'impact', label: 'IMPACT' },
];

const INFO: Record<Mode, string> = {
  posts: "Topics with the biggest rise in posts against the period before, using each post's most specific topic. A topic needs at least 8 posts this period and 5 more than before. Ranked by how many times larger it is. 'New' means it had no posts in the period before.",
  impact: "Topics whose posts are landing harder than before: average views per post this period against the period before. This is apart from how much a topic is posted about. A topic needs at least 8 posts this period and 5 in the period before, and an average at least 1.3 times higher. Newer posts have had less time to gather views, so a rise here is if anything understated.",
};

interface Props {
  rising:      RisingTopic[];
  /** Topics ranked by the rise in average views per post. */
  risingImpact: RisingTopic[];
  rangeLabel?: string;
  /** 'vs previous 7 days' etc. */
  prevLabel?:  string;
}

function growth(t: RisingTopic): string {
  if (t.ratio == null) return 'New';
  return t.ratio >= 10 ? `×${Math.round(t.ratio)}` : `×${t.ratio.toFixed(1)}`;
}

export function RisingTopics({ rising: byPosts, risingImpact, rangeLabel, prevLabel }: Props) {
  const [mode, setMode] = useState<Mode>('posts');
  const rising = mode === 'posts' ? byPosts : risingImpact;
  const maxCur = Math.max(1, ...rising.map(t => t.cur));

  const pick = (next: Mode) => {
    if (next === mode) return;
    try { track('rising_topics_mode_changed', { mode: next, old_mode: mode }); } catch {}
    setMode(next);
  };

  return (
    <DashCard
      style={styles.wrap}
      infoText={INFO[mode]}
      infoTitle="Rising topics"
    >
      <DevLabel name="RisingTopics" />

      <View>
        <Kicker tone='dim'>RISING TOPICS{rangeLabel ? ` · ${rangeLabel.toUpperCase()}` : ''}</Kicker>
        <Title style={{ fontSize: 16, marginTop: 2 }}>
          {mode === 'posts' ? "What's picking up?" : "What's landing harder?"}
        </Title>
        <Text style={styles.hint}>
          {mode === 'posts' ? 'Posts on each topic' : 'Average views per post'}{prevLabel ? `, ${prevLabel.charAt(0).toLowerCase()}${prevLabel.slice(1)}` : ''}
        </Text>
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

      {rising.length === 0 ? (
        <Text style={styles.empty}>
          {mode === 'posts' ? 'Nothing is rising sharply against the period before.' : 'No topic is landing much harder per post than the period before.'}
        </Text>
      ) : (
        <View style={styles.list}>
          {rising.map((t, i) => (
            <View key={t.label} style={styles.row}>
              <Text style={styles.rank}>{i + 1}</Text>
              <View style={styles.body}>
                <View style={styles.line}>
                  <Text style={styles.name} numberOfLines={1}>{fmtTopic(t.label)}</Text>
                  <Text style={[styles.badge, t.ratio == null && styles.badgeNew]}>{growth(t)}</Text>
                </View>
                <View style={styles.track}>
                  {/* last period's posts in grey, the rise on top in the accent */}
                  <View style={[styles.fill, styles.prevFill, { width: `${(t.prev / maxCur) * 100}%` }]} />
                  <View style={[styles.fill, styles.curFill, { left: `${(t.prev / maxCur) * 100}%`, width: `${((t.cur - t.prev) / maxCur) * 100}%` }]} />
                </View>
                <Text style={styles.counts}>
                  {mode === 'posts'
                    ? `${t.prev} → ${t.cur} posts`
                    : `${fmtCount(Math.round(t.prev))} → ${fmtCount(Math.round(t.cur))} views per post · ${t.posts ?? 0} posts`}
                </Text>
              </View>
            </View>
          ))}
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
  hint: {
    ...type.body,
    fontSize:  12,
    color:     neutral.textDim,
    marginTop: 2,
  },
  empty: {
    ...type.body,
    fontSize: 13,
    color:    neutral.textMid,
  },
  list: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           spacing.sm,
  },
  rank: {
    fontFamily: font.mono,
    fontSize:   12,
    color:      neutral.textDim,
    width:      18,
    paddingTop: 2,
  },
  body: {
    flex: 1,
    gap:  4,
  },
  line: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            spacing.sm,
  },
  name: {
    ...type.body,
    fontSize:   14,
    color:      neutral.text,
    flexShrink: 1,
  },
  badge: {
    fontFamily:        font.mono,
    fontSize:          12,
    color:             accent.indigo,
    paddingHorizontal: 6,
    paddingVertical:   1,
    borderRadius:      radius.sm,
    backgroundColor:   'rgba(95,100,189,0.18)',
    overflow:          'hidden',
  },
  badgeNew: {
    color:           secondary.lilac,
    backgroundColor: 'rgba(202,193,228,0.12)',
  },
  track: {
    height:          4,
    borderRadius:    2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow:        'hidden',
    position:        'relative',
  },
  fill: {
    position: 'absolute',
    top:      0,
    bottom:   0,
  },
  prevFill: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  curFill: {
    backgroundColor: accent.indigo,
  },
  counts: {
    fontFamily: font.mono,
    fontSize:   11,
    color:      neutral.textDim,
  },
});
