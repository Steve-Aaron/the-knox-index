/**
 * hooks/useTenantAccess.ts
 * -------------------------
 * Whether THIS browser may read THIS tenant, as decided by the server.
 *
 * Public tenants resolve instantly with no network call, so The Knox Index
 * renders exactly as it did before. Gated tenants ask /api/tenant/access,
 * which answers with the reason as well as the verdict so the gate can show
 * the right screen: sign in, request access, awaiting approval, or refused.
 *
 * Submitting the request itself belongs to AccessRequestForm — it owns the
 * form state and POSTs it; this hook only re-reads the verdict afterwards.
 *
 * One job: expose the access state.
 */

import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useTenant } from '@/hooks/useTenant';
import { fetchWithRetry } from '@/data/fetchWithRetry';
import type { TenantConfig } from '@/lib/tenants';

export type AccessReason =
  | 'public'
  | 'dev-bypass'
  | 'domain'
  | 'approved'
  | 'unauthenticated'
  | 'pending'
  | 'denied'
  | 'none';

export interface TenantAccessState {
  tenant:     TenantConfig;
  loading:    boolean;
  allowed:    boolean;
  reason:     AccessReason;
  email:      string | null;
  error:   string | null;
  /** Re-ask the server. Call after submitting the access request form. */
  refresh: () => Promise<void>;
}

interface AccessPayload {
  allowed: boolean;
  reason:  AccessReason;
  email:   string | null;
}

export function useTenantAccess(): TenantAccessState {
  const tenant   = useTenant();
  const isPublic = tenant.access.mode === 'public';
  // Native builds have no cookie session; the gate is a web concern.
  const skip     = isPublic || Platform.OS !== 'web';

  const [loading,    setLoading]    = useState(!skip);
  const [allowed,    setAllowed]    = useState(skip);
  const [reason,     setReason]     = useState<AccessReason>(skip ? 'public' : 'unauthenticated');
  const [email,      setEmail]      = useState<string | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (skip) return;
    setLoading(true);
    setError(null);
    try {
      const res  = await fetchWithRetry('/api/tenant/access', { credentials: 'same-origin', cache: 'no-store' });
      const data = (await res.json()) as AccessPayload;
      setAllowed(!!data.allowed);
      setReason(data.reason ?? 'none');
      setEmail(data.email ?? null);
    } catch {
      // Fail closed: an unreachable gate must not open the dashboard.
      setAllowed(false);
      setError('We could not check your access. Please retry.');
    } finally {
      setLoading(false);
    }
  }, [skip]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { tenant, loading, allowed, reason, email, error, refresh };
}
