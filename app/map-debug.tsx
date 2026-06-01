import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { HeaderNav } from '@/components/primitives/HeaderNav';
import { MapNudger } from '@/components/dashboard/MapNudger';

/**
 * Map Debug screen — /map-debug
 * ------------------------------
 * Dev-only tool for nudging UK marker coordinates by pixel-precise steps.
 * NOT linked from the main nav — only accessible by typing /map-debug.
 *
 * See components/dashboard/MapNudger.tsx for the workflow. Once positions
 * are perfect, copy the TypeScript output and paste it over the array in
 * lib/uk-locations.ts.
 */

export default function MapDebugScreen() {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#1F1D1D', '#1F1D1D', '#35393B']}
        locations={[0, 0.75, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <HeaderNav />
        <MapNudger />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
});
