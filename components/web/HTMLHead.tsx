/**
 * components/web/HTMLHead.tsx
 * ----------------------------
 * All <head> content in one place.
 *
 * Renders a React fragment of head elements. Import and render this inside
 * the <head> tag in app/+html.tsx. Adding or changing anything that belongs
 * in <head> (meta tags, preconnects, stylesheets, scripts) happens here.
 *
 * ── Script load order (ORDER IS CRITICAL) ───────────────────────────────────
 *   1. Consent defaults   — must run before GTM so no data fires pre-consent
 *   2. Consent Manager CSS — loads banner styles
 *   3. Consent Manager JS  — loads banner library (no defer — must be ready
 *                            before GTM's Consent Initialization trigger fires)
 *   3b. Consent Manager init — calls window.silktideConsentManager.init()
 *   4. GTM                — loads Tag Manager
 *   5. Everything else    — analytics, speed insights, etc.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * One job: be the single source of truth for the document head.
 */

import { ScrollViewStyleReset } from 'expo-router/html';
import { BRAND } from '@/brand/constants';

// ── IDs ───────────────────────────────────────────────────────────────────────

/** Google Tag Manager container ID */
const GTM_ID = 'GTM-WBQQHKZP';

/** Silktide Consent Manager — served from local public/ assets */
const SILKTIDE_CSS = '/silktide-consent-manager.css';
const SILKTIDE_JS  = '/silktide-consent-manager.js';

// ── Inline scripts ────────────────────────────────────────────────────────────

/**
 * Consent defaults — MUST run before GTM.
 *
 * Reads Silktide's localStorage keys to restore consent on repeat visits.
 * On a first visit all keys are absent (null), so every optional type defaults
 * to 'denied' — correct for GDPR / UK PECR.
 *
 * Key mapping (Silktide key → Google consent type):
 *   stcm.consent.analytics  → analytics_storage
 *   stcm.consent.marketing  → ad_storage, ad_user_data, ad_personalization
 *   stcm.consent.essential  → functionality_storage, security_storage
 */
const CONSENT_DEFAULTS_SCRIPT = `
window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
gtag('consent', 'default', {
  analytics_storage:     localStorage.getItem('stcm.consent.analytics') === 'true' ? 'granted' : 'denied',
  ad_storage:            localStorage.getItem('stcm.consent.marketing') === 'true' ? 'granted' : 'denied',
  ad_user_data:          localStorage.getItem('stcm.consent.marketing') === 'true' ? 'granted' : 'denied',
  ad_personalization:    localStorage.getItem('stcm.consent.marketing') === 'true' ? 'granted' : 'denied',
  functionality_storage: localStorage.getItem('stcm.consent.essential') === 'true' ? 'granted' : 'denied',
  security_storage:      localStorage.getItem('stcm.consent.essential') === 'true' ? 'granted' : 'denied'
});
`.trim();

/**
 * Silktide init — called directly after the Silktide JS loads.
 * Disable the GTM Custom HTML tag that previously called init() to avoid
 * double-initialisation.
 */
const SILKTIDE_INIT_SCRIPT = `
window.silktideConsentManager.init({
  backdrop: { show: true },
  icon:     { position: 'bottomLeft' },
  prompt:   { position: 'bottomRight' },
  consentTypes: [
    {
      id: 'essential',
      label: 'Essential',
      description: '<p>These cookies are necessary for the website to function properly and cannot be switched off. They help with things like logging in and setting your privacy preferences.</p>',
      required: true
    },
    {
      id: 'analytics',
      label: 'Analytics',
      description: '<p>These cookies help us improve the site by tracking which pages are most popular and how visitors move around the site.</p>',
      defaultValue: true,
      gtag: 'analytics_storage'
    },
    {
      id: 'marketing',
      label: 'Marketing',
      description: '<p>These cookies are used by us and our advertising partners to show you relevant ads on this site and elsewhere, and to measure how those campaigns perform.</p>',
      gtag: ['ad_storage', 'ad_user_data', 'ad_personalization']
    }
  ],
  text: {
    prompt: {
      description: '<p>We use cookies on our site to enhance your user experience, provide personalised content, and analyse our traffic.</p>',
      acceptAllButtonText: 'Accept all',
      rejectNonEssentialButtonText: 'Reject non-essential',
      preferencesButtonText: 'Preferences'
    },
    preferences: {
      title: 'Customise your cookie preferences',
      description: '<p>We respect your right to privacy. You can choose not to allow some types of cookies. Your cookie preferences will apply across our website.</p>',
      saveButtonText: 'Save and close'
    }
  }
});
`.trim();

