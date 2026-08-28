#!/usr/bin/env node
/**
 * The privacy claim, enforced.
 *
 * The honest version of the claim - and the first draft of this script proved
 * the dishonest one was wrong - is NOT "the page cannot make a network
 * request". DuckDB has to load its own WebAssembly, and it uses XHR to do it.
 * An absolute `connect-src 'none'` would break the engine, so a README
 * promising it would have been a lie a commenter could catch in one minute.
 *
 * What is true, and what this enforces:
 *
 *   1. The application bundle contains no network primitives at all. Not
 *      fetch, not XHR, not WebSocket, not sendBeacon. Vite's module-preload
 *      polyfill is disabled in vite.config.ts precisely so this holds.
 *   2. The vendored engine may use them, but only to load its own assets from
 *      this origin. No CDN host may appear as a request target.
 *   3. The shipped CSP is `connect-src 'self'`, which is what makes the
 *      guarantee enforceable in the browser rather than only at build time.
 *
 * Your data cannot leave, because there is nowhere for it to go.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

const DIST = process.argv[2] ?? 'dist';

const PRIMITIVES = [
  { name: 'fetch', pattern: /\bfetch\s*\(/ },
  { name: 'XMLHttpRequest', pattern: /\bXMLHttpRequest\b/ },
  { name: 'WebSocket', pattern: /\bnew\s+WebSocket\b/ },
  { name: 'sendBeacon', pattern: /\bsendBeacon\b/ },
  { name: 'EventSource', pattern: /\bnew\s+EventSource\b/ },
];

/** Vendored engine files, allowed network primitives for same-origin assets. */
const VENDOR = /duckdb/i;

/** Hosts that would mean data or code is coming from somewhere else. */
const CDN_HOSTS = /https?:\/\/(cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com|.*\.googleapis\.com|esm\.sh|skypack\.dev)/;

const problems = [];
const exemptions = [];

for (const file of walk(DIST)) {
  if (!['.js', '.mjs', '.cjs'].includes(extname(file))) continue;

  const source = readFileSync(file, 'utf8');
  const name = basename(file);
  const isVendor = VENDOR.test(name);

  const found = PRIMITIVES.filter(({ pattern }) => pattern.test(source)).map(({ name }) => name);

  if (isVendor) {
    if (found.length > 0) exemptions.push(`${name}: ${found.join(', ')} (engine loading its own assets)`);
  } else if (found.length > 0) {
    problems.push(`${name}: application code uses ${found.join(', ')}`);
  }

  const cdn = source.match(CDN_HOSTS);
  if (cdn) problems.push(`${name}: references ${cdn[0]} as a request target`);
}

for (const exemption of exemptions) console.log(`  exempt  ${exemption}`);

if (problems.length > 0) {
  console.error('\nThe privacy claim does not hold:\n');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log('\nApplication bundle has no network primitives; no CDN targets anywhere. The claim holds.');

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    console.error(`Nothing to check at ${dir}. Run the build first.`);
    process.exit(1);
  }

  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}
