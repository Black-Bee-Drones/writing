import path from 'node:path';
import { existsExactCase, toPosix } from './util.mjs';

/* ───────────────────────── structure normalisation ───────────────────────── */

const INLINE_TAGS = new Set(['A', 'EM', 'I', 'STRONG', 'B', 'CODE', 'IMG', 'BR', 'SUB', 'SUP', 'KBD', 'DEL', 'S', 'SMALL', 'MARK', 'U']);

/**
 * Raw-HTML wrappers like <div align="center"> (and <span style=...>) carry layout that Medium ignores.
 * Unwrap them but KEEP everything inside (images, text). The old tool kept only a wrapper's innerHTML,
 * which silently dropped a bare <img> block.
 */
export function unwrapContainers(root) {
  const doc = root.ownerDocument;
  // <span> is inline decoration: always unwrap first so blocks below see only their real children.
  for (const el of [...root.querySelectorAll('span')]) {
    while (el.firstChild) el.before(el.firstChild);
    el.remove();
  }
  for (const el of [...root.querySelectorAll('div, center, section, article')]) {
    const onlyInline = [...el.childNodes].every((n) => n.nodeType === 3 || (n.nodeType === 1 && INLINE_TAGS.has(n.tagName)));
    if (onlyInline) {
      // A <div> holding only text/images is one block in the source → keep it one paragraph
      // (so two separate <div><img></div> blocks are NOT merged into one "side by side" paragraph).
      const p = doc.createElement('p');
      while (el.firstChild) p.appendChild(el.firstChild);
      el.replaceWith(p);
    } else {
      while (el.firstChild) el.before(el.firstChild);
      el.remove();
    }
  }
}

/** After unwrapping, loose text / inline nodes can sit directly under root. Wrap each run in a <p>. */
export function wrapLooseNodes(root) {
  const doc = root.ownerDocument;
  let run = [];
  const flush = () => {
    if (!run.length) return;
    const meaningful = run.some((n) => n.nodeType === 1 || n.nodeValue.trim());
    if (meaningful) {
      const p = doc.createElement('p');
      run[0].before(p);
      run.forEach((n) => p.appendChild(n));
    } else {
      run.forEach((n) => n.remove());
    }
    run = [];
  };
  for (const n of [...root.childNodes]) {
    if (n.nodeType === 3 || (n.nodeType === 1 && INLINE_TAGS.has(n.tagName))) run.push(n);
    else flush();
  }
  flush();
}

/** Medium maps <h2> → Heading and <h4> → Subheading, so h3/h5/h6 collapse into h4. (Same rule as the old tool.) */
export function downgradeHeadings(root, issues) {
  const doc = root.ownerDocument;
  let n = 0;
  for (const el of [...root.querySelectorAll('h3, h5, h6')]) {
    const h4 = doc.createElement('h4');
    while (el.firstChild) h4.appendChild(el.firstChild);
    el.replaceWith(h4);
    n++;
  }
  if (n) issues.info(`${n} heading(s) of level 3/5/6 were mapped to Medium's Subheading (h4).`);
}

/* ───────────────────────── tables ───────────────────────── */

/**
 * Medium has no tables. Each row becomes a bullet:  **first cell** — Header: value; Header: value
 */
export function tablesToLists(root, mode, issues) {
  const doc = root.ownerDocument;
  const tables = [...root.querySelectorAll('table')];
  if (!tables.length) return;
  if (mode === 'keep') {
    issues.warn(`${tables.length} table(s) left as <table>; Medium will flatten them into plain text.`);
    return;
  }
  for (const t of tables) {
    const heads = [...t.querySelectorAll('thead th')].map((th) => th.textContent.trim());
    const ul = doc.createElement('ul');
    for (const tr of t.querySelectorAll('tbody tr')) {
      const cells = [...tr.children];
      if (!cells.length) continue;
      const li = doc.createElement('li');
      const strong = doc.createElement('strong');
      while (cells[0].firstChild) strong.appendChild(cells[0].firstChild);
      li.append(strong);
      cells.slice(1).forEach((cell, i) => {
        li.append(i === 0 ? ' — ' : '; ');
        if (heads[i + 1]) li.append(`${heads[i + 1]}: `);
        while (cell.firstChild) li.appendChild(cell.firstChild);
      });
      ul.append(li);
    }
    t.replaceWith(ul);
  }
  issues.info(`${tables.length} table(s) converted to bullet lists (Medium has no tables).`);
}

/* ───────────────────────── lists & quotes (ported from md-to-medium.html) ───────────────────────── */

