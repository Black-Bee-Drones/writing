import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { convertStory } from '../scripts/lib/pipeline.mjs';
import { DEFAULTS } from '../scripts/lib/config.mjs';
import { slugify } from '../scripts/lib/util.mjs';
import { extractMath, hashLatex } from '../scripts/lib/math.mjs';
import { protectCode } from '../scripts/lib/protect.mjs';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

/** Creates a throwaway repo: content/<slug>/index.md (+ assets, equations.json) and converts it. */
function build(md, { assets = [], registry, config = {}, local = false, repo = 'me/writing', ref = 'master' } = {}) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'medium-test-'));
  const storyDir = path.join(repoRoot, 'content', 'story');
  fs.mkdirSync(path.join(storyDir, 'assets'), { recursive: true });
  for (const a of assets) fs.writeFileSync(path.join(storyDir, 'assets', a), PNG);
  if (registry) fs.writeFileSync(path.join(storyDir, 'equations.json'), JSON.stringify(registry));
  return convertStory({
    raw: md,
    slug: 'story',
    storyDir,
    repoRoot,
    storyOutDir: path.join(repoRoot, 'medium-stories', 'story'),
    config: { ...DEFAULTS, ...config },
    repo,
    ref,
    local,
  });
}
const FM = '---\ntitle: "T"\nauthor: "A"\n---\n\n';
const has = (issues, level, re) => issues.items.some((i) => i.level === level && re.test(i.msg));

/* ───────────── front matter ───────────── */

test('front matter is stripped from the output and exposed as metadata', () => {
  const { html, meta } = build(`---\ntitle: "Meu título"\nauthor: "Ana"\ndate: "2026-10-07"\ntags: ["a", "b"]\n---\n\n# Meu título\n\nTexto.`);
  assert.ok(!html.includes('author:'));
  assert.ok(!html.includes('2026-10-07'));
  assert.deepEqual(meta.tags, ['a', 'b']);
  assert.equal(meta.author, 'Ana');
});

test('title from front matter becomes the H1 when the body has none', () => {
  const { html } = build(`---\ntitle: "Só no front matter"\n---\n\nTexto.`);
  assert.match(html, /^<h1>Só no front matter<\/h1>/);
});

test('more than 5 tags is a warning', () => {
  const { issues } = build(`---\ntitle: T\ntags: [a,b,c,d,e,f]\n---\n\n# T`);
  assert.ok(has(issues, 'warn', /allows 5/));
});

test('subtitle = italic paragraph right after the H1', () => {
  const { meta } = build(FM + '# T\n\n*Um subtítulo*\n\nTexto');
  assert.equal(meta.subtitle, 'Um subtítulo');
});

/* ───────────── math ───────────── */

test('display equation uses the URL from equations.json', () => {
  const latex = 'P(t) = K_p e(t)';
  const url = 'https://math.embed.fun/ipk3KUvTzjedKK3KPzrMDr';
  const { html, issues } = build(FM + `# T\n\nAntes:\n\n$$\nP(t) = K_p   e(t)\n$$\n\nDepois.`, {
    registry: { [hashLatex(latex)]: { latex, url } },
  });
  assert.ok(html.includes(`<p>${url}</p>`), html);
  assert.equal(issues.warnings.length, 0);
});

test('equation without a URL is flagged and visibly marked, never silently dropped', () => {
  const { html, issues, meta } = build(FM + '# T\n\n$$\na + b = c\n$$\n');
  assert.match(html, /PENDING EQUATION/);
  assert.ok(html.includes('a + b = c'));
  assert.ok(has(issues, 'warn', /no embed\.fun URL/));
  assert.equal(meta.equations[0].status, 'pending');
});

test('an invalid URL in the registry is rejected', () => {
  const latex = 'x';
  const { issues } = build(FM + '# T\n\n$$x$$\n', { registry: { [hashLatex(latex)]: { latex, url: 'https://evil.example/abc' } } });
  assert.ok(has(issues, 'warn', /not an embed\.fun URL/));
});

