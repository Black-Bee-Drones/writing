import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repo root = parent of /scripts, no matter where the command is run from. */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Tiny arg parser: --flag, --key=value, positionals. */
export function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split(/=(.*)/s);
      flags[k] = v === undefined ? true : v;
    } else positional.push(a);
  }
  return { flags, positional };
}