export function convertTaskLists(root) {
  for (const cb of [...root.querySelectorAll('li input[type="checkbox"]')]) {
    const next = cb.nextSibling;
    if (next && next.nodeType === 3) next.nodeValue = next.nodeValue.replace(/^\s+/, '');
    cb.remove();
  }
}

export function extractBlockquoteLists(root) {
  for (const list of [...root.querySelectorAll('blockquote ul, blockquote ol')]) {
    list.closest('blockquote').after(list);
  }
}

/** Medium supports one list level only: hoist nested items to the parent list. */
export function flattenNestedLists(root, issues) {
  let n = 0;
  let changed = true;
  while (changed) {
    changed = false;
    for (const nested of [...root.querySelectorAll('li > ul, li > ol')]) {
      changed = true;
      n++;
      let after = nested.parentElement;
      for (const item of [...nested.children]) {
        after.after(item);
        after = item;
      }
      nested.remove();
    }
  }
  if (n) issues.info(`${n} nested list(s) flattened (Medium supports one level).`);
}

/**
 * marked pretty-prints with newlines between blocks; Medium reads whitespace-only text nodes
 * inside <blockquote> as empty quote lines. Rebuild each blockquote as one clean <p>.
 */
export function mergeBlockquotes(root) {
  const doc = root.ownerDocument;
  for (const bq of root.querySelectorAll('blockquote')) {
    const ps = [...bq.querySelectorAll(':scope > p')];
    if (!ps.length) continue;
    const merged = doc.createElement('p');
    ps.forEach((p, i) => {
      if (i > 0) {
        merged.append(doc.createElement('br'), doc.createElement('br'));
      }
      while (p.firstChild) merged.appendChild(p.firstChild);
    });
    bq.replaceChildren(merged);
  }
}

const BLOCK_CONTAINERS = new Set(['DIV', 'BODY', 'BLOCKQUOTE', 'UL', 'OL', 'FIGURE', 'TABLE', 'THEAD', 'TBODY', 'TR']);

/** Whitespace-only text nodes between blocks become empty paragraphs when pasted into Medium. */
export function stripBlockWhitespace(el) {
  if (BLOCK_CONTAINERS.has(el.tagName)) {
    for (const node of [...el.childNodes]) {
      if (node.nodeType === 3 && !node.nodeValue.trim()) node.remove();
    }
  }
  for (const child of [...el.children]) {
    if (child.tagName !== 'PRE') stripBlockWhitespace(child);
  }
}

/* ───────────────────────── code blocks ───────────────────────── */

/**
 * Medium's paste handler treats a blank line inside <pre> as a paragraph break, which is what
 * splits one code block into two or three. The fix is to make sure no line is truly empty.
 * Strategy is configurable (medium.config.json → codeBlankLines) because the winner has to be
 * confirmed in Medium itself: run `npm run probe` and paste the result into a draft.
 */
export function buildPre(doc, text, strategy) {
  const pre = doc.createElement('pre');
  const lines = text.split('\n');
  if (strategy === 'br') {
    lines.forEach((l, i) => {
      if (i) pre.append(doc.createElement('br'));
      pre.append(doc.createTextNode(l.replace(/^ +/, (s) => '\u00A0'.repeat(s.length))));
    });
    return pre;
  }
  const blank = strategy === 'zwsp' ? '\u200B' : '\u00A0';
  const code = doc.createElement('code');
  code.textContent = lines.map((l) => (l.trim() === '' ? blank : l)).join('\n');
  pre.append(code);
  return pre;
}

export function fixCodeBlocks(root, strategy, issues) {
  const doc = root.ownerDocument;
  let touched = 0;
  for (const pre of root.querySelectorAll('pre')) {
    const text = (pre.querySelector('code') ?? pre).textContent.replace(/\n+$/, '');
    const hasBlank = text.split('\n').some((l) => l.trim() === '');
    if (!hasBlank) continue;
    touched++;
    if (strategy === 'none') continue;
    pre.replaceWith(buildPre(doc, text, strategy));
  }
  if (touched && strategy === 'none') {
    issues.warn(`${touched} code block(s) contain blank lines and were left untouched; Medium will likely split them.`);
  } else if (touched) {
    issues.info(`${touched} code block(s) had blank lines → protected from Medium's splitting with "${strategy}".`);
  }
}

/* ───────────────────────── images ───────────────────────── */

