/**
 * data/rates/*.json (tools/fetch-finlife.mjs 산출물) 을 계산기 페이지의
 * 정적 HTML 표로 굽는다. 글로서리와 같은 이유로 JS 주입이 아니라 사전 렌더링이다.
 *
 * 성질: 멱등. 마커 사이만 갈아끼운다.
 * 데이터가 없으면 아무것도 하지 않고 정상 종료한다(인증키 발급 전 상태).
 *
 * 사용법: node tools/render-rates.mjs [--check]
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RATES_DIR = path.join(ROOT, 'data', 'rates');
const CHECK_ONLY = process.argv.includes('--check');

const START = '<!-- rates:start (생성물 — tools/render-rates.mjs 로 갱신) -->';
const END = '<!-- rates:end -->';

const TERM_MONTHS = 12; // 예·적금 표 기준 저축기간
const ROW_LIMIT = 8;

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const formatRate = (value) => (value === null || value === undefined ? '—' : `${value.toFixed(2)}%`);

async function readJson(file) {
  try {
    return JSON.parse(await readFile(path.join(RATES_DIR, file), 'utf8'));
  } catch {
    return null;
  }
}

/** 예·적금: 12개월 최고금리 상위 상품을 뽑는다. */
function topSavingRows(dataset) {
  return (dataset?.products ?? [])
    .map((product) => {
      const option = product.options?.find((candidate) => candidate.months === TERM_MONTHS);
      if (!option) return null;
      return {
        bank: product.bank,
        name: product.name,
        baseRate: option.baseRate,
        maxRate: option.maxRate ?? option.baseRate,
      };
    })
    .filter((row) => row && row.maxRate !== null)
    .sort((a, b) => b.maxRate - a.maxRate)
    .slice(0, ROW_LIMIT);
}

/** 대출: 평균금리가 낮은 상품을 뽑는다. */
function topLoanRows(dataset) {
  return (dataset?.products ?? [])
    .flatMap((product) =>
      (product.options ?? []).map((option) => ({
        bank: product.bank,
        name: product.name,
        rateType: option.rateType,
        minRate: option.minRate,
        averageRate: option.averageRate,
      }))
    )
    .filter((row) => row.averageRate !== null && row.averageRate !== undefined)
    .sort((a, b) => a.averageRate - b.averageRate)
    .slice(0, ROW_LIMIT);
}

function table(headers, rows) {
  return (
    '<div class="rates-table-wrap">' +
      '<table class="rates-table">' +
        '<thead><tr>' + headers.map((h) => `<th scope="col">${escapeHtml(h)}</th>`).join('') + '</tr></thead>' +
        '<tbody>' +
          rows.map((cells) =>
            '<tr>' +
              cells.map((cell, index) =>
                index === 0
                  ? `<th scope="row">${escapeHtml(cell)}</th>`
                  : `<td>${escapeHtml(cell)}</td>`
              ).join('') +
            '</tr>'
          ).join('') +
        '</tbody>' +
      '</table>' +
    '</div>'
  );
}

function sourceNote(meta) {
  return (
    '<p class="rates-source">' +
      `기준일 ${escapeHtml(meta.fetchedAt)} · 출처 ` +
      `<a href="${escapeHtml(meta.source.url)}" rel="nofollow noopener" target="_blank">${escapeHtml(meta.source.name)}</a>` +
      ` (${escapeHtml(meta.finGroupLabel)} 공시 기준)` +
    '</p>'
  );
}

function buildSavingsBlock(meta, deposit, saving) {
  const depositRows = topSavingRows(deposit);
  const savingRows = topSavingRows(saving);
  if (!depositRows.length && !savingRows.length) return null;

  const section = ['<h2 id="rates-heading">지금 은행 금리</h2>'];

  if (depositRows.length) {
    section.push('<h3>정기예금 12개월 · 최고금리 순</h3>');
    section.push(table(
      ['은행', '상품', '기본금리', '최고금리'],
      depositRows.map((row) => [row.bank, row.name, formatRate(row.baseRate), formatRate(row.maxRate)])
    ));
  }

  if (savingRows.length) {
    section.push('<h3>적금 12개월 · 최고금리 순</h3>');
    section.push(table(
      ['은행', '상품', '기본금리', '최고금리'],
      savingRows.map((row) => [row.bank, row.name, formatRate(row.baseRate), formatRate(row.maxRate)])
    ));
  }

  section.push(
    '<p class="rates-caveat">최고금리는 급여이체·카드실적·자동이체 같은 우대조건을 모두 충족했을 때의 금리입니다. ' +
    '조건을 채우지 못하면 기본금리가 적용되므로, 위 계산기에는 <strong>기본금리</strong>를 넣어보는 편이 실제에 가깝습니다.</p>'
  );
  section.push(sourceNote(meta));

  return section.join('');
}

