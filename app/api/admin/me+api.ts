/**
 * app/api/admin/me+api.ts
 * ------------------------
 * GET /api/admin/me → { admin: boolean }
 *
 * Lets the client decide whether to render admin-only controls (e.g. inline
 * summary editing on the post feed). This is only a UI hint — every mutating
 * admin route re-checks isAdminRequest server-side, so a spoofed `true` here
 * grants no actual write access.
 *
 * Protected by the same rule as all admin routes: a valid Firebase session
 * whose email is on the ADMIN_EMAILS allowlist (lib/adminAuth).
 */

import { isAdminRequest } from '@/lib/adminAuth';

export async function GET(request: Request): Promise<Response> {
  const admin = await isAdminRequest(request);
  return Response.json(
    { admin },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
