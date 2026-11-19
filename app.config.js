/**
 * app.config.js
 * --------------
 * Extends app.json at build time. One job: write Vercel's build type
 * (VERCEL_ENV: 'production' | 'preview' | 'development') into the app, so the
 * browser can tell a preview build from a production one whatever address it
 * is served from (lib/indexPaths.ts isPreviewSite). Unset locally.
 */
module.exports = ({ config }) => ({
  ...config,
  extra: { ...(config.extra ?? {}), vercelEnv: process.env.VERCEL_ENV ?? null },
});
