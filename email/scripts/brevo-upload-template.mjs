#!/usr/bin/env node
/**
 * brevo-upload-template.mjs
 * ─────────────────────────────────────────────────────────────────
 * Uploads (or updates) the Knox Index daily briefing template
 * to Brevo Transactional → Templates.
 *
 * Usage:
 *   node email/scripts/brevo-upload-template.mjs
 *
 * On first run:  creates a new template and prints its ID.
 * On re-runs:    update EXISTING_TEMPLATE_ID below with the printed ID
 *               to update the same template instead of creating a new one.
 *
 * After running, set BREVO_TEMPLATE_ID=<id> in .env.local and Vercel.
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────
// Set this to your template ID after the first upload to update instead of create.
const EXISTING_TEMPLATE_ID = 1;

// ── Load API key ──────────────────────────────────────────────────────────────
const envPath = path.resolve(__dir, '../../.env.local');
const envText  = fs.readFileSync(envPath, 'utf8');
const keyMatch = envText.match(/^BREVO_API_KEY=["']?([^"'\r\n]+)["']?/m);
if (!keyMatch) { console.error('BREVO_API_KEY not found in .env.local'); process.exit(1); }
const API_KEY = keyMatch[1].trim();

// ── Load template HTML + resolve <!-- INCLUDE: x --> markers ─────────────────
const templatePath = path.resolve(__dir, '../briefing_template.html');
const componentsDir = path.resolve(__dir, '../components');

function resolveIncludes(html) {
  return html.replace(/<!--\s*INCLUDE:\s*([^\s]+)\s*-->/g, (_, fname) => {
    const componentPath = path.join(componentsDir, fname);
    if (!fs.existsSync(componentPath)) {
      throw new Error(`Include not found: ${componentPath}`);
    }
    console.log(`  ↳ inlining ${fname}`);
    return fs.readFileSync(componentPath, 'utf8');
  });
}

const rawTemplate  = fs.readFileSync(templatePath, 'utf8');
const htmlContent  = resolveIncludes(rawTemplate);
console.log(`Template file: ${templatePath}`);
console.log(`Template size: ${(htmlContent.length / 1024).toFixed(1)} KB (after resolving ${(rawTemplate.match(/<!--\s*INCLUDE:/g) || []).length} includes)`);

// ── Brevo API ─────────────────────────────────────────────────────────────────
async function brevo(method, endpoint, body) {
  const res = await fetch(`https://api.brevo.com/v3${endpoint}`, {
    method,
    headers: {
      'api-key':      API_KEY,
      'Content-Type': 'application/json',
      'Accept':       'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  return { ok: res.ok, status: res.status, data: json };
}

// ── Upload ────────────────────────────────────────────────────────────────────
const payload = {
  sender:      { name: 'The Knox Index', email: 'hello@knoxdigi.com' },
  templateName: 'TKI Daily Briefing',
  subject:     '{{ params.subjectLine }}',
  htmlContent,
  isActive:    true,
};

let result;
if (EXISTING_TEMPLATE_ID) {
  console.log(`\nUpdating template ID ${EXISTING_TEMPLATE_ID}...`);
  result = await brevo('PUT', `/smtp/templates/${EXISTING_TEMPLATE_ID}`, payload);
  if (result.ok || result.status === 204) {
    console.log(`✓ Template ${EXISTING_TEMPLATE_ID} updated successfully.`);
  } else {
    console.error('✗ Update failed:', result.status, JSON.stringify(result.data, null, 2));
    process.exit(1);
  }
} else {
  console.log('\nCreating new template...');
  result = await brevo('POST', '/smtp/templates', payload);
  if (result.ok) {
    const id = result.data.id;
    console.log(`✓ Template created! ID: ${id}`);
    console.log(`\nNext steps:`);
    console.log(`  1. Set EXISTING_TEMPLATE_ID = ${id} in this script for future updates`);
    console.log(`  2. Add BREVO_BRIEFING_TEMPLATE_ID=${id} to .env.local and Vercel settings`);
  } else {
    console.error('✗ Create failed:', result.status, JSON.stringify(result.data, null, 2));
    process.exit(1);
  }
}

// ── Print a clickable file:// link to the local rendered preview ─────────────
const previewFile = path.resolve(__dir, '../briefing_preview.html');
console.log(`\n→ Local preview: file://${previewFile}`);

// ── Also check existing templates ────────────────────────────────────────────
console.log('\nExisting Brevo transactional templates:');
const { data: tdata } = await brevo('GET', '/smtp/templates?templateStatus=true&limit=20');
if (tdata.templates?.length) {
  for (const t of tdata.templates) {
    console.log(`  [${t.id}] ${t.name}  — subject: "${t.subject}" | active: ${t.isActive}`);
  }
} else {
  console.log('  (none active)');
}
