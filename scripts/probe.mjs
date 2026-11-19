#!/usr/bin/env node
/**
 * Generates medium-stories/_probe/index.html: ONE page that exercises every uncertain Medium
 * paste behaviour. Paste it into a throwaway Medium draft, see which variants survive, then set
 * the winners in medium.config.json (codeBlankLines etc). Run this once, not on every story.
 */
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

import { REPO_ROOT } from './lib/cli.mjs';
import { loadConfig } from './lib/config.mjs';
import { buildPre } from './lib/transforms.mjs';
import { renderPage } from './lib/output.mjs';
import { Issues } from './lib/util.mjs';

const config = loadConfig(REPO_ROOT);
const { document } = new JSDOM('<body></body>').window;

const SAMPLE = `def do_gripper(drone, config, closed):
    pwm = config.servo_closed_pwm if closed else config.servo_open_pwm

    for attempt in range(1, 4):
        if drone.do_servo(pwm_value=pwm):
            return True

    return False`;

const out = [];
out.push('<h1>Medium paste probe</h1>', '<p><em>Paste this whole page into a throwaway draft and check each numbered section.</em></p>');

out.push('<h2>1. Code block with blank lines</h2>', '<p>Each block below holds the same 8 lines (two blank). Which ones stay as ONE block?</p>');
for (const s of ['none', 'nbsp', 'zwsp', 'br']) {
  out.push(`<p><strong>strategy: ${s}</strong></p>`);
  const pre = s === 'none' ? Object.assign(document.createElement('pre'), { innerHTML: `<code>${SAMPLE.replace(/</g, '&lt;')}</code>` }) : buildPre(document, SAMPLE, s);
  out.push(pre.outerHTML);
}

out.push('<h2>2. Image with caption</h2>');
out.push('<p>Does the image upload from the URL, and is the caption kept as a caption?</p>');
out.push('<figure><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Bikesgray.jpg/480px-Bikesgray.jpg" alt="bikes"><figcaption>Caption inside figcaption</figcaption></figure>');

out.push('<h2>3. Equation embed (embed.fun)</h2>');
out.push('<p>Variant A: plain URL paragraph. Does it become an embed by itself, or only after pressing Enter?</p>');
out.push('<p>https://math.embed.fun/ipk3KUvTzjedKK3KPzrMDr</p>');
out.push('<p>Variant B: the URL as a link.</p>');
out.push('<p><a href="https://math.embed.fun/ipk3KUvTzjedKK3KPzrMDr">https://math.embed.fun/ipk3KUvTzjedKK3KPzrMDr</a></p>');

out.push('<h2>4. Headings</h2>', '<h4>This is an h4</h4>', '<p>Is the h2 above a Heading and the h4 a Subheading?</p>');

const meta = { title: 'Medium paste probe', subtitle: '', author: '', date: '', tags: [], extra: {}, cover: null, imageCount: 1, equations: [], words: 0, readingMinutes: 1 };
const dir = path.join(REPO_ROOT, '.medium-preview', '_probe'); // gitignored scratch folder
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'index.html'), renderPage({ slug: '_probe', meta, issues: new Issues(), articleHtml: out.join('\n') }));
console.log(`Wrote ${path.relative(REPO_ROOT, path.join(dir, 'index.html'))}. Open it, click "Copy for Medium", paste into a Medium draft.`);
