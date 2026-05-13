/**
 * app/api/mp/[...path]+api.ts
 * ----------------------------
 * Server-side proxy for Mixpanel. Routes /mp/* → https://api.mixpanel.com/*.
 *
 * Why this exists: Vercel does not reliably proxy to external URLs via
 * vercel.json rewrites. This handler runs in Node.js on Vercel and forwards
 * the request to api.mixpanel.com, preserving method, body, and query string.
 *
 * vercel.json routes /mp/:path* → /api/mp/:path* (internal rewrite).
 * Mixpanel GTM tag sets api_host to window.location.origin + '/mp'.
 * This combination bypasses ad-blocker blocks on api.mixpanel.com directly.
 */

const MIXPANEL_BASE = 'https://api.mixpanel.com';

async function proxy(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // Strip the /api/mp prefix to get the raw Mixpanel path (e.g. /track, /engage)
  const mixpanelPath = url.pathname.replace(/^\/api\/mp/, '') || '/';
  const target = `${MIXPANEL_BASE}${mixpanelPath}${url.search}`;

  const headers: Record<string, string> = {};
  const contentType = request.headers.get('Content-Type');
  if (contentType) headers['Content-Type'] = contentType;

  const init: RequestInit = { method: request.method, headers };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.text();
  }

  try {
    const upstream = await fetch(target, init);
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') ?? 'text/plain',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('[/api/mp proxy] upstream fetch failed:', err);
    return new Response('Proxy error', { status: 502 });
  }
}

export async function GET(request: Request):    Promise<Response> { return proxy(request); }
export async function POST(request: Request):   Promise<Response> { return proxy(request); }
export async function OPTIONS(request: Request): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
