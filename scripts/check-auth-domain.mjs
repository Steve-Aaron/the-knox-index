/**
 * scripts/check-auth-domain.mjs
 * -----------------------------
 * Verifies the custom Firebase auth domain is wired up correctly from any
 * machine. Google popup sign-in loads the OAuth handler from
 * https://<authDomain>/__/auth/handler, so that domain must serve Firebase's
 * reserved auth paths via a Firebase Hosting custom domain.
 *
 * Checks, against the EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN in .env.local:
 *   1. /__/firebase/init.json returns JSON for the expected project
 *   2. /__/auth/handler responds 200 (the OAuth handler is being served)
 *
 * Run from the project root:  node scripts/check-auth-domain.mjs
 * Exit code 0 = all good, 1 = something is not serving correctly.
 */

import { readFileSync } from 'fs';

// Map a low-level fetch error code to a plain-English likely cause.
function diagnose(cause) {
  const c = String(cause);
  if (c.includes('ENOTFOUND') || c.includes('EAI_AGAIN'))
    return 'DNS does not resolve — the custom domain is not connected, or DNS records are missing / not yet propagated';
  if (c.includes('ECONNREFUSED') || c.includes('ECONNRESET') || c.includes('ETIMEDOUT'))
    return 'domain resolves but nothing is serving it yet — check the Hosting connection / wait for it to go live';
  if (c.toUpperCase().includes('CERT') || c.includes('altnames') || c.includes('SSL') || c.includes('TLS'))
    return 'TLS certificate not provisioned yet — Firebase issues it after the domain connects; wait and retry';
  return 'domain not connected in Hosting, or DNS / certificate not ready yet';
}

// ── Read the expected domain + project from .env.local ────────────────────────
function envValue(key) {
  const line = readFileSync('.env.local', 'utf8')
    .split('\n')
    .find(l => l.startsWith(key + '='));
  if (!line) return undefined;
  return line.slice(key.length + 1).trim().replace(/^['"]|['"]$/g, '');
}

let authDomain, expectedProject;
try {
  authDomain = envValue('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN');
  expectedProject = envValue('EXPO_PUBLIC_FIREBASE_PROJECT_ID');
  if (!authDomain) throw new Error('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN not found in .env.local');
} catch (e) {
  console.log('FAIL reading .env.local:', e.message);
  process.exit(1);
}

console.log('     testing authDomain:', authDomain);
if (authDomain.endsWith('.firebaseapp.com')) {
  console.log('NOTE still on the default firebaseapp.com domain — nothing custom to verify');
}

let ok = true;

// ── 1. init.json identifies the project ───────────────────────────────────────
try {
  const res = await fetch(`https://${authDomain}/__/firebase/init.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const cfg = await res.json();
  if (expectedProject && cfg.projectId !== expectedProject) {
    console.log(`FAIL init.json projectId is "${cfg.projectId}", expected "${expectedProject}"`);
    ok = false;
  } else {
    console.log('OK   init.json served — project:', cfg.projectId);
  }
} catch (e) {
  const cause = e.cause?.code ?? e.cause?.message ?? '';
  console.log('FAIL /__/firebase/init.json not served:', e.message, cause ? `(${cause})` : '');
  console.log('     →', diagnose(cause));
  ok = false;
}

// ── 2. the OAuth handler responds ─────────────────────────────────────────────
try {
  const res = await fetch(`https://${authDomain}/__/auth/handler`, { redirect: 'manual' });
  if (res.status >= 200 && res.status < 400) {
    console.log('OK   /__/auth/handler responds —', res.status);
  } else {
    console.log('FAIL /__/auth/handler returned', res.status);
    ok = false;
  }
} catch (e) {
  const cause = e.cause?.code ?? e.cause?.message ?? '';
  console.log('FAIL /__/auth/handler not reachable:', e.message, cause ? `(${cause})` : '');
  console.log('     →', diagnose(cause));
  ok = false;
}

if (!ok) {
  console.log('\nFAIL custom auth domain is not serving correctly — see notes above');
  process.exit(1);
}
console.log('\nOK   custom auth domain is serving the Firebase auth handler');
