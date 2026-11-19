import { escapeHtml } from './util.mjs';

const ICON = { error: '✖', warn: '⚠', info: 'ℹ' };

/** Checklist saved next to each story: the front matter turned into "things to do while publishing". */
export function renderMetaMd(slug, meta, issues, config) {
  const L = [];
  L.push(`# Publishing checklist — ${meta.title}`, '');
  L.push('_Generated from `content/' + slug + '/index.md`. Do not edit; edit the source and rebuild._', '');
  L.push('## In the Medium editor', '');
  L.push(`- [ ] **Title** is the first \`# H1\`: ${meta.title}`);
  if (meta.subtitle) L.push(`- [ ] **Subtitle** (suggested, ${meta.subtitle.length} chars): ${meta.subtitle}`);
  if (meta.tags.length) {
    const over = meta.tags.length > config.maxTags;
    L.push(`- [ ] **Tags** (Medium max ${config.maxTags}${over ? `; you listed ${meta.tags.length}, choose` : ''}): ${meta.tags.join(', ')}`);
  }
  if (meta.cover) L.push(`- [ ] **Cover image**: first image in the story → ${meta.cover.src}`);
  if (meta.author) L.push(`- [ ] **Credits**: ${meta.author}`);
  if (meta.date) L.push(`- [ ] **Date** in source: ${meta.date}`);
  for (const [k, v] of Object.entries(meta.extra)) L.push(`- [ ] **${k}**: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
  const embeds = meta.equations.filter((e) => e.status === 'ok' && e.url);
  if (embeds.length) {
    L.push(`- [ ] **${embeds.length} equation embed(s)**: after pasting, if a URL line didn't turn into an embed, put the cursor at the end of that line and press Enter.`);
  }
  L.push('', '## Stats', '', `${meta.words} words · ~${meta.readingMinutes} min read · ${meta.imageCount} image(s) · ${meta.equations.length} equation(s)`, '');
  if (issues.items.length) {
    L.push('## Build notes', '');
    for (const i of issues.items) L.push(`- ${ICON[i.level]} ${i.msg}`);
    L.push('');
  }
  return L.join('\n');
}

/** Markdown summary used for medium-stories/REPORT.md and the GitHub Actions job summary. */
export function renderReport(results) {
  const L = ['# Medium build report', ''];
  for (const r of results) {
    const e = r.issues.errors.length;
    const w = r.issues.warnings.length;
    const status = r.skipped ? `skipped (${r.skipped})` : e ? `❌ ${e} error(s), ${w} warning(s)` : w ? `⚠️ ${w} warning(s)` : '✅ clean';
    L.push(`## ${r.slug} — ${status}`, '');
    for (const i of r.issues.items.filter((x) => x.level !== 'info' || !r.skipped)) L.push(`- ${ICON[i.level]} ${i.msg}`);
    if (!r.issues.items.length) L.push('- nothing to report');
    L.push('');
  }
  return L.join('\n');
}

/** Self-contained page: checklist panel + the article + a Copy button. Only #medium-content is copied. */
export function renderPage({ slug, meta, issues, articleHtml, local, banner }) {
  const li = (items) => items.map((x) => `<li>${x}</li>`).join('');
  const eq = meta.equations.map((e) => {
    const state = e.status === 'ok' ? (e.url ? `<a href="${escapeHtml(e.url)}">${escapeHtml(e.url)}</a>` : 'image') : e.status === 'pending' ? '<b>URL missing</b>' : 'left as text';
    return `<code>${escapeHtml(e.latex.slice(0, 60))}</code> → ${state}`;
  });
  const notes = issues.items.map((i) => `<span class="${i.level}">${ICON[i.level]}</span> ${escapeHtml(i.msg)}`);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(meta.title)} — Medium paste page</title>
