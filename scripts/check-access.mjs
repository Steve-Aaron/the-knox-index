#!/usr/bin/env node
/**
 * scripts/check-access.mjs
 * -------------------------
 * The approval-link token (lib/accessLink.ts): it must carry a uid (never an
 * email), round-trip, reject tampering, and expire. Pure crypto, no Firestore.
 *
 * Run: ACCESS_LINK_SECRET=test node --experimental-strip-types scripts/check-access.mjs
 */

process.env.ACCESS_LINK_SECRET ||= 'check-access-secret';

import { createAccessToken, verifyAccessToken } from '../lib/accessLink.ts';

let failures = 0;
const ok   = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { failures++; console.error(`  ✗ ${m}`); };
const is   = (a, b, m) => (JSON.stringify(a) === JSON.stringify(b) ? ok(m) : fail(`${m} — got ${JSON.stringify(a)}`));

const token = createAccessToken('uid-abc123', '2');

is(verifyAccessToken(token), { uid: 'uid-abc123', tenantId: '2' }, 'a valid token round-trips to its uid + tenant');

if (token.includes('@')) fail('token must not contain an email'); else ok('token carries no email');

is(verifyAccessToken(token + 'x'), null, 'a tampered signature is rejected');
is(verifyAccessToken('garbage'),   null, 'a malformed token is rejected');
is(verifyAccessToken(''),          null, 'an empty token is rejected');
// The payload is signed, so swapping the uid for another invalidates the sig.
const [payload, sig] = token.split('.');
const forged = Buffer.from(JSON.stringify({ u: 'someone-else', t: '2', x: Date.now() + 1e6 })).toString('base64url');
is(verifyAccessToken(`${forged}.${sig}`), null, 'a swapped uid with the old signature is rejected');

console.log(failures ? `\n✗ ${failures} access check(s) failed\n` : '\n✓ access checks passed\n');
process.exit(failures ? 1 : 0);
