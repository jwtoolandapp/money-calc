/**
 * data/glossary-additions.json 의 용어를 js/glossary.js 의 각 페이지 배열 끝에 붙인다.
 *
 * 왜 도구로 만들었나:
 *   23개 페이지에 2개씩 손으로 끼워 넣으면 배열 닫는 위치를 한 번만 잘못 잡아도
 *   파일 전체가 깨진다. 페이지 키로 구간을 잡고 그 구간의 마지막 '],' 앞에 넣는다.
 *
 * 성질: 같은 이름의 용어가 이미 있으면 건너뛴다. 두 번 실행해도 결과가 같다.
 *
 * 사용법: node tools/add-glossary-terms.mjs [--check]
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK_ONLY = process.argv.includes('--check');

const GLOSSARY_PATH = path.join(ROOT, 'js', 'glossary.js');
const source = await readFile(GLOSSARY_PATH, 'utf8');
const data = JSON.parse(await readFile(path.join(ROOT, 'data', 'glossary-additions.json'), 'utf8'));

/** 하이픈이 없는 키는 따옴표 없이 쓰여 있어(savings: [) 두 형태를 모두 받는다. */
function pageRanges(text) {
  const keys = [...text.matchAll(/^ {4}'?([a-z0-9-]+)'?: \[$/gm)];
  return keys.map((match, index) => ({
    page: match[1],
    start: match.index,
    end: index + 1 < keys.length ? keys[index + 1].index : text.length,
  }));
}

function quote(text) {
  return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function renderTerm(entry) {
  return [
    '      {',
    `        term: ${quote(entry.term)},`,
    `        normal: ${quote(entry.normal)},`,
    `        easy: ${quote(entry.easy)},`,
    `        example: ${quote(entry.example)}`,
    '      }',
  ].join('\n');
}

let output = source;
let added = 0;
const problems = [];

// 뒤에서부터 삽입해야 앞쪽 인덱스가 밀리지 않는다.
for (const range of pageRanges(output).reverse()) {
  const entries = data.additions[range.page];
  if (!entries) continue;

  let block = output.slice(range.start, range.end);
  const pending = entries.filter((entry) => !block.includes(`term: ${quote(entry.term)}`));
  if (!pending.length) continue;

  // 이 페이지 배열을 닫는 '\n    ],' 위치. 페이지 구간 안에서 마지막에 나온다.
  const closeIndex = block.lastIndexOf('\n    ]');
  if (closeIndex === -1) {
    problems.push(`${range.page}: 배열 닫는 위치를 찾지 못했습니다`);
    continue;
  }

  const insertion = ',\n' + pending.map(renderTerm).join(',\n');
  block = block.slice(0, closeIndex) + insertion + block.slice(closeIndex);
  added += pending.length;

  output = output.slice(0, range.start) + block + output.slice(range.end);
}

for (const problem of problems) console.log(`  ⚠ ${problem}`);

if (!CHECK_ONLY && output !== source) {
  await writeFile(GLOSSARY_PATH, output, 'utf8');
}

console.log(`용어 ${added}개 ${CHECK_ONLY ? '추가 필요' : '추가'}`);
if (problems.length) process.exitCode = 1;
else if (CHECK_ONLY && added) process.exitCode = 1;
