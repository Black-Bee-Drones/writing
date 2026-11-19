#!/usr/bin/env node
/**
 * Keeps content/<slug>/equations.json in sync with the equations in index.md.
 *
 * Why this exists: embed.fun hands out the URL (math.embed.fun/<id>) only after you publish a
 * formula in their web app, and there is no public API, so the ID cannot be computed. This tool
 * removes everything else: it finds the equations, remembers which URL belongs to which formula,
 * and tells you exactly what is still missing.
 *
 *   npm run equations                list pending equations for every story
 *   npm run equations -- my-story    one story
 *   --prune                          also delete entries no longer used by the markdown
 */
import fs from 'node:fs';
import path from 'node:path';

import { REPO_ROOT, parseArgs } from './lib/cli.mjs';
import { loadConfig } from './lib/config.mjs';
import { protectCode } from './lib/protect.mjs';
import { extractMath, loadRegistry, registryPath, isEmbedUrl } from './lib/math.mjs';
import { parseFrontMatter } from './lib/frontmatter.mjs';
import { Issues } from './lib/util.mjs';

const { flags, positional } = parseArgs(process.argv.slice(2));
const config = loadConfig(REPO_ROOT);
const contentDir = path.join(REPO_ROOT, config.contentDir);

const slugs = positional.length
  ? positional
  : fs.readdirSync(contentDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();

let pendingTotal = 0;
for (const slug of slugs) {
  const dir = path.join(contentDir, slug);
  const md = path.join(dir, 'index.md');
  if (!fs.existsSync(md)) continue;

  const { body } = parseFrontMatter(fs.readFileSync(md, 'utf8'), new Issues(), { maxTags: 99 });
  const { equations } = extractMath(protectCode(body).text);
  if (!equations.length) continue;

  const registry = loadRegistry(dir);
  const used = new Set();
  const next = {};
  const pending = [];

  for (const eq of equations) {
    if (used.has(eq.hash)) continue; // same formula twice → one entry
    used.add(eq.hash);
    const prev = registry[eq.hash];
    next[eq.hash] = { latex: eq.latex, url: prev?.url ?? '' };
    if (!isEmbedUrl(next[eq.hash].url)) pending.push({ hash: eq.hash, latex: eq.latex });
  }
  const stale = Object.keys(registry).filter((h) => !used.has(h));
  if (!flags.prune) for (const h of stale) next[h] = registry[h];

  const before = fs.existsSync(registryPath(dir)) ? fs.readFileSync(registryPath(dir), 'utf8') : '';
  const after = JSON.stringify(next, null, 2) + '\n';
  if (before !== after) fs.writeFileSync(registryPath(dir), after);

  console.log(`\n${slug}: ${used.size} equation(s), ${pending.length} pending${stale.length ? `, ${stale.length} unused entr${stale.length > 1 ? 'ies' : 'y'}${flags.prune ? ' (pruned)' : ' (use --prune to remove)'}` : ''}`);
  pendingTotal += pending.length;
  pending.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.latex}`);
  });
  if (pending.length) {
    console.log(`  → paste each formula at https://math.embed.fun , publish it, then put the URL in`);
    console.log(`    content/${slug}/equations.json (the "url" field of the matching entry).`);
  }
}
if (!pendingTotal) console.log('\nAll equations have an embed.fun URL. ✔');
