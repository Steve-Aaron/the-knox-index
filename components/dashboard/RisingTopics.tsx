import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DashCard } from '@/components/primitives/DashCard';
import { DevLabel } from '@/components/primitives/DevLabel';
import { Kicker } from '@/components/ui/Kicker';
import { Title } from '@/components/ui/Title';
import { accent, neutral, secondary } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { font, type } from '@/theme/typography';
import type { RisingTopic } from '@/lib/rising';

/**
 * RisingTopics
 * -------------
 * The topics picking up fastest against the period before: the big topics
 * are always the most talked about, so this ranks by growth instead of size.
 * Each row shows the post count then and now, and how many times larger it
 * is ('New' when it had no posts before).
 *
 * One job: list the fastest-rising topics.
 */
interface Props {
  rising:      RisingTopic[];
  rangeLabel?: string;
  /** 'vs previous 7 days' etc. */
  prevLabel?:  string;
}

/** 'COST_OF_LIVING' → 'Cost of living'. */
function label(name: string): string {
  const words = name.replace(/_/g, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function growth(t: RisingTopic): string {
  if (t.ratio == null) return 'New';
  return t.ratio >= 10 ? `×${Math.round(t.ratio)}` : `×${t.ratio.toFixed(1)}`;
}

export function RisingTopics({ rising, rangeLabel, prevLabel }: Props) {
  const maxCur = Math.max(1, ...rising.map(t => t.cur));

  return (
    <DashCard
      style={styles.wrap}
      infoText="Topics with the biggest rise in posts against the period before, using each post's most specific topic. A topic needs at least 8 posts this period and 5 more than before. Ranked by how many times larger it is. 'New' means it had no posts in the period before."
      infoTitle="Rising topics"
    >
      <DevLabel name="RisingTopics" />

      <View>
        <Kicker tone='dim'>RISING TOPICS{rangeLabel ? ` · ${rangeLabel.toUpperCase()}` : ''}</Kicker>
        <Title style={{ fontSize: 16, marginTop: 2 }}>What's picking up?</Title>
        {prevLabel ? <Text style={styles.hint}>{prevLabel}</Text> : null}
      </View>

      {rising.length === 0 ? (
        <Text style={styles.empty}>Nothing is rising sharply against the period before.</Text>
      ) : (
        <View style={styles.list}>
          {rising.map((t, i) => (
            <View key={t.label} style={styles.row}>
              <Text style={styles.rank}>{i + 1}</Text>
              <View style={styles.body}>
                <View style={styles.line}>
                  <Text style={styles.name} numberOfLines={1}>{label(t.label)}</Text>
                  <Text style={[styles.badge, t.ratio == null && styles.badgeNew]}>{growth(t)}</Text>
                </View>
                <View style={styles.track}>
                  {/* last period's posts in grey, the rise on top in the accent */}
                  <View style={[styles.fill, styles.prevFill, { width: `${(t.prev / maxCur) * 100}%` }]} />
                  <View style={[styles.fill, styles.curFill, { left: `${(t.prev / maxCur) * 100}%`, width: `${((t.cur - t.prev) / maxCur) * 100}%` }]} />
                </View>
                <Text style={styles.counts}>{t.prev} → {t.cur} posts</Text>
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