<style>
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;background:#fafaf8;color:#1a1917}
  header{position:sticky;top:0;z-index:5;display:flex;gap:12px;align-items:center;justify-content:space-between;padding:10px 20px;background:#fff;border-bottom:1px solid #ddd}
  header .t{font-size:13px;color:#5a5955;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  button{font-size:14px;font-weight:600;font-family:inherit;padding:8px 18px;border:1px solid #1a8a6e;border-radius:7px;background:#1a8a6e;color:#fff;cursor:pointer}
  button.ok{background:#fff;color:#1a8a6e}
  button.fail{background:#c0392b;border-color:#c0392b}
  .banner{margin:16px auto 0;max-width:680px;padding:10px 14px;border-radius:7px;background:#fff8e6;border:1px solid #e2c36a;color:#7a5c00;font-size:13px}
  details{max-width:680px;margin:12px auto 0;font-size:13px}
  summary{cursor:pointer;font-weight:600}
  details ul{line-height:1.7;padding-left:20px}
  .error{color:#c0392b}.warn{color:#b07d00}.info{color:#888}
  article{max-width:680px;margin:20px auto 80px;padding:0 20px;font-family:Georgia,"Times New Roman",serif;font-size:18px;line-height:1.75}
  article h1{font-size:34px;line-height:1.2}
  article h2{font-size:26px;margin-top:36px}
  article h4{font-size:20px;margin-top:28px}
  article img{max-width:100%}
  article figure{margin:20px 0}
  article figcaption{font-size:14px;color:#777;text-align:center}
  article pre{background:#f2f1ee;padding:14px;overflow-x:auto;font-size:13.5px;line-height:1.5;border-radius:6px}
  article blockquote{border-left:3px solid #ccc;margin-left:0;padding-left:16px;color:#555;font-style:italic}
</style>
</head>
<body>
<header>
  <div class="t">${escapeHtml(meta.title)}</div>
  <button id="copy" onclick="copyForMedium()">Copy for Medium</button>
</header>
${banner ? `<div class="banner">${escapeHtml(banner)}</div>` : ''}
${local ? '<div class="banner"><b>LOCAL PREVIEW.</b> Image paths are relative to your disk, so Medium cannot fetch them. Run a normal build (without <code>--local</code>) before pasting.</div>' : ''}
<details open><summary>Publishing checklist (not copied)</summary><ul>
${li([
  `<b>Title</b>: ${escapeHtml(meta.title)}`,
  meta.subtitle ? `<b>Subtitle</b> (suggested): ${escapeHtml(meta.subtitle)}` : '',
  meta.tags.length ? `<b>Tags</b>: ${escapeHtml(meta.tags.join(', '))}` : '',
  meta.cover ? `<b>Cover image</b>: ${escapeHtml(meta.cover.src)}` : '',
  meta.author ? `<b>Credits</b>: ${escapeHtml(meta.author)}` : '',
  `${meta.words} words · ~${meta.readingMinutes} min · ${meta.imageCount} image(s)`,
].filter(Boolean))}
</ul></details>
${eq.length ? `<details open><summary>Equations (${eq.length}) — after pasting, press Enter at the end of any URL line that did not become an embed</summary><ul>${li(eq)}</ul></details>` : ''}
${notes.length ? `<details><summary>Build notes (${notes.length})</summary><ul>${li(notes)}</ul></details>` : ''}
<article id="medium-content">${articleHtml}</article>
<script>
async function copyForMedium(){
  const btn = document.getElementById('copy');
  const el = document.getElementById('medium-content');
  const flash = (label, cls) => { btn.textContent = label; btn.className = cls; setTimeout(() => { btn.textContent = 'Copy for Medium'; btn.className = ''; }, 2500); };
  if (navigator.clipboard && window.ClipboardItem) {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([el.innerHTML], { type: 'text/html' }),
        'text/plain': new Blob([el.innerText], { type: 'text/plain' })
      })]);
      return flash('Copied!', 'ok');
    } catch (e) { /* fall through to the legacy path */ }
  }
  const sel = getSelection(); const range = document.createRange();
  range.selectNodeContents(el); sel.removeAllRanges(); sel.addRange(range);
  let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
  sel.removeAllRanges();
  flash(ok ? 'Copied!' : 'Blocked — select all (Ctrl+A) and copy by hand', ok ? 'ok' : 'fail');
}
document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') { e.preventDefault(); copyForMedium(); } });
</script>
</body>
</html>
`;
}
