#!/usr/bin/env node
/**
 * content/<slug>/index.md  →  medium-stories/<slug>/{index.html, meta.md}
 *
 * Usage:
 *   node scripts/build-medium.mjs                 build every story
 *   node scripts/build-medium.mjs my-story        build one
 *   --local                 image paths relative to disk (for previewing; NOT for pasting)
 *   --out=<dir>             output folder (default medium-stories; local/paste scripts use .medium-preview)
 *   --ref=<sha|branch>      ref used in raw.githubusercontent.com image URLs (default: config imageRef = master)
 *   --strict                warnings also fail the build
 *   --code=nbsp|zwsp|br|none   --equations=embedfun|codecogs   --tables=list|keep   --out=<dir>
 */
import fs from 'node:fs';
import path from 'node:path';

import { REPO_ROOT, parseArgs } from './lib/cli.mjs';
import { loadConfig, resolveRepo } from './lib/config.mjs';
import { convertStory } from './lib/pipeline.mjs';
import { renderPage, renderMetaMd, renderReport } from './lib/output.mjs';
import { Issues } from './lib/util.mjs';

const { flags, positional } = parseArgs(process.argv.slice(2));
const config = loadConfig(REPO_ROOT, {
  imageRef: flags.ref,
  codeBlankLines: flags.code,
  equations: flags.equations,
  tables: flags.tables,
  outDir: flags.out,
});
const local = Boolean(flags.local);
const repo = resolveRepo(REPO_ROOT, config);
const contentDir = path.join(REPO_ROOT, config.contentDir);
const outRoot = path.isAbsolute(config.outDir) ? config.outDir : path.join(REPO_ROOT, config.outDir);

if (!fs.existsSync(contentDir)) {
  console.error(`No ${config.contentDir}/ directory found.`);
  process.exit(1);
}

const allSlugs = fs
  .readdirSync(contentDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const wanted = positional.length ? positional : allSlugs;
const unknown = wanted.filter((s) => !allSlugs.includes(s));
if (unknown.length) {
  console.error(`Unknown story: ${unknown.join(', ')}\nAvailable: ${allSlugs.join(', ')}`);
  process.exit(1);
}

fs.mkdirSync(outRoot, { recursive: true });
const results = [];

for (const slug of wanted) {
  const storyDir = path.join(contentDir, slug);
  const mdPath = path.join(storyDir, 'index.md');
  if (!fs.existsSync(mdPath)) {
    const issues = new Issues();
    issues.info('no index.md in this folder');
    results.push({ slug, skipped: 'no index.md', issues });
    continue;
  }

  const storyOutDir = path.join(outRoot, slug);
  const { html, meta, issues } = convertStory({
    raw: fs.readFileSync(mdPath, 'utf8'),
    slug,
    storyDir,
    repoRoot: REPO_ROOT,
    storyOutDir,
    config,
    repo,
    ref: config.imageRef,
    local,
  });

  if (meta.draft) {
    issues.info('front matter has `draft: true`');
    results.push({ slug, skipped: 'draft', issues });
    continue;
  }

  fs.mkdirSync(storyOutDir, { recursive: true });
  fs.writeFileSync(path.join(storyOutDir, 'index.html'), renderPage({ slug, meta, issues, articleHtml: html, local }));
  fs.writeFileSync(path.join(storyOutDir, 'meta.md'), renderMetaMd(slug, meta, issues, config));
  results.push({ slug, meta, issues });
}

// On a full build, drop output folders whose source story no longer exists.
if (!positional.length) {
  for (const d of fs.readdirSync(outRoot, { withFileTypes: true })) {
    if (d.isDirectory() && !d.name.startsWith('_') && !allSlugs.includes(d.name)) {
      fs.rmSync(path.join(outRoot, d.name), { recursive: true });
      console.log(`removed stale output: ${d.name}/`);
    }
  }
  const report = renderReport(results);
  fs.writeFileSync(path.join(outRoot, 'REPORT.md'), report);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n');
}

// ── console summary ──
let errors = 0;
let warnings = 0;
for (const r of results) {
  if (r.skipped) {
    console.log(`– ${r.slug}: skipped (${r.skipped})`);
    continue;
  }
  const e = r.issues.errors.length;
  const w = r.issues.warnings.length;
  errors += e;
  warnings += w;
  const eqPending = r.meta.equations.filter((x) => x.status === 'pending').length;
  console.log(
    `${e ? '✖' : w ? '⚠' : '✔'} ${r.slug}: ${r.meta.words} words, ${r.meta.imageCount} image(s), ` +
      `${r.meta.equations.length} equation(s)${eqPending ? ` (${eqPending} pending)` : ''}` +
      `${e ? `, ${e} error(s)` : ''}${w ? `, ${w} warning(s)` : ''}`,
  );
  for (const i of r.issues.items.filter((x) => x.level !== 'info')) console.log(`    ${i.level === 'error' ? '✖' : '⚠'} ${i.msg}`);
}
const shown = path.relative(REPO_ROOT, outRoot) || '.';
if (local) console.log(`\n(local mode: open ${shown}/<slug>/index.html to preview. Use \`npm run paste\` (not --local) to get a version Medium can import images from.)`);
else if (flags.ref) console.log(`\nImage URLs point at ref "${flags.ref}": push that commit first, then open ${shown}/<slug>/index.html and click "Copy for Medium".`);
else if (!repo) console.log('\n⚠ Could not detect the GitHub repo; set MEDIUM_REPO=owner/repo.');

if (errors || (flags.strict && warnings)) process.exit(1);
