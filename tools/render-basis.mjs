/**
 * data/page-basis.json 의 기준일·근거 자료를 각 계산기 페이지에 정적 HTML 로 굽는다.
 *
 * 왜 이게 "두께"인가:
 *   자동생성 페이지와 사람이 만든 페이지를 가르는 건 분량이 아니라
 *   ① 어디서 온 숫자인지(출처) ② 언제 확인한 건지(기준일) ③ 실제 질문에 답하는지(FAQ) 다.
 *   money-calc 는 ③ 은 이미 있고 ①② 가 화면에 없었다. 그 둘을 드러낸다.
 *
 * 성질: 멱등. 마커 사이만 갈아끼운다. 글로서리 사전 렌더링과 같은 방식.
 *
 * 사용법: node tools/render-basis.mjs [--check]
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK_ONLY = process.argv.includes('--check');

const START = '<!-- basis:start (생성물 — tools/render-basis.mjs 로 갱신) -->';
const END = '<!-- basis:end -->';

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const basis = JSON.parse(await readFile(path.join(ROOT, 'data', 'page-basis.json'), 'utf8'));

function buildBlock(slug, page) {
  const parts = [
    '<h2 id="basis-heading">근거 자료와 기준일</h2>',
    `<p class="basis-date">이 페이지의 세율·요율은 <time datetime="${escapeHtml(page.lastReviewed)}">${escapeHtml(page.lastReviewed)}</time> 기준으로 확인했습니다.</p>`,
  ];

  if (page.references.length) {
    parts.push('<ul class="basis-list">');
    for (const reference of page.references) {
      const authority = basis.authorities[reference.authority];
      if (!authority) throw new Error(`${slug}: 알 수 없는 기관 키 "${reference.authority}"`);
      parts.push(
        '<li>' +
          `<span class="basis-title">${escapeHtml(reference.title)}</span>` +
          `<a href="${escapeHtml(authority.url)}" rel="nofollow noopener" target="_blank">${escapeHtml(authority.name)}</a>` +
        '</li>'
      );
    }
    parts.push('</ul>');
  }

  // 근거를 특정하지 못한 계산기에 그럴듯한 출처를 붙이지 않는다. 대신 성격을 밝힌다.
  parts.push(
    page.references.length
      ? '<p class="basis-note">제도는 개정될 수 있습니다. 실제 신고·가입 전에는 위 기관의 최신 자료에서 다시 확인하세요.</p>'
      : '<p class="basis-note">이 계산기는 법정 요율이 아니라 사용자가 입력한 조건으로만 계산합니다. 금융회사·지자체마다 실제 적용 기준이 다를 수 있습니다.</p>'
  );

  return parts.join('');
}

function inject(html, block) {
  const section = [
    START,
    '<section class="basis-section" aria-labelledby="basis-heading">',
    block,
    '</section>',
    END,
  ].join('\n    ');

  const existing = new RegExp(`${escapeRegExp(START)}[\\s\\S]*?${escapeRegExp(END)}`);
  if (existing.test(html)) return html.replace(existing, section);

  // 글로서리 뒤에 붙인다. 용어 설명을 읽은 다음 "이 숫자 어디서 왔나"를 보게 되는 순서.
  const anchor = html.indexOf(END.replace('basis', 'glossary'));
  if (anchor === -1) return null;
  const insertAt = anchor + '<!-- glossary:end -->'.length;
  return `${html.slice(0, insertAt)}\n    ${section}${html.slice(insertAt)}`;
}

let changed = 0;
const missing = [];

for (const [slug, page] of Object.entries(basis.pages)) {
  const file = path.join(ROOT, slug, 'index.html');
  const html = await readFile(file, 'utf8').catch(() => null);
  if (html === null) {
    missing.push(slug);
    continue;
  }

  const next = inject(html, buildBlock(slug, page));
  if (next === null) {
    console.log(`  건너뜀    ${slug} (글로서리 블록이 없어 삽입 위치를 못 찾음)`);
    continue;
  }
  if (next === html) continue;

  if (!CHECK_ONLY) await writeFile(file, next, 'utf8');
  changed += 1;
  console.log(`  ${CHECK_ONLY ? '갱신 필요' : '갱신됨'}  ${slug} (근거 ${page.references.length}건, 기준일 ${page.lastReviewed})`);
}

for (const slug of missing) console.log(`  ⚠ 없음    ${slug}/index.html`);

console.log(`\n${changed}개 페이지 ${CHECK_ONLY ? '갱신 필요' : '갱신'}`);
if (CHECK_ONLY && changed) process.exit(1);
