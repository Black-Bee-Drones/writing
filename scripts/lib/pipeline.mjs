import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';
import { marked } from 'marked';

import { Issues } from './util.mjs';
import { parseFrontMatter } from './frontmatter.mjs';
import { protectCode } from './protect.mjs';
import { extractMath, applyEquations, loadRegistry } from './math.mjs';
import {
  unwrapContainers,
  wrapLooseNodes,
  downgradeHeadings,
  tablesToLists,
  convertTaskLists,
  extractBlockquoteLists,
  flattenNestedLists,
  processImages,
  fixCodeBlocks,
  mergeBlockquotes,
  stripBlockWhitespace,
  warnUnsupported,
} from './transforms.mjs';

/**
 * markdown (with front matter) → { html, meta, issues }
 *
 * Order matters:
 *   code is hidden → math becomes tokens → marked → sanitize → DOM transforms → tokens become embeds
 */
export function convertStory({ raw, slug, storyDir, repoRoot, storyOutDir, config, repo, ref, local }) {
  const issues = new Issues();
  const { data, body } = parseFrontMatter(raw, issues, config);
  const registry = loadRegistry(storyDir, issues);

  // 1. math detection must never look inside code
  const prot = protectCode(body);
  const { text, equations } = extractMath(prot.text);
  const md = prot.restore(text);

  // 2. markdown → HTML → sanitised DOM
  const dirty = marked.parse(md, { gfm: true, breaks: false, async: false });
  const dom = new JSDOM('<!DOCTYPE html><body></body>');
  const { document } = dom.window;
  const purify = createDOMPurify(dom.window);
  const clean = purify.sanitize(dirty, {
    FORBID_ATTR: ['style', 'class'],
    ADD_ATTR: ['checked', 'disabled'],
  });
  const root = document.createElement('div');
  root.innerHTML = clean;

  // 3. transforms
  const ctx = { storyDir, repoRoot, storyOutDir, repo, ref, local, images: [] };
  unwrapContainers(root);
  wrapLooseNodes(root);
  applyEquations(root, equations, registry, config.equations, issues, slug);
  downgradeHeadings(root, issues);
  tablesToLists(root, config.tables, issues);
  convertTaskLists(root);
  extractBlockquoteLists(root);
  flattenNestedLists(root, issues);
  processImages(root, ctx, issues);
  fixCodeBlocks(root, config.codeBlankLines, issues);
  mergeBlockquotes(root);

  // Medium takes the first <h1> as the story title. Use front matter if the body has none.
  let h1 = root.querySelector('h1');
  if (!h1 && data.title) {
    h1 = document.createElement('h1');
    h1.textContent = String(data.title);
    root.prepend(h1);
    issues.info('No "# Title" in the body; inserted one from front matter.');
  }
  warnUnsupported(root, issues);
  stripBlockWhitespace(root);

  // 4. metadata for the publishing checklist
  const title = h1 ? h1.textContent.trim() : String(data.title || slug);
  let subtitle = '';
  const afterTitle = h1?.nextElementSibling;
  if (afterTitle?.tagName === 'P' && afterTitle.children.length === 1 && afterTitle.firstElementChild.tagName === 'EM') {
    subtitle = afterTitle.textContent.trim();
  }
  const words = root.textContent.trim().split(/\s+/).filter(Boolean).length;
  const { title: _t, author, date, tags, draft, ...extra } = data;

  const meta = {
    title,
    subtitle,
    author: author ? String(author) : '',
    date: date ? String(date) : '',
    tags: Array.isArray(tags) ? tags.map(String) : [],
    draft: draft === true,
    extra,
    cover: ctx.images[0] ?? null,
    imageCount: ctx.images.length,
    equations,
    words,
    readingMinutes: Math.max(1, Math.ceil(words / 265)),
  };

  return { html: root.innerHTML, meta, issues };
}