test('inline $ a + b = c $ is promoted to its own block with a warning', () => {
  const { html, issues } = build(FM + '# T\n\nVeja que $ a + b = c $ vale sempre.');
  assert.match(html, /<p>Veja que <\/p><p>⚠ PENDING EQUATION/);
  assert.match(html, /<p> vale sempre\.<\/p>/);
  assert.ok(has(issues, 'warn', /inside a sentence/));
});

test('Brazilian currency is not an equation (R$ 50 … R$ 80, US$ 5, $5 e $10)', () => {
  const { equations } = extractMath('Custa R$ 50 ou R$ 80. Também US$ 5 e US$ 10. Ou $5 e $10. E R$ 1.000,00.');
  assert.equal(equations.length, 0);
});

test('prose between two bare $ signs is not math', () => {
  const { equations } = extractMath('Paguei $ 50 por mês e $ 60 no total.');
  assert.equal(equations.length, 0);
});

test('$ inside code blocks and inline code is never touched', () => {
  const src = 'Use `echo $HOME` e `$ x $`.\n\n```bash\nPRICE=$5\necho "$a + $b"\n$$\n```\n';
  const p = protectCode(src);
  const { text, equations } = extractMath(p.text);
  assert.equal(equations.length, 0);
  assert.equal(p.restore(text), src);
});

test('the same formula written twice shares one hash', () => {
  assert.equal(hashLatex('a+b'), hashLatex('  a+b \n'));
});

