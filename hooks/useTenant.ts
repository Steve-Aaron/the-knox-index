/**
 * hooks/useTenant.ts
 * -------------------
 * Client-side tenant resolution from the browser's own hostname.
 *
 * Web: window.location.hostname decides, so one deployment serves every
 * subdomain with no build-time switch.
 * Native: there is no host, so EXPO_PUBLIC_TENANT (or the default) decides.
 *
 * Data is NOT trusted to this value — every API route re-resolves the tenant
 * from the request Host header server-side. This hook only drives copy,
 * grouping and which map renders.
 *
 * One job: tell the UI which tenant it is rendering.
 */

import { Platform } from 'react-native';
import { tenantById, DEFAULT_TENANT, type TenantConfig } from '@/lib/tenants';
import { currentIndex } from '@/lib/indexPaths';

/**
 * Synchronous resolution. Safe at module scope and during render: on web the
 * bundle only evaluates in the browser, where location is available; anywhere
 * else it falls back to the env var, then the default tenant.
 */
export function getTenant(): TenantConfig {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    // The path picks the index (/uk, /worldleaders); account pages use the
    // tab's last index. lib/indexPaths.ts also makes the API calls follow it.
    return currentIndex();
  }

  const envTenant = process.env.EXPO_PUBLIC_TENANT;
  return envTenant ? tenantById(envTenant) : DEFAULT_TENANT;
}

/** Hook form — identical value, kept as a hook so components read naturally. */
export function useTenant(): TenantConfig {
  return getTenant();
}
