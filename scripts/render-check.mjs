#!/usr/bin/env node
/**
 * scripts/render-check.mjs
 * ------------------------
 * Opens pages in a real headless browser and fails on a console error, a failed
 * request, or a page that mounts without its own content.
 *
 * Typecheck proves the code compiles and Metro proves it bundles. Neither
 * catches a bad hook, a missing runtime export, or a component that throws on
 * first render, which is exactly the class of bug that reaches the browser.
 *
 * It needs the dev server up, so it is not part of `npm run verify`:
 *
 *   npm run dev                                  (one shell)
 *   npm run check:render                         (another — the default pages)
 *   npm run check:render -- /admin/links         (one page)
 *   npm run check:render -- --shots              (also writes exports/shots/*.png)
 *
 * First run on a new machine needs the browser: npx playwright install chromium
 */

import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE  = process.env.RENDER_CHECK_BASE ?? 'http://localhost:8081';
const SHOTS = process.argv.includes('--shots');

/**
 * Each page, and a phrase that only appears once it has rendered its own
 * content. Without that, a page showing nothing but the cookie banner passes.
 */
const DEFAULT_TARGETS = [
  { path: '/',            expect: 'Knox Index' },
  { path: '/admin',       expect: 'Admin Panel' },
  { path: '/admin/links', expect: 'Account tie-ins' },
];

const ASKED = process.argv.slice(2).filter(a => a.startsWith('/'));
const TARGETS = ASKED.length
  ? ASKED.map(path => DEFAULT_TARGETS.find(t => t.path === path) ?? { path, expect: null })
  : DEFAULT_TARGETS;

/** Noise that says nothing about whether the page works. */
const IGNORE = [
  /Download the React DevTools/i,
  /deprecated/i,
  /_vercel\/(speed-)?insights/i,
  /googletagmanager|silktide|mixpanel/i,
  /google-analytics|analytics\.google|doubleclick|gtag/i,
  /favicon/i,
  /Failed to load resource/i,
  // react-native-web hands its own responder props to the DOM; React warns and
  // ignores them. Noise on every page, on every dashboard, always has been.
  /Unknown event handler property/i,
  // Video the browser cancels when a card scrolls away mid-load. Not a fault.
  /\.(mp4|webm|jpg|jpeg|png|webp)\?.*(ERR_ABORTED|net::ERR)/i,
  /(ERR_ABORTED|NS_BINDING_ABORTED)/i,
];

const noise = text => IGNORE.some(rx => rx.test(text));

let failures = 0;
const browser = await chromium.launch();

if (SHOTS) mkdirSync('exports/shots', { recursive: true });

for (const { path, expect: phrase } of TARGETS) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page    = await context.newPage();
  const errors  = [];

  page.on('console',    m => { if (m.type() === 'error' && !noise(m.text())) errors.push(m.text()); });
  page.on('pageerror',  e => { if (!noise(e.message)) errors.push(e.message); });
  page.on('requestfailed', r => {
    const line = `${r.url()} ${r.failure()?.errorText ?? ''}`;
    if (!noise(line)) errors.push(`request failed: ${line}`);
  });

  process.stdout.write(`  ${path} … `);

  try {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });

    if (phrase) await page.getByText(phrase, { exact: false }).first().waitFor({ timeout: 60_000 });
    else        await page.waitForTimeout(5_000);

    // Let anything the page fetches on mount settle, so a failing API call
    // shows up here rather than after the check has passed.
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});

    if (SHOTS) await page.screenshot({ path: `exports/shots${path === '/' ? '/home' : path}.png`.replace(/\/+/g, '/'), fullPage: true });

    if (errors.length) {
      failures++;
      console.log('✗');
      for (const e of [...new Set(errors)].slice(0, 5)) console.log(`      ${e.split('\n')[0].slice(0, 180)}`);
    } else {
      console.log('✓');
    }
  } catch (err) {
    failures++;
    console.log(`✗ ${phrase ? `“${phrase}” never appeared` : 'failed to load'}`);
    for (const e of [...new Set(errors)].slice(0, 3)) console.log(`      ${e.split('\n')[0].slice(0, 180)}`);
  } finally {
    await context.close();
  }
}

await browser.close();
console.log(failures === 0 ? '\n✓ Render checks passed\n' : `\n✗ ${failures} page(s) failed\n`);
process.exit(failures === 0 ? 0 : 1);
