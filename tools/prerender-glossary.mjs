/**
 * 글로서리("쉬운 용어 설명")를 각 계산기 페이지의 정적 HTML로 굽는다.
 *
 * 왜 필요한가:
 *   js/glossary.js 는 지금까지 innerHTML 로만 콘텐츠를 주입했다. 크롬은 잘 보지만
 *   네이버 Yeti 는 JS 를 거의 실행하지 않아서, 56KB 짜리 용어 설명이 통째로
 *   검색엔진에 안 보이는 상태였다. 이 스크립트가 같은 마크업을 HTML 에 직접 써 넣는다.
 *
 * 성질:
 *   - 멱등(idempotent). 마커 사이만 갈아끼우므로 몇 번을 돌려도 결과가 같다.
 *   - 마크업 생성은 js/glossary.js 의 buildHtml 하나만 쓴다. 브라우저와 결과가 어긋날 수 없다.
 *
 * 사용법:  node tools/prerender-glossary.mjs [--check]
 *          --check 는 파일을 고치지 않고 갱신이 필요한지만 알려준다(CI 용).
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK_ONLY = process.argv.includes('--check');

const START = '<!-- glossary:start (생성물 — tools/prerender-glossary.mjs 로 갱신) -->';
const END = '<!-- glossary:end -->';

/** js/glossary.js 를 Node 에서 평가해 buildHtml 과 TERMS 를 얻는다. */
async function loadGlossaryModule() {
  const source = await readFile(path.join(ROOT, 'js', 'glossary.js'), 'utf8');
  const sandbox = {};
  // glossary.js 는 (function (global) {...})(window ?? globalThis) 형태의 IIFE 다.
  // globalThis 를 가리게 해서 전역을 더럽히지 않고 결과만 받아낸다.
  new Function('globalThis', 'window', source).call(sandbox, sandbox, undefined);
  const api = sandbox.MoneyCalcGlossary;
  if (!api?.buildHtml || !api?.TERMS) {
    throw new Error('js/glossary.js 에서 MoneyCalcGlossary.buildHtml / TERMS 를 찾지 못했습니다.');
  }
  return api;
}

/** 페이지 HTML 에서 MoneyCalcGlossary.render('key') 의 key 를 뽑는다. */
function findPageKey(html) {
  return html.match(/MoneyCalcGlossary\.render\(\s*['"]([^'"]+)['"]/)?.[1] ?? null;
}

function buildSection(html) {
  return [
    START,
    '<section class="glossary-section" aria-labelledby="glossary-heading">',
    html,
    '</section>',
    END,
  ].join('\n    ');
}

/** 마운트 지점(최초 실행) 또는 기존 생성물(재실행)을 새 마크업으로 교체한다. */
function injectSection(html, section) {
  const existing = new RegExp(
    `${escapeRegExp(START)}[\\s\\S]*?${escapeRegExp(END)}`
  );
  if (existing.test(html)) return html.replace(existing, section);

  const mount = /[ \t]*<div id="glossary-mount"><\/div>/;
  if (mount.test(html)) return html.replace(mount, `    ${section}`);

  return null;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findPages() {
  const entries = await readdir(ROOT, { withFileTypes: true });
  const pages = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    if (['node_modules', 'tools', 'tests', 'js', 'css', 'assets', 'fonts', 'content'].includes(entry.name)) continue;
    const file = path.join(ROOT, entry.name, 'index.html');
    try {
      pages.push({ dir: entry.name, file, html: await readFile(file, 'utf8') });
    } catch {
      // index.html 이 없는 디렉터리는 계산기 페이지가 아니다.
    }
  }
  return pages;
}

const glossary = await loadGlossaryModule();
const pages = await findPages();

const updated = [];
const skipped = [];
const missingTerms = [];

for (const page of pages) {
  const key = findPageKey(page.html);
  if (!key) {
    skipped.push(`${page.dir} (글로서리 미사용)`);
    continue;
  }

  const terms = glossary.TERMS[key];
  if (!terms?.length) {
    missingTerms.push(`${page.dir} → render('${key}') 를 부르지만 TERMS 에 항목이 없음`);
    continue;
  }

  const next = injectSection(page.html, buildSection(glossary.buildHtml(terms)));
  if (next === null) {
    skipped.push(`${page.dir} (마운트 지점 없음)`);
    continue;
  }
  if (next === page.html) continue;

  if (!CHECK_ONLY) await writeFile(page.file, next, 'utf8');
  updated.push(`${page.dir} (용어 ${terms.length}개)`);
}

for (const line of updated) console.log(`  ${CHECK_ONLY ? '갱신 필요' : '갱신됨'}  ${line}`);
for (const line of skipped) console.log(`  건너뜀    ${line}`);
for (const line of missingTerms) console.log(`  ⚠ 확인    ${line}`);

console.log(
  `\n페이지 ${pages.length}개 중 ${updated.length}개 ${CHECK_ONLY ? '갱신 필요' : '갱신'}` +
  (missingTerms.length ? `, 용어 미작성 ${missingTerms.length}개` : '')
);

if (CHECK_ONLY && updated.length) {
  console.error('\n사전 렌더링이 최신이 아닙니다. node tools/prerender-glossary.mjs 를 실행하세요.');
  process.exit(1);
}
