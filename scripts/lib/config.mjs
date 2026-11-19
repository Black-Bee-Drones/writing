import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

export const DEFAULTS = {
  contentDir: 'content',
  outDir: 'medium-stories',
  branchPrefix: 'story/',
  // Branch/ref used in image URLs. 'master' keeps generated output deterministic
  // (a commit SHA would change every story's HTML on every merge).
  imageRef: 'master',
  // 'embedfun' = math.embed.fun URLs from equations.json, 'codecogs' = auto-generated PNG images
  equations: 'embedfun',
  // 'list' = tables become bullet lists, 'keep' = leave <table> (Medium will flatten it)
  tables: 'list',
  // How to stop Medium splitting a code block at blank lines: nbsp | zwsp | br | none
  codeBlankLines: 'nbsp',
  // Medium accepts at most 5 tags per story
  maxTags: 5,
};

export function loadConfig(root, cli = {}) {
  let file = {};
  const p = path.join(root, 'medium.config.json');
  if (fs.existsSync(p)) file = JSON.parse(fs.readFileSync(p, 'utf8'));
  const env = {};
  if (process.env.MEDIUM_IMAGE_REF) env.imageRef = process.env.MEDIUM_IMAGE_REF;
  const clean = Object.fromEntries(Object.entries(cli).filter(([, v]) => v !== undefined));
  return { ...DEFAULTS, ...file, ...env, ...clean };
}

/** "owner/repo" from MEDIUM_REPO, GitHub Actions, config, or the git remote. */
export function resolveRepo(root, cfg) {
  const fromEnv = process.env.MEDIUM_REPO || process.env.GITHUB_REPOSITORY || cfg.repo;
  if (fromEnv) return fromEnv;
  try {
    const url = execSync('git remote get-url origin', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    const m = url.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
    if (m) return m[1];
  } catch {
    /* not a git repo / no remote */
  }
  return null;
}
