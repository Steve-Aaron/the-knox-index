import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CardAvatar } from '@/components/card/CardAvatar';
import { AccountWidget } from '@/components/account/layout/AccountWidget';
import { colourFor, neutral } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { type } from '@/theme/typography';
import type { AccountProfile } from '@/data/account/types';
import { KnoxFactorScore } from './KnoxFactorScore';
import { AffiliationPanel } from './AffiliationPanel';
import { SocialLinks } from './SocialLinks';

/**
 * ProfileCard
 * ------------
 * Left-column identity widget: avatar, name, role, Knox Factor, affiliation,
 * social links and time since the last post.
 *
 * One job: compose the profile sub-components.
 */
interface Props {
  profile: AccountProfile;
  height?: number;
}

const DAY_MS = 86_400_000;

function lastPostCopy(iso: string): string {
  const days = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / DAY_MS));
  if (days === 0) return 'Posted today';
  return `${days} ${days === 1 ? 'day' : 'days'} since the last post`;
}

export function ProfileCard({ profile, height }: Props) {
  const { politician } = profile;
  const colour = colourFor(politician.groupKey);

  return (
    <AccountWidget height={height}>
      <View style={styles.identity}>
        <CardAvatar
          groupKey={politician.groupKey}
          initials={politician.avatarInitials}
          avatarUrl={politician.avatarUrl}
          size={160}
        />
        <View style={styles.nameBlock}>
          <Text style={styles.name} numberOfLines={2}>{politician.name}</Text>
          <Text style={styles.role} numberOfLines={2}>{politician.displayJobTitle}</Text>
        </View>
      </View>

      <KnoxFactorScore knoxFactor={profile.knoxFactor} color={colour.glow} />

      <View style={styles.spacer} />

      <AffiliationPanel affiliation={profile.affiliation} color={colour.glow} />
      <SocialLinks socials={profile.socials} />
      <Text style={styles.lastPost}>{lastPostCopy(profile.lastPostAt)}</Text>
    </AccountWidget>
  );
}

const styles = StyleSheet.create({
  identity: {
    alignItems: 'center',
    gap:        spacing.md,
  },
  nameBlock: {
    alignItems: 'center',
    gap:        spacing.xs,
  },
  name: {
    ...type.title,
    color:     neutral.text,
    textAlign: 'center',
  },
  role: {
    ...type.body,
    fontSize:  15,
    color:     neutral.textMid,
    textAlign: 'center',
  },
  // Pushes the affiliation block to the bottom when the card has a fixed height.
  spacer: {
    flexGrow: 1,
  },
  lastPost: {
    ...type.body,
    fontSize:  12,
    color:     neutral.textMid,
    textAlign: 'center',
  },
});