function resolveSrc(src, ctx) {
  const s = src.trim();
  if (/^https?:\/\//i.test(s)) return { url: s };
  if (s.startsWith('//')) return { url: `https:${s}` };
  if (/^data:/i.test(s)) return { url: s, warn: 'data: URI images are not uploaded by Medium on paste.' };

  let rel = s.split(/[?#]/)[0];
  try {
    rel = decodeURI(rel);
  } catch {
    /* keep as is */
  }
  const abs = path.resolve(ctx.storyDir, rel);
  if (!abs.startsWith(ctx.repoRoot + path.sep)) return { error: `image path escapes the repo: ${s}` };
  if (!existsExactCase(abs)) {
    return { error: `image not found (check the exact filename/case): ${toPosix(path.relative(ctx.repoRoot, abs))}` };
  }
  const warn = /\.svg$/i.test(abs) ? 'SVG images may not upload to Medium; export a PNG instead.' : undefined;
  const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
  const repoRel = toPosix(path.relative(ctx.repoRoot, abs));

  if (ctx.local) return { url: enc(toPosix(path.relative(ctx.storyOutDir, abs))), warn };
  if (!ctx.repo) return { error: 'cannot determine the GitHub repo for image URLs (set MEDIUM_REPO=owner/repo or add a git remote).' };
  return { url: `https://raw.githubusercontent.com/${ctx.repo}/${enc(ctx.ref)}/${enc(repoRel)}`, warn };
}

/**
 * - rewrites local image paths to public raw.githubusercontent.com URLs (Medium fetches them on paste)
 * - puts each image in its own <figure>
 * - an italic-only paragraph right after an image becomes its <figcaption>
 */
export function processImages(root, ctx, issues) {
  const doc = root.ownerDocument;

  // 1. paragraphs that only contain images → one <figure> per image
  for (const p of [...root.querySelectorAll('p')]) {
    const significant = [...p.childNodes].filter(
      (n) => !(n.nodeType === 3 && !n.nodeValue.trim()) && !(n.nodeType === 1 && n.tagName === 'BR'),
    );
    const imgs = significant.filter((n) => n.nodeType === 1 && n.tagName === 'IMG');
    if (!imgs.length) continue;
    if (imgs.length === significant.length) {
      const figs = imgs.map((img) => {
        const f = doc.createElement('figure');
        f.append(img);
        return f;
      });
      p.replaceWith(...figs);
      if (figs.length > 1) {
        issues.warn(
          `${figs.length} images placed side by side will be stacked by Medium (${imgs.map((i) => i.getAttribute('alt') || i.getAttribute('src')).join(', ')}). ` +
            `Drag them next to each other in the editor to make a row.`,
        );
      }
    } else {
      issues.warn('An image shares a paragraph with text; Medium will split it onto its own line.');
    }
  }

  // 2. resolve sources, drop presentation attributes
  for (const img of [...root.querySelectorAll('img')]) {
    if (img.hasAttribute('data-equation')) {
      img.removeAttribute('data-equation');
      continue;
    }
    const src = img.getAttribute('src') || '';
    const alt = img.getAttribute('alt') || '';
    const r = resolveSrc(src, ctx);
    if (r.error) {
      issues.error(r.error);
      const p = doc.createElement('p');
      p.textContent = `⚠ MISSING IMAGE: ${src}`;
      (img.closest('figure') ?? img).replaceWith(p);
      continue;
    }
    if (r.warn) issues.warn(`${src}: ${r.warn}`);
    for (const a of [...img.attributes]) if (!['src', 'alt'].includes(a.name)) img.removeAttribute(a.name);
    img.setAttribute('src', r.url);
    ctx.images.push({ src, url: r.url, alt });
  }

  // 3. captions: <figure> immediately followed by a paragraph that is only italic text
  for (const fig of root.querySelectorAll('figure')) {
    const next = fig.nextElementSibling;
    if (!next || next.tagName !== 'P') continue;
    const kids = [...next.childNodes].filter((n) => !(n.nodeType === 3 && !n.nodeValue.trim()));
    if (kids.length === 1 && kids[0].nodeType === 1 && ['EM', 'I'].includes(kids[0].tagName)) {
      const cap = doc.createElement('figcaption');
      while (kids[0].firstChild) cap.appendChild(kids[0].firstChild);
      fig.append(cap);
      next.remove();
    }
  }
}

/* ───────────────────────── misc checks ───────────────────────── */

export function warnUnsupported(root, issues) {
  if (root.querySelector('sub, sup')) {
    issues.warn('<sub>/<sup> found: Medium has no sub/superscript, so e.g. K<sub>p</sub> will paste as "Kp". Consider Unicode (Kₚ, x²) or an equation embed.');
  }
  for (const a of root.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href');
    if (!/^(https?:|mailto:)/i.test(href)) {
      issues.warn(`Link "${href}" is not an absolute URL; it won't work on Medium.`);
    }
  }
}
