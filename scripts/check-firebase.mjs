/**
 * scripts/check-firebase.mjs
 * ---------------------------
 * Verifies the Firebase auth setup end to end from this machine:
 *   1. Reads FIREBASE_SERVICE_ACCOUNT from .env.local (JSON or file path)
 *   2. Initialises firebase-admin with it (proves the key is valid)
 *   3. Generates a sign-in link (proves passwordless email links are enabled
 *      and the continue URL's domain is authorized)
 *
 * Run from the project root:  node scripts/check-firebase.mjs
 */

import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// ── 1. Load the service account from .env.local ───────────────────────────────
let raw;
try {
  const line = readFileSync('.env.local', 'utf8')
    .split('\n')
    .find(l => l.startsWith('FIREBASE_SERVICE_ACCOUNT='));
  if (!line) throw new Error('FIREBASE_SERVICE_ACCOUNT not found in .env.local');
  raw = line.slice('FIREBASE_SERVICE_ACCOUNT='.length).trim().replace(/^['"]|['"]$/g, '');
} catch (e) {
  console.log('FAIL reading .env.local:', e.message);
  process.exit(1);
}

const creds = raw.startsWith('{') ? JSON.parse(raw) : raw; // JSON or file path
const sa = typeof creds === 'string' ? JSON.parse(readFileSync(creds, 'utf8')) : creds;
console.log('OK   service account loaded — project:', sa.project_id);

// ── 2. Init admin SDK + 3. generate a link ─────────────────────────────────────
const auth = getAuth(initializeApp({ credential: cert(sa) }));

try {
  await auth.generateSignInWithEmailLink('envcheck@knoxdigi.com', {
    url: 'http://localhost:8081/login',
    handleCodeInApp: true,
  });
  console.log('OK   ENABLED — magic links work, localhost is authorized');
} catch (e) {
  const code = e.errorInfo?.code ?? e.message;
  console.log('FAIL', code);
  if (String(code).includes('operation-not-allowed'))
    console.log('     → Console → Authentication → Sign-in method → Email/Password → enable "Email link (passwordless sign-in)"');
  if (String(code).includes('unauthorized-continue-uri'))
    console.log('     → Console → Authentication → Settings → Authorized domains → add localhost');
  if (String(code).includes('invalid-credential') || String(code).includes('ENOTFOUND'))
    console.log('     → Key invalid or no network — regenerate the service account key');
  process.exit(1);
}
