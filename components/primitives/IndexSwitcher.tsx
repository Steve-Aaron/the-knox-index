import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTenant } from '@/hooks/useTenant';
import { track } from '@/lib/analytics';
import { TENANTS, type TenantConfig } from '@/lib/tenants';
import { accent, glass, neutral } from '@/theme/colors';
import { font } from '@/theme/typography';

/**
 * IndexSwitcher
 * --------------
 * A small segmented bar beside the Knox logo: one segment per index (UK,
 * World Leaders). The current index is highlighted; the others open that
 * index's home page on its own subdomain. Locally there is only localhost,
 * so it switches with ?tenant=<dashboard id> instead (see lib/devTenant.ts).
 *
 * Web only: each index is a separate host, which native does not have.
 *
 * One job: move between the indexes.
 */
interface Props {
  compact?: boolean;
}

function homeUrl(t: TenantConfig): string {
  if (process.env.NODE_ENV !== 'production') {
    return `${window.location.origin}/?tenant=${t.dashboardId}`;
  }
  return `https://${t.hosts[0]}/`;
}

export function IndexSwitcher({ compact = false }: Props) {
  const current = useTenant();
  if (Platform.OS !== 'web' || TENANTS.length < 2) return null;

  const open = (t: TenantConfig) => {
    if (t.id === current.id) return;
    try { track('index_switched', { from_tenant: current.dashboardId, to_tenant: t.dashboardId }); } catch { /* never block navigation */ }
    window.location.assign(homeUrl(t));
  };

  return (
    <View style={styles.bar} accessibilityRole="tablist">
      {TENANTS.map(t => {
        const active = t.id === current.id;
        return (
          <Pressable
            key={t.id}
            onPress={() => open(t)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${t.brand.switcherLabel} index`}
            style={({ hovered }: any) => [
              styles.seg,
              compact && styles.segCompact,
              active && styles.segActive,
              !active && hovered && styles.segHover,
            ]}
          >
            <Text style={[styles.label, compact && styles.labelCompact, active && styles.labelActive]} numberOfLines={1}>
              {compact ? t.brand.switcherLabelShort : t.brand.switcherLabel}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection:   'row',
    alignItems:      'center',
    padding:         3,
    gap:             2,
    borderRadius:    999,
    borderWidth:     1,
    borderColor:     glass.border,
    backgroundColor: glass.fill,
  },
  seg: {
    paddingVertical:   6,
    paddingHorizontal: 14,
    borderRadius:      999,
    ...Platform.select({
      web: { cursor: 'pointer', transitionProperty: 'background-color', transitionDuration: '160ms' } as any,
      default: {},
    }),
  },
  segCompact: {
    paddingVertical:   5,
    paddingHorizontal: 9,
  },
  segActive: {
    backgroundColor: 'rgba(95,100,189,0.28)',
    ...Platform.select({ web: { cursor: 'default' } as any, default: {} }),
  },
  segHover: {
    backgroundColor: glass.fillHi,
  },
  label: {
    fontFamily:    font.bold,
    fontWeight:    '700',
    fontSize:      11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color:         neutral.textMid,
  },
  labelCompact: {
    fontSize:      10,
    letterSpacing: 0.5,
  },
  labelActive: {
    color: neutral.text,
  },
});