/**
 * GTM bootstrap — loads after Silktide so the Consent Manager is already
 * available when GTM fires its Consent Initialization tags.
 */
const GTM_HEAD_SCRIPT = `
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');
`.trim();

// ── Component ─────────────────────────────────────────────────────────────────

export function HTMLHead() {
  return (
    <>
      {/* ── Core meta ─────────────────────────────────────────────── */}
      <meta charSet="utf-8" />
      <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
      <meta
        name="viewport"
        content="width=device-width, initial-scale=1, shrink-to-fit=no"
      />
      <meta name="description" content={BRAND.description} />
      <title>{BRAND.name}</title>

      {/* ── Open Graph / social ───────────────────────────────────── */}
      <meta property="og:title"       content={BRAND.name} />
      <meta property="og:description" content={BRAND.description} />
      <meta property="og:type"        content="website" />

      {/* ── Figtree — single source of truth for the app's typeface ─────── */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,300..900;1,300..900&display=swap"
        rel="stylesheet"
      />

      {/* Apply Figtree to every text node. Components no longer need to
          set fontFamily themselves — weights still come through fontWeight. */}
      <style dangerouslySetInnerHTML={{ __html: `
        html, body, * { font-family: 'Figtree', sans-serif; }
      ` }} />

      {/* ── Icons (FontAwesome 7 — web only; native uses bundled FA6) ── */}
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.0.1/css/all.min.css"
      />

      {/* ── Brand design tokens ──────────────────────────────────── */}
      {/* @ts-ignore — Expo Router's +html doesn't type-check link[rel=stylesheet] for local assets */}
      <link rel="stylesheet" href="/brand/tokens.css" />

      {/* ── Expo scroll reset ────────────────────────────────────── */}
      <ScrollViewStyleReset />

      {/* ── [1] Consent defaults — MUST be first script on the page ─
           Sets all consent types to denied before GTM or any tag loads.
           On repeat visits, restores the visitor's previous choices from
           localStorage so returning users don't see the banner again.      */}
      <script dangerouslySetInnerHTML={{ __html: CONSENT_DEFAULTS_SCRIPT }} />

      {/* ── [2] Silktide Consent Manager CSS ─────────────────────────
           Loads the banner stylesheet before the JS so there's no FOUC
           when the banner first renders.                                   */}
      <link rel="stylesheet" href={SILKTIDE_CSS} />


{/* ── [3] Silktide Consent Manager JS ──────────────────────────
           NO defer — Silktide must be fully loaded before GTM fires its
           Consent Initialization trigger so silktideConsentManager is
           defined when the GTM init tag runs.                             */}
      <script src={SILKTIDE_JS} />

      {/* ── [3b] Silktide init ────────────────────────────────────────
           Called directly after the Silktide JS loads.
           NOTE: disable the GTM Custom HTML tag that previously called
           silktideConsentManager.init() to avoid double-initialisation.  */}
      <script dangerouslySetInnerHTML={{ __html: SILKTIDE_INIT_SCRIPT }} />

      {/* ── [4] Google Tag Manager ────────────────────────────────────
           Loads after Silktide. The silktideConsentManager.init() call
           lives in GTM as a Custom HTML tag — see GTM setup instructions
           in AGENTS.md.                                                    */}
      <script dangerouslySetInnerHTML={{ __html: GTM_HEAD_SCRIPT }} />

      {/* ── [5] Performance ──────────────────────────────────────────
           Deferred — not needed before paint.                              */}
      <script defer src="/_vercel/speed-insights/script.js" />
    </>
  );
}

/**
 * GTMNoScript
 * -----------
 * Fallback iframe for environments where JavaScript is disabled.
 * Render this as the FIRST child of <body> in app/+html.tsx.
 *
 * GTM requires it immediately after the opening <body> tag.
 */
export function GTMNoScript() {
  return (
    <noscript>
      {/* eslint-disable-next-line jsx-a11y/iframe-has-title */}
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height="0"
        width="0"
        style={{ display: 'none', visibility: 'hidden' }}
      />
    </noscript>
  );
}
