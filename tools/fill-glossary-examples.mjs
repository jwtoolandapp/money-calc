/**
 * js/glossary.js 의 비어 있는 example 필드를 data/glossary-examples.json 값으로 채운다.
 *
 * 왜 분리했나:
 *   "예시"는 '더 쉽게 설명' 모드에서만 보이는 가장 구체적인 부분인데 130개 용어 중
 *   81개가 비어 있었다. 그 상태로는 쉬운 설명이 반쪽짜리다. 81개를 손으로 끼워
 *   넣으면 엉뚱한 용어 자리에 들어가기 쉬워서, 용어명을 키로 맞춰 넣는다.
 *
 * 성질: 이미 예시가 있는 용어는 건드리지 않는다(example: null 인 것만 채운다).
 *       한 번 채우고 나면 다시 실행해도 바뀌는 게 없다.
 *
 * 사용법: node tools/fill-glossary-examples.mjs [--check]
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK_ONLY = process.argv.includes('--check');

const source = await readFile(path.join(ROOT, 'js', 'glossary.js'), 'utf8');
const data = JSON.parse(await readFile(path.join(ROOT, 'data', 'glossary-examples.json'), 'utf8'));

/**
 * 소스에서 페이지 키가 시작하는 위치들을 찾아 각 페이지의 구간을 정한다.
 * 하이픈이 없는 키는 따옴표 없이 쓰여 있어(savings: [) 두 형태를 모두 받는다.
 */
function pageRanges(text) {
  const keys = [...text.matchAll(/^ {4}'?([a-z0-9-]+)'?: \[$/gm)];
  return keys.map((match, index) => ({
    page: match[1],
    start: match.index,
    end: index + 1 < keys.length ? keys[index + 1].index : text.length,
  }));
}

function escapeForSingleQuoted(text) {
  return text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

let output = source;
let filled = 0;
const problems = [];

// 뒤에서부터 치환해야 앞쪽 인덱스가 밀리지 않는다.
const ranges = pageRanges(output).reverse();

for (const range of ranges) {
  const examples = data.examples[range.page];
  if (!examples) continue;

  let block = output.slice(range.start, range.end);

  for (const [term, example] of Object.entries(examples)) {
    // 해당 용어 블록 안의 example: null 만 바꾼다. 용어명으로 위치를 잡으므로
    // 다른 용어의 예시 자리에 잘못 들어갈 수 없다.
    const termIndex = block.indexOf(`term: '${term}'`);
    if (termIndex === -1) {
      problems.push(`${range.page}: '${term}' 용어를 찾지 못했습니다`);
      continue;
    }
    const nullIndex = block.indexOf('example: null', termIndex);
    if (nullIndex === -1) continue; // 이미 예시가 있음

    // 다음 용어 시작 전까지의 범위 안에 있는지 확인한다.
    const nextTerm = block.indexOf("term: '", termIndex + 1);
    if (nextTerm !== -1 && nullIndex > nextTerm) continue;

    block = block.slice(0, nullIndex) +
      `example: '${escapeForSingleQuoted(example)}'` +
      block.slice(nullIndex + 'example: null'.length);
    filled += 1;
  }

  output = output.slice(0, range.start) + block + output.slice(range.end);
}

for (const problem of problems) console.log(`  ⚠ ${problem}`);

if (!CHECK_ONLY && output !== source) {
  await writeFile(path.join(ROOT, 'js', 'glossary.js'), output, 'utf8');
}

console.log(`예시 ${filled}개 ${CHECK_ONLY ? '채울 수 있음' : '채움'}`);
if (problems.length) process.exit(1);
if (CHECK_ONLY && filled) process.exit(1);
