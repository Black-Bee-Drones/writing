import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// ───────────────────────── detection (runs on markdown, code already hidden) ─────────────────────────

const DISPLAY = /\$\$([\s\S]+?)\$\$/g;
// Inline `$ ... $`. The opening `$` must NOT follow a letter/digit ("R$ 50", "US$ 5") and the
// closing `$` must NOT precede one ("$5 e $10"). That is what protects Brazilian currency.
const INLINE = /(?<![\p{L}\p{N}$\\])\$(?!\$)([^$\n]+?)(?<!\\)\$(?![\p{L}\p{N}$])/gu;

const TOKEN_RE = /\uE020(\d+)\uE021/;
const token = (i) => `\uE020${i}\uE021`;

export const normalizeLatex = (s) => s.replace(/\s+/g, ' ').trim();
export const hashLatex = (s) => createHash('sha1').update(normalizeLatex(s)).digest('hex').slice(0, 10);

// Currency: a `$` right after a letter and right before a number ("R$ 50", "US$ 5", "A$10") is a
// price, never a math delimiter. Masked up front so it can neither open nor close an equation.
const CURRENCY = /(?<=\p{L})\$(?=\s*\p{N})/gu;
const MASK = '\uE030';

function looksLikeMath(content) {
  const c = content.trim();
  if (!c) return false;
  if (/^[\d\s.,%]+$/.test(c)) return false; // "$ 50 $"
  // No backslash, no operator, but a real word → prose between two stray `$` signs.
  if (!/[\\^_={}+\-*/<>|]/.test(c) && /\p{L}{2,}/u.test(c)) return false;
  return true;
}

/**
 * Replaces every equation with an opaque token and returns the list found.
 * Display equations ($$ ... $$) become their own paragraph; inline ones keep their position.
 */
export function extractMath(text) {
  const equations = [];
  const add = (latex, display) => {
    const index = equations.length;
    equations.push({ index, latex: normalizeLatex(latex), hash: hashLatex(latex), display });
    return token(index);
  };
  let out = text.replace(DISPLAY, (m, body) => (body.trim() ? `\n\n${add(body, true)}\n\n` : m));
  out = out.replace(CURRENCY, MASK);
  out = out.replace(INLINE, (m, body) => (looksLikeMath(body) ? add(body, false) : m));
  return { text: out.replaceAll(MASK, '$'), equations };
}

// ───────────────────────── registry (equations.json next to index.md) ─────────────────────────

export const registryPath = (storyDir) => path.join(storyDir, 'equations.json');

export function loadRegistry(storyDir, issues) {
  const p = registryPath(storyDir);
  if (!fs.existsSync(p)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    return data && typeof data === 'object' ? data : {};
  } catch (e) {
    issues?.error(`equations.json is not valid JSON: ${e.message}`);
    return {};
  }
}

export const isEmbedUrl = (u) => /^https:\/\/([a-z0-9-]+\.)?embed\.fun\/[A-Za-z0-9_-]+\/?$/i.test(String(u || '').trim());

// ───────────────────────── DOM replacement ─────────────────────────

function findTokenTextNode(root) {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (TOKEN_RE.test(n.nodeValue)) return n;
  }
  return null;
}

function codecogsUrl(latex) {
  return 'https://latex.codecogs.com/png.image?' + encodeURIComponent('\\dpi{200}\\bg{white} ' + latex);
}

/**
 * Swaps tokens for the final representation.
 *  - mode 'embedfun': a paragraph holding only the embed.fun URL (Medium turns a lone URL into an embed)
 *  - mode 'codecogs': a figure with a PNG rendered by a hosted service (no registry needed)
 * Returns nothing; reports through `issues`; fills `eq.status` ('ok' | 'pending' | 'fallback').
 */
export function applyEquations(root, equations, registry, mode, issues, slug) {
  const doc = root.ownerDocument;
  const warned = new Set();

  const makeNode = (eq) => {
    if (mode === 'codecogs') {
      eq.status = 'ok';
      const fig = doc.createElement('figure');
      const img = doc.createElement('img');
      img.setAttribute('src', codecogsUrl(eq.latex));
      img.setAttribute('alt', eq.latex);
      img.setAttribute('data-equation', '1'); // lets processImages skip it (not a story image / cover)
      fig.append(img);
      return fig;
    }
    const entry = registry[eq.hash];
    const url = entry && String(entry.url || '').trim();
    const p = doc.createElement('p');
    if (url && isEmbedUrl(url)) {
      eq.status = 'ok';
      eq.url = url;
      p.textContent = url;
      return p;
    }
    eq.status = 'pending';
    if (url && !isEmbedUrl(url) && !warned.has(eq.hash)) {
      warned.add(eq.hash);
      issues.warn(`equations.json: URL for ${eq.hash} is not an embed.fun URL ("${url}").`);
    } else if (!warned.has(eq.hash)) {
      warned.add(eq.hash);
      issues.warn(
        `Equation ${eq.hash} has no embed.fun URL yet: ${eq.latex.slice(0, 70)}${eq.latex.length > 70 ? '…' : ''}  ` +
          `→ run \`npm run equations -- ${slug}\`, publish it at math.embed.fun, paste the URL into content/${slug}/equations.json.`,
      );
    }
    p.append('⚠ PENDING EQUATION (no embed.fun URL yet): ');
    const code = doc.createElement('code');
    code.textContent = eq.latex;
    p.append(code);
    return p;
  };

  const hasContent = (el) => el.textContent.trim() !== '' || el.querySelector('img, figure');

  for (let node = findTokenTextNode(root); node; node = findTokenTextNode(root)) {
    const m = TOKEN_RE.exec(node.nodeValue);
    const eq = equations[Number(m[1])];
    const before = node.nodeValue.slice(0, m.index);
    const after = node.nodeValue.slice(m.index + m[0].length);
    const parent = node.parentNode;

    if (parent.tagName !== 'P') {
      // Token sits in a list item, heading, strong, ... where we can't split the block.
      node.nodeValue = `${before}$${eq.latex}$${after}`;
      eq.status = 'fallback';
      issues.warn(`Equation inside <${parent.tagName.toLowerCase()}> left as plain text "$${eq.latex}$" (Medium can't embed there). Move it to its own paragraph.`);
      continue;
    }

    const trailing = [];
    for (let s = node.nextSibling; s; s = s.nextSibling) trailing.push(s);
    const tail = doc.createElement('p');
    if (after) tail.append(doc.createTextNode(after));
    trailing.forEach((n) => tail.append(n));
    node.nodeValue = before;

    const eqNode = makeNode(eq);
    parent.after(eqNode);
    eqNode.after(tail);

    const surrounded = hasContent(parent) || hasContent(tail);
    if (surrounded) {
      issues.warn(`Equation inside a sentence was moved to its own block (Medium can't do inline math): $${eq.latex.slice(0, 50)}$`);
    }
    if (!hasContent(parent)) parent.remove();
    if (!hasContent(tail)) tail.remove();
  }
}
