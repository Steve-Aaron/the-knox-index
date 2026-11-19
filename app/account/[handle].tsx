import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { TenantGate } from '@/components/auth/TenantGate';
import { AccountScreen } from '@/components/account/AccountScreen';
import { DevPanel } from '@/components/primitives/DevPanel';
import { HeaderNav } from '@/components/primitives/HeaderNav';
import { brand } from '@/theme/colors';

/**
 * Account page — /account/[handle]
 * ----------------------------------
 * Route shell only: page background, header, tenant gate. The page itself
 * lives in components/account/AccountScreen; data comes from
 * /api/account-page via data/account/useAccountPage.ts.
 */
function AccountPageInner() {
  const { handle } = useLocalSearchParams<{ handle: string }>();

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={brand.productGradient as unknown as [string, string, string]}
        locations={brand.productGradientLocations as unknown as [number, number, number]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea}>
        <HeaderNav />
        <AccountScreen handle={handle} />
      </SafeAreaView>
      <DevPanel />
    </View>
  );
}

/** Gated tenants show the sign-in / approval door instead of the account. */
export default function AccountPage() {
  return (
    <TenantGate>
      <AccountPageInner />
    </TenantGate>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: brand.black,
  },
  safeArea: {
    flex: 1,
  },
});
