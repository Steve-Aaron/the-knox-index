import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import DashboardScreen from '@/app/index';
import { accountHref } from '@/lib/indexPaths';

/**
 * Index routes — /uk, /worldleaders, and redirects for older addresses
 * ---------------------------------------------------------------------
 * The path names the index (lib/indexPaths.ts reads it). Account pages live
 * at /account/[handle]; the older /uk/[handle] and /world-leaders/[handle]
 * addresses redirect there, and remember their index on the way.
 *
 * Fixed folders rather than one dynamic [index] segment, which would also
 * swallow /api/* requests.
 */
export function IndexDashboardRoute() {
  return <DashboardScreen />;
}

/** /world-leaders → /worldleaders. */
export function WorldLeadersAliasRoute() {
  return <Redirect href={'/worldleaders' as any} />;
}

/** /uk/[handle], /world-leaders/[handle] → /account/[handle]. */
export function LegacyAccountRoute() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  return <Redirect href={accountHref(handle ?? '')} />;
}