function buildLoanBlock(meta, mortgage, rent) {
  const mortgageRows = topLoanRows(mortgage);
  const rentRows = topLoanRows(rent);
  if (!mortgageRows.length && !rentRows.length) return null;

  const section = ['<h2 id="rates-heading">지금 은행 대출금리</h2>'];

  if (mortgageRows.length) {
    section.push('<h3>주택담보대출 · 평균금리 낮은 순</h3>');
    section.push(table(
      ['은행', '상품', '금리유형', '최저', '평균'],
      mortgageRows.map((row) => [row.bank, row.name, row.rateType, formatRate(row.minRate), formatRate(row.averageRate)])
    ));
  }

  if (rentRows.length) {
    section.push('<h3>전세자금대출 · 평균금리 낮은 순</h3>');
    section.push(table(
      ['은행', '상품', '금리유형', '최저', '평균'],
      rentRows.map((row) => [row.bank, row.name, row.rateType, formatRate(row.minRate), formatRate(row.averageRate)])
    ));
  }

  section.push(
    '<p class="rates-caveat">평균금리는 해당 은행이 직전 달에 실제로 취급한 대출의 평균입니다. ' +
    '개인의 신용점수·담보인정비율(LTV)·상환방식에 따라 실제 적용금리는 달라집니다.</p>'
  );
  section.push(sourceNote(meta));

  return section.join('');
}

function injectBlock(html, inner) {
  const section = [
    START,
    '<section class="rates-section" aria-labelledby="rates-heading">',
    inner,
    '</section>',
    END,
  ].join('\n    ');

  const existing = new RegExp(
    `${START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
  );
  if (existing.test(html)) return html.replace(existing, section);

  // 최초 삽입 지점: 글로서리 바로 앞. 계산 결과 → 금리 표 → 용어 설명 순서가 된다.
  const anchor = html.indexOf(`<!-- glossary:start`);
  if (anchor === -1) return null;
  return `${html.slice(0, anchor)}${section}\n    ${html.slice(anchor)}`;
}

const GENERATED_BLOCK = new RegExp(
  `\\s*${START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
);

/** 데이터가 사라졌는데 예전 표가 페이지에 남아 있으면 낡은 금리를 보여주게 된다. 걷어낸다. */
async function stripGeneratedBlocks() {
  let removed = 0;
  for (const dir of ['savings', 'loan']) {
    const file = path.join(ROOT, dir, 'index.html');
    const html = await readFile(file, 'utf8').catch(() => null);
    if (html === null || !GENERATED_BLOCK.test(html)) continue;
    if (!CHECK_ONLY) await writeFile(file, html.replace(GENERATED_BLOCK, ''), 'utf8');
    removed += 1;
    console.log(`  ${CHECK_ONLY ? '제거 필요' : '제거됨'}  ${dir} (금리 데이터 없음)`);
  }
  return removed;
}

const meta = await readJson('meta.json');
if (!meta) {
  const removed = await stripGeneratedBlocks();
  console.log('data/rates/meta.json 이 없습니다. 먼저 tools/fetch-finlife.mjs 를 실행하세요.');
  console.log('(인증키 발급 전이면 정상입니다 — 금리 표 없이도 사이트는 그대로 동작합니다.)');
  process.exit(CHECK_ONLY && removed ? 1 : 0);
}

const [deposit, saving, mortgage, rent] = await Promise.all([
  readJson('deposit.json'),
  readJson('saving.json'),
  readJson('mortgage.json'),
  readJson('rent.json'),
]);

const targets = [
  { dir: 'savings', build: () => buildSavingsBlock(meta, deposit, saving) },
  { dir: 'loan', build: () => buildLoanBlock(meta, mortgage, rent) },
];

let changed = 0;
for (const target of targets) {
  const inner = target.build();
  if (!inner) {
    console.log(`  건너뜀  ${target.dir} (표에 넣을 데이터 없음)`);
    continue;
  }

  const file = path.join(ROOT, target.dir, 'index.html');
  const html = await readFile(file, 'utf8');
  const next = injectBlock(html, inner);
  if (next === null) {
    console.log(`  건너뜀  ${target.dir} (삽입 기준점인 glossary 블록을 찾지 못함)`);
    continue;
  }
  if (next === html) continue;

  if (!CHECK_ONLY) await writeFile(file, next, 'utf8');
  changed += 1;
  console.log(`  ${CHECK_ONLY ? '갱신 필요' : '갱신됨'}  ${target.dir}`);
}

console.log(`\n금리 표 ${changed}개 페이지 ${CHECK_ONLY ? '갱신 필요' : '갱신'} (기준일 ${meta.fetchedAt})`);

if (CHECK_ONLY && changed) process.exit(1);
