/**
 * STEP 5 audit helper — runs axe-core against HTML snippets that mirror the
 * real CommentItem markup patterns in src/components/mod-comments.tsx.
 *
 * Why a standalone script: jsdom@30 is ESM-only and cannot be required from
 * Jest's CJS runtime (ts-jest), but works in plain Node >= 22. axe-core must
 * be dynamically imported AFTER globals exist, and all patterns live in ONE
 * document (axe caches the window per run).
 *
 * Usage:  node scripts/audit-comment-a11y.mjs
 * Output: src/__tests__/comment-a11y-axe.snapshot.json (asserted by
 *         src/__tests__/comments-step5-uix.test.ts » 4.1 axe-core …)
 */
import { JSDOM } from 'jsdom';
import { writeFileSync } from 'node:fs';

const SECTIONS = {
  // Mirrors mod-comments.tsx:825 (palette toggle, no title/aria) + :832-847 (color swatches, no label)
  bad: `<button class="grid h-6 w-6 place-items-center"><svg aria-hidden="true"></svg></button>` +
    `<button style="background-color:#ef4444"></button>`,
  // Mirrors :385-463 title="عريض **نص**" etc.
  titled: `<button title="عريض"><svg aria-hidden="true"></svg></button>`,
  // Mirrors :916-927 aria-pressed={liked} + visible count
  like: `<button aria-pressed="false">5</button>`,
};

const body = Object.entries(SECTIONS)
  .map(([id, html]) => `<section id="axe-${id}">${html}</section>`)
  .join('');
const dom = new JSDOM(
  `<!DOCTYPE html><html lang="ar" dir="rtl"><head><title>t</title></head><body><main>${body}</main></body></html>`,
);

globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.Node = dom.window.Node;
globalThis.Element = dom.window.Element;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.getComputedStyle = dom.window.getComputedStyle;

// axe-core snapshots the environment at import time → dynamic import AFTER globals.
const { default: axe } = await import('axe-core');

const bySection = {};
for (const [id] of Object.entries(SECTIONS)) {
  const context = dom.window.document.querySelector(`#axe-${id}`);
  // eslint-disable-next-line no-await-in-loop
  const r = await axe.run(context, { resultTypes: ['violations'] });
  bySection[id] = r.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.length,
    help: v.help,
  }));
  console.log(id, '→', bySection[id].length ? JSON.stringify(bySection[id]) : 'clean');
}

writeFileSync(
  new URL('../src/__tests__/comment-a11y-axe.snapshot.json', import.meta.url),
  `${JSON.stringify({ generatedBy: 'node scripts/audit-comment-a11y.mjs', bySection }, null, 2)}\n`,
);
console.log('wrote src/__tests__/comment-a11y-axe.snapshot.json');
