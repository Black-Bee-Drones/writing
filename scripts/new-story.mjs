#!/usr/bin/env node
/**
 * Scaffold a story:  content/<slug>/index.md  +  content/<slug>/assets/
 *
 *   npm run new -- my-story              creates the folder AND the git branch story/my-story
 *   npm run new -- my-story --no-branch  only the folder (used by the GitHub Action)
 *   --author="Name"                      override the author (default: git config user.name)
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

import { REPO_ROOT, parseArgs } from './lib/cli.mjs';
import { loadConfig } from './lib/config.mjs';
import { slugify } from './lib/util.mjs';

const { flags, positional } = parseArgs(process.argv.slice(2));
const config = loadConfig(REPO_ROOT);

if (!positional[0]) {
  console.error('Usage: npm run new -- <story-name> [--no-branch] [--author="Name"]');
  process.exit(1);
}

const slug = slugify(positional[0].replace(new RegExp(`^${config.branchPrefix}`), ''));
if (!slug) {
  console.error('That name has no usable characters.');
  process.exit(1);
}

const dir = path.join(REPO_ROOT, config.contentDir, slug);
if (fs.existsSync(dir)) {
  console.log(`content/${slug} already exists, nothing to do.`);
  process.exit(0);
}

const sh = (cmd) => execSync(cmd, { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
let author = typeof flags.author === 'string' ? flags.author : '';
if (!author) {
  try {
    author = sh('git config user.name');
  } catch {
    /* leave empty */
  }
}

const title = slug.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
const today = new Date().toISOString().slice(0, 10);
const tpl = fs.readFileSync(path.join(REPO_ROOT, 'templates', 'story', 'index.md'), 'utf8');
const body = tpl
  .replaceAll('{{title}}', title)
  .replaceAll('{{author}}', author.replace(/"/g, '\\"'))
  .replaceAll('{{date}}', today);

fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
fs.writeFileSync(path.join(dir, 'index.md'), body);
fs.writeFileSync(path.join(dir, 'assets', '.gitkeep'), ''); // git does not track empty folders

if (!flags['no-branch']) {
  const branch = `${config.branchPrefix}${slug}`;
  try {
    sh(`git switch -c ${branch}`);
    console.log(`Switched to new branch ${branch}`);
  } catch {
    console.log(`(could not create branch ${branch}; create it yourself: git switch -c ${branch})`);
  }
}
console.log(`Created content/${slug}/index.md and content/${slug}/assets/`);
