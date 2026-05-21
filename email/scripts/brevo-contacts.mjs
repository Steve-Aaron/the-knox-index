#!/usr/bin/env node
/**
 * brevo-contacts.mjs
 * ─────────────────────────────────────────────────────────────────
 * Lists every Brevo contact with PERM_DAILY = 'yes'
 * (i.e. consented to The Knox Index daily briefing).
 *
 * Usage:
 *   node email/scripts/brevo-contacts.mjs
 *
 * Reads BREVO_API_KEY from .env.local automatically.
 * Output: table to stdout + contacts.csv in this folder.
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ── Load API key from .env.local ──────────────────────────────────────────────
const __dir  = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dir, '../../.env.local');
const envText  = fs.readFileSync(envPath, 'utf8');
const keyMatch = envText.match(/^BREVO_API_KEY=["']?([^"'\r\n]+)["']?/m);
if (!keyMatch) { console.error('BREVO_API_KEY not found in .env.local'); process.exit(1); }
const API_KEY = keyMatch[1].trim();

// ── Brevo helper ──────────────────────────────────────────────────────────────
async function brevoGet(path) {
  const res = await fetch(`https://api.brevo.com/v3${path}`, {
    headers: { 'api-key': API_KEY, 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`Brevo ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Paginate all contacts ─────────────────────────────────────────────────────
async function getAllContacts() {
  const all = [];
  let offset = 0;
  const limit = 500;

  while (true) {
    const data = await brevoGet(`/contacts?limit=${limit}&offset=${offset}&sort=desc`);
    const batch = data.contacts ?? [];
    all.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }
  return all;
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('Fetching contacts from Brevo...\n');
const allContacts = await getAllContacts();
console.log(`Total contacts in Brevo: ${allContacts.length}`);

// Filter to PERM_DAILY = 'yes'
const consented = allContacts.filter(c => {
  const perm = c.attributes?.PERM_DAILY;
  return perm === 'yes' || perm === 'YES' || perm === true;
});

console.log(`Consented to daily briefing (PERM_DAILY=yes): ${consented.length}\n`);

if (consented.length === 0) {
  console.log('No consented contacts found.');
  console.log('Note: check Brevo dashboard → Contacts → Attributes to confirm PERM_DAILY exists.');
  process.exit(0);
}

// ── Print table ───────────────────────────────────────────────────────────────
const rows = consented.map(c => ({
  email:     c.email,
  firstname: c.attributes?.FIRSTNAME ?? '',
  lastname:  c.attributes?.LASTNAME  ?? '',
  company:   c.attributes?.COMPANY   ?? '',
  segment:   c.attributes?.SEGMENT   ?? '',
  createdAt: c.createdAt?.slice(0, 10) ?? '',
}));

// Column widths
const w = { email: 36, firstname: 14, lastname: 14, company: 20, segment: 16, createdAt: 12 };
const pad = (s, n) => String(s ?? '').slice(0, n).padEnd(n);
const hr = Object.values(w).map(n => '─'.repeat(n + 2)).join('┼');

console.log(
  '┌' + hr.replace(/┼/g, '┬') + '┐\n' +
  '│ ' + [pad('Email', w.email), pad('First', w.firstname), pad('Last', w.lastname),
           pad('Company', w.company), pad('Segment', w.segment), pad('Joined', w.createdAt)].join(' │ ') + ' │\n' +
  '├' + hr + '┤'
);
for (const r of rows) {
  console.log(
    '│ ' + [pad(r.email, w.email), pad(r.firstname, w.firstname), pad(r.lastname, w.lastname),
             pad(r.company, w.company), pad(r.segment, w.segment), pad(r.createdAt, w.createdAt)].join(' │ ') + ' │'
  );
}
console.log('└' + hr.replace(/┼/g, '┴') + '┘');

// ── Write CSV ─────────────────────────────────────────────────────────────────
const csvPath = path.resolve(__dir, 'consented-contacts.csv');
const csv = [
  'email,firstname,lastname,company,segment,joined',
  ...rows.map(r => [r.email, r.firstname, r.lastname, r.company, r.segment, r.createdAt]
    .map(v => `"${String(v).replace(/"/g,'""')}"`)
    .join(','))
].join('\n');

fs.writeFileSync(csvPath, csv);
console.log(`\nCSV saved → ${csvPath}`);
