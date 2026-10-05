import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useTenant } from '@/hooks/useTenant';
import { tenantFullName } from '@/lib/tenants';
import { installDevTenantFetch } from '@/lib/devTenant';

/**
 * TenantHead
 * -----------
 * Keeps the document title and description in step with the tenant.
 *
 * The static head (components/web/HTMLHead.tsx) is rendered once at build time
 * and is therefore identical for every domain. One deployment serves them all,
 * so the tenant is only knowable in the browser — this component applies it on
 * mount, before the first paint the user reads.
 *
 * Renders nothing. One job: title + meta description per tenant.
 */
export function TenantHead() {
  const tenant = useTenant();

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    // Development only: make ?tenant=<id> apply to API calls as well as copy.
    installDevTenantFetch();

    // Tab title keeps the product name and adds what this one covers.
    document.title = tenantFullName(tenant);

    const setMeta = (selector: string, content: string) => {
      const el = document.head.querySelector(selector);
      if (el) el.setAttribute('content', content);
    };
    setMeta('meta[name="description"]',      tenant.brand.description);
    setMeta('meta[property="og:title"]',     tenantFullName(tenant));
    setMeta('meta[property="og:description"]', tenant.brand.description);
  }, [tenant]);

  return null;
}