test('codecogs mode renders a PNG <img> with no registry needed', () => {
  const { html, issues } = build(FM + '# T\n\n$$\\frac{a}{b}$$\n', { config: { equations: 'codecogs' } });
  assert.match(html, /<figure><img src="https:\/\/latex\.codecogs\.com\/png\.image\?/);
  assert.ok(html.includes(encodeURIComponent('\\frac{a}{b}')));
  assert.equal(issues.warnings.length, 0);
});

/* ───────────── code blocks ───────────── */

const CODE = FM + '# T\n\n```python\na = 1\n\nb = 2\n\n\nc = 3\n```\n';

test('blank lines inside code are replaced so Medium cannot split the block', () => {
  const { html } = build(CODE);
  const pre = html.match(/<pre>[\s\S]*?<\/pre>/)[0];
  assert.ok(!/\n\n/.test(pre), 'no empty line may remain');
  assert.equal((pre.match(/&nbsp;/g) || []).length, 3);
  assert.equal((html.match(/<pre>/g) || []).length, 1, 'still ONE block');
});

test('code strategies: zwsp, br, none', () => {
  assert.ok(build(CODE, { config: { codeBlankLines: 'zwsp' } }).html.includes('\u200B'));
  const br = build(CODE, { config: { codeBlankLines: 'br' } }).html;
  assert.match(br, /<pre>a = 1<br><br>b = 2/);
  const none = build(CODE, { config: { codeBlankLines: 'none' } });
  assert.match(none.html, /a = 1\n\nb = 2/);
  assert.ok(has(none.issues, 'warn', /will likely split/));
});

test('code without blank lines is left exactly as is', () => {
  const { html } = build(FM + '# T\n\n```bash\nls\ncd ..\n```\n');
  assert.match(html, /<pre><code>ls\ncd \.\.\n<\/code><\/pre>/);
});

test('triple-backtick used inline (```nome```) is inline code, not a fence', () => {
  const { html } = build(FM + '# T\n\nchama ```do_gripper``` agora.\n\n```py\nx=1\n```\n');
  assert.match(html, /<code>do_gripper<\/code>/);
});

/* ───────────── images ───────────── */

test('local images become raw.githubusercontent.com URLs; spaces and accents are encoded', () => {
  const { html, issues, meta } = build(FM + '# T\n\n![Posição](assets/Posição%20do%20Drone.png)\n', { assets: ['Posição do Drone.png'] });
  assert.ok(
    html.includes('https://raw.githubusercontent.com/me/writing/master/content/story/assets/Posi%C3%A7%C3%A3o%20do%20Drone.png'),
    html,
  );
  assert.equal(issues.errors.length, 0);
  assert.equal(meta.imageCount, 1);
});

test('a missing image is an ERROR and leaves a visible marker', () => {
  const { html, issues } = build(FM + '# T\n\n![x](assets/nope.png)\n');
  assert.equal(issues.errors.length, 1);
  assert.match(html, /MISSING IMAGE/);
});

test('filename case must match exactly (CI is case-sensitive)', () => {
  const { issues } = build(FM + '# T\n\n![x](assets/Foto.PNG)\n', { assets: ['foto.png'] });
  assert.equal(issues.errors.length, 1);
});

test('remote images are untouched', () => {
  const { html } = build(FM + '# T\n\n![x](https://example.com/a b.png)\n'.replace(' b', '-b'));
  assert.ok(html.includes('https://example.com/a-b.png'));
});

test('local mode points at the file on disk (relative to the output folder)', () => {
  const { html } = build(FM + '# T\n\n![x](assets/a.png)\n', { assets: ['a.png'], local: true });
  assert.ok(html.includes('src="../../content/story/assets/a.png"'), html);
});

test('REGRESSION: a bare <img> HTML block is kept (the old tool dropped it)', () => {
  const { html } = build(FM + '# T\n\n<img src="assets/a.png" alt="a" width="300"/>\n', { assets: ['a.png'] });
  assert.match(html, /<figure><img src="https:\/\/raw\.githubusercontent\.com\/[^"]+a\.png" alt="a"><\/figure>/);
  assert.ok(!html.includes('width='));
});

test('<div align=center><img style=…></div> becomes a clean <figure>', () => {
  const { html } = build(FM + '# T\n\n<div align="center">\n    <img src="assets/a.png" alt="A" style="max-width: 400px"/>\n</div>\n', { assets: ['a.png'] });
  assert.ok(!html.includes('<div'));
  assert.ok(!html.includes('style='));
  assert.match(html, /<figure><img /);
});

test('an italic-only line after an image becomes its figcaption', () => {
  const { html } = build(FM + '# T\n\n![a](assets/a.png)\n\n*Legenda da figura.*\n\nOutro parágrafo *com itálico* no meio.\n', { assets: ['a.png'] });
  assert.match(html, /<figcaption>Legenda da figura\.<\/figcaption><\/figure>/);
  assert.match(html, /<p>Outro parágrafo <em>com itálico<\/em> no meio\.<\/p>/);
});

test('two separate <div><img></div> blocks stay two figures with NO side-by-side warning', () => {
  const md = FM + '# T\n\n<div align="center"><img src="assets/a.png" alt="a"/></div>\n\n<div align="center"><img src="assets/b.png" alt="b"/></div>\n';
  const { html, issues } = build(md, { assets: ['a.png', 'b.png'] });
  assert.equal((html.match(/<figure>/g) || []).length, 2);
  assert.ok(!has(issues, 'warn', /side by side/));
});

test('several images in ONE <div> become separate figures plus a warning', () => {
  const md = FM + '# T\n\n<div align="center">\n<img src="assets/a.png" alt="a"/>\n<img src="assets/b.png" alt="b"/>\n</div>\n';
  const { html, issues } = build(md, { assets: ['a.png', 'b.png'] });
  assert.equal((html.match(/<figure>/g) || []).length, 2);
  assert.ok(has(issues, 'warn', /side by side/));
});

test('images referenced only inside <!-- comments --> are ignored', () => {
  const { issues, meta } = build(FM + '# T\n\n<!-- TODO\n<img src="assets/later.png"/>\n-->\n\nTexto');
  assert.equal(issues.errors.length, 0);
  assert.equal(meta.imageCount, 0);
});

/* ───────────── Medium structure rules ───────────── */

test('headings: h2 stays, h3/h5/h6 become h4 (Medium Subheading)', () => {
  const { html } = build(FM + '# T\n\n## a\n\n### b\n\n#### c\n\n##### d\n');
  assert.match(html, /<h2>a<\/h2><h4>b<\/h4><h4>c<\/h4><h4>d<\/h4>/);
});

test('tables become bullet lists', () => {
  const { html, issues } = build(FM + '# T\n\n| Faixa | Altura | Nota |\n|---|---|---|\n| Baixa | 5–120 m | Comum |\n| Alta | ≥ 120 m | Rara |\n');
  assert.ok(!html.includes('<table'));
  assert.ok(html.includes('<li><strong>Baixa</strong> — Altura: 5–120 m; Nota: Comum</li>'), html);
  assert.ok(issues.infos.some((i) => /table/.test(i.msg)));
});

test('nested lists are flattened, task checkboxes removed', () => {
  const { html } = build(FM + '# T\n\n- a\n  - b\n    - c\n- d\n\n- [x] feito\n- [ ] falta\n');
  assert.ok(!/<li>[^<]*<ul>/.test(html));
  assert.ok(!html.includes('<input'));
});

test('blockquote is one clean paragraph with no stray whitespace nodes', () => {
  const { html } = build(FM + '# T\n\n> linha um\n>\n> linha dois\n');
  assert.match(html, /<blockquote><p>linha um<br><br>linha dois<\/p><\/blockquote>/);
});

test('no whitespace-only text nodes between blocks', () => {
  const { html } = build(FM + '# T\n\nA\n\nB\n\n- x\n- y\n');
  assert.ok(!/>\s+</.test(html), html);
});

test('inline HTML like <sub> is kept (not wrapped in a div) and warned about', () => {
  const { html, issues } = build(FM + '# T\n\nO ganho K<sub>p</sub> vale 2.');
  assert.match(html, /K<sub>p<\/sub> vale 2/);
  assert.ok(has(issues, 'warn', /sub|sup/));
});

test('relative links are flagged', () => {
  const { issues } = build(FM + '# T\n\n[x](./outro.md)');
  assert.ok(has(issues, 'warn', /absolute URL/));
});

test('scripts and event handlers are sanitised', () => {
  const { html } = build(FM + '# T\n\n<script>alert(1)</script><img src="https://x.com/a.png" onerror="alert(1)">');
  assert.ok(!html.includes('script'));
  assert.ok(!html.includes('onerror'));
});

/* ───────────── util ───────────── */

test('slugify', () => {
  assert.equal(slugify('Pouso de Precisão!'), 'pouso-de-precisao');
  assert.equal(slugify('package_delivery'), 'package-delivery');
  assert.equal(slugify('  --My Story--  '), 'my-story');
});

test('REGRESSION: $$…$$ inside an HTML comment is not an equation', () => {
  const { meta, html } = build(FM + '# T\n\n<!-- nota: escreva $$ x^2 $$ aqui -->\n\nTexto');
  assert.equal(meta.equations.length, 0);
  assert.ok(!html.includes('x^2'));
});

test('a $ in text after a comment still works normally', () => {
  const { meta } = build(FM + '# T\n\n<!-- nota -->\n\n$$ a^2 + b^2 = c^2 $$\n');
  assert.equal(meta.equations.length, 1);
});

test('codecogs equation images are not counted as story images (or picked as cover)', () => {
  const { meta, html } = build(FM + '# T\n\n$$x^2$$\n\n![c](assets/c.png)\n', { assets: ['c.png'], config: { equations: 'codecogs' } });
  assert.equal(meta.imageCount, 1);
  assert.match(meta.cover.src, /c\.png/);
  assert.ok(!html.includes('data-equation'));
});
