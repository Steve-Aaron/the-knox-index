import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import DashboardScreen from '@/app/index';
import AccountPage from '@/app/account/[handle]';
import { tenantSwitchAllowed } from '@/lib/devTenant';

/**
 * Index routes — /uk, /uk/[handle], /world-leaders, /world-leaders/[handle]
 * --------------------------------------------------------------------------
 * Where one address serves both indexes (local development, Vercel previews)
 * the path names the index (lib/devTenant.ts reads it). The live site uses
 * subdomains, so there these go to '/' and '/account/[handle]'.
 *
 * Fixed folders rather than one dynamic [index] segment, which would also
 * swallow /api/* requests.
 */
export function IndexDashboardRoute() {
  if (!tenantSwitchAllowed()) return <Redirect href="/" />;
  return <DashboardScreen />;
}

export function IndexAccountRoute() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  if (!tenantSwitchAllowed()) return <Redirect href={`/account/${encodeURIComponent(handle ?? '')}` as any} />;
  return <AccountPage />;
}
