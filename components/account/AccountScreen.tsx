import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAccountPage } from '@/data/account/useAccountPage';
import type { AccountPlatform, TimeRange } from '@/data/account/types';
import { AppFooter } from '@/components/dashboard/AppFooter';
import { DevLabel } from '@/components/primitives/DevLabel';
import { PageContainer } from '@/components/primitives/PageContainer';
import { neutral } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { type } from '@/theme/typography';
import { AccountPageHeader } from './AccountPageHeader';
import { ACCOUNT_LAYOUT, useAccountLayout } from './layout/accountLayout';
import { ProfileCard } from './profile/ProfileCard';
import { KeyStatsCard } from './keyStats/KeyStatsCard';
import { OverviewPanel } from './overview/OverviewPanel';
import { PerformanceCard } from './performance/PerformanceCard';
import { ContentCard } from './content/ContentCard';
import { BestPostsCard } from './posts/BestPostsCard';

/**
 * AccountScreen
 * --------------
 * Full account page for one handle. Owns the page-level filters (range,
 * platform), pulls data once, and lays the widgets out per breakpoint:
 *
 *   desktop  side column (profile, key stats) | main column (overview,
 *            performance + content side by side, best posts)
 *   tablet   profile + key stats in a row, everything else stacked
 *   mobile   single column
 *
 * One job: layout + filter state. Widgets render their own content.
 */
interface Props {
  handle: string | undefined;
}

export function AccountScreen({ handle }: Props) {
  const [range, setRange] = useState<TimeRange>('yesterday');
  const [platform, setPlatform] = useState<AccountPlatform>('all');
  const { data, loading, error, notFound } = useAccountPage(handle, range, platform);
  const { isDesktop, isTablet, isMobile, widgetHeight } = useAccountLayout();

  if (notFound) return <NotFound handle={handle ?? ''} />;
  if (!data) {
    return (
      <Message
        title={loading ? 'Loading account…' : 'Could not load this account'}
        sub={loading ? undefined : error ?? undefined}
      />
    );
  }

  const { profile, keyStats, period } = data;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.scroll, isMobile && styles.scrollMobile]}
    >
      <PageContainer style={styles.page}>
        <DevLabel name="AccountScreen" />
        <AccountPageHeader />

        <View style={[styles.stack, isDesktop && styles.row]}>
          {/* ── Side column ─────────────────────────────── */}
          <View style={[styles.stack, isDesktop && styles.side, isTablet && styles.row]}>
            <View style={isTablet ? styles.half : undefined}>
              <ProfileCard profile={profile} height={widgetHeight} />
            </View>
            <View style={isTablet ? styles.half : undefined}>
              <KeyStatsCard stats={keyStats} />
            </View>
          </View>

          {/* ── Main column ─────────────────────────────── */}
          <View style={[styles.stack, isDesktop && styles.main]}>
            <OverviewPanel
              range={range}
              onRangeChange={setRange}
              platform={platform}
              onPlatformChange={setPlatform}
              platforms={data.platforms}
              kpis={period.kpis}
              compact={isMobile}
            />

            <View style={[styles.stack, isDesktop && styles.row]}>
              <PerformanceCard
                radar={period.radar}
                politician={profile.politician}
                height={widgetHeight}
                style={isDesktop ? styles.half : undefined}
              />
              <ContentCard
                content={period.content}
                range={range}
                height={widgetHeight}
                style={isDesktop ? styles.half : undefined}
              />
            </View>

            <BestPostsCard
              posts={period.posts}
              politician={profile.politician}
              socials={profile.socials}
              benchmarks={data.postBenchmarks ?? undefined}
            />
          </View>
        </View>

        {/* Same site footer as the dashboard */}
        <View style={styles.footer}>
          <AppFooter />
        </View>
      </PageContainer>
    </ScrollView>
  );
}

function NotFound({ handle }: { handle: string }) {
  return <Message title="Account not found" sub={`No account exists for @${handle.replace(/^@/, '')}`} />;
}

function Message({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={styles.notFound}>
      <Text style={styles.notFoundTitle}>{title}</Text>
      {sub ? <Text style={styles.notFoundSub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingTop:        spacing.xl,
    paddingBottom:     spacing.xxxl,
    paddingHorizontal: spacing.xxxl,
  },
  scrollMobile: {
    paddingHorizontal: spacing.base,
  },
  page: {
    gap: spacing.xl,
  },
  footer: {
    marginTop: spacing.xxl,
  },
  stack: {
    gap: ACCOUNT_LAYOUT.gap,
  },
  row: {
    flexDirection: 'row',
    alignItems:    'flex-start',
  },
  side: {
    flex:     ACCOUNT_LAYOUT.sideFlex,
    minWidth: 0,
  },
  main: {
    flex:     ACCOUNT_LAYOUT.mainFlex,
    minWidth: 0,
  },
  half: {
    flex:     1,
    minWidth: 0,
  },
  notFound: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing.md,
    padding:        spacing.xl,
  },
  notFoundTitle: {
    ...type.title,
    color: neutral.text,
  },
  notFoundSub: {
    ...type.body,
    fontSize: 14,
    color:    neutral.textMid,
  },
});
