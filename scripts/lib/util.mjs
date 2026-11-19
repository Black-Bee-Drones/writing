import fs from 'node:fs';
import path from 'node:path';

/** Lowercase, strip accents, spaces/underscores -> hyphens. "Pouso de Precisão" -> "pouso-de-precisao" */
export function slugify(input) {
  return String(input)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const toPosix = (p) => p.split(path.sep).join('/');

/**
 * Case-exact existence check. fs.existsSync is case-insensitive on macOS/Windows,
 * but CI runs on Linux (case-sensitive). Checking exact names locally means a file
 * that works on your laptop cannot silently 404 in CI.
 * Compares NFC-normalised names so macOS (NFD) and Linux (NFC) filenames agree.
 */
export function existsExactCase(absPath) {
  if (!fs.existsSync(absPath)) return false;
  const parts = path.resolve(absPath).split(path.sep).filter(Boolean);
  let cur = path.parse(path.resolve(absPath)).root;
  for (const part of parts) {
    let entries;
    try {
      entries = fs.readdirSync(cur);
    } catch {
      return false;
    }
    const want = part.normalize('NFC');
    if (!entries.some((e) => e.normalize('NFC') === want)) return false;
    cur = path.join(cur, part);
  }
  return true;
}

/** Collects problems found during a build. Errors fail the build; warnings don't (unless --strict). */
export class Issues {
  constructor() {
    this.items = [];
  }
  error(msg) {
    this.items.push({ level: 'error', msg });
  }
  warn(msg) {
    this.items.push({ level: 'warn', msg });
  }
  info(msg) {
    this.items.push({ level: 'info', msg });
  }
  get errors() {
    return this.items.filter((i) => i.level === 'error');
  }
  get warnings() {
    return this.items.filter((i) => i.level === 'warn');
  }
  get infos() {
    return this.items.filter((i) => i.level === 'info');
  }
}
