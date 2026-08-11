/**
 * 4차 1단계 계산기 4종의 설명 본문·FAQ·FAQPage JSON-LD 를 채운다.
 *
 * 초기 구현이 'placeholder' 문자열을 그대로 배포해 화면 본문과 구조화 데이터
 * 양쪽에 "FAQ 제목 placeholder" 가 노출돼 있었다. 심사 중인 사이트에서
 * 가장 안 좋은 종류의 결함이라 데이터로 분리해 굽는다.
 *
 * 성질: 멱등. 화면 FAQ 와 JSON-LD 는 같은 원본에서 나오므로 어긋날 수 없다.
 * 사용법: node tools/render-update4-content.mjs [--check]
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK_ONLY = process.argv.includes('--check');

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const content = JSON.parse(await readFile(path.join(ROOT, 'data', 'update4-content.json'), 'utf8'));

/** 설명 섹션: content-placeholder 안의 placeholder-box 를 실제 문단으로 채운다. */
function renderExplanation(page) {
  const paragraphs = page.paragraphs.map((text) => `<p>${escapeHtml(text)}</p>`).join('');
  return `<div class="placeholder-box">${paragraphs}</div>`;
}

function renderFaqArticles(page) {
  return page.faqs
    .map(([question, answer]) =>
      `<article class="faq-item"><h3>${escapeHtml(question)}</h3><p>${escapeHtml(answer)}</p></article>`
    )
    .join('');
}

/** 화면 FAQ 와 같은 원본에서 만든다. 둘이 다르면 구조화 데이터 오류가 된다. */
function renderFaqJsonLd(page) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: page.faqs.map(([question, answer]) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  });
}

let changed = 0;
const problems = [];

for (const [slug, page] of Object.entries(content.pages)) {
  const file = path.join(ROOT, slug, 'index.html');
  const html = await readFile(file, 'utf8').catch(() => null);
  if (html === null) {
    problems.push(`${slug}/index.html 이 없습니다`);
    continue;
  }

  let next = html;

  // 1) 설명 문단
  const boxPattern = /<div class="placeholder-box">[\s\S]*?<\/div>/;
  if (!boxPattern.test(next)) {
    problems.push(`${slug}: placeholder-box 를 찾지 못했습니다`);
    continue;
  }
  next = next.replace(boxPattern, renderExplanation(page));

  // 2) 화면 FAQ — 기존 faq-item 들을 통째로 교체한다.
  const faqPattern = /(<div class="faq-list">)[\s\S]*?(<\/div>)/;
  if (!faqPattern.test(next)) {
    problems.push(`${slug}: faq-list 를 찾지 못했습니다`);
    continue;
  }
  next = next.replace(faqPattern, `$1${renderFaqArticles(page)}$2`);

  // 3) FAQPage JSON-LD
  const jsonLdPattern = /<script type="application\/ld\+json">[\s\S]*?<\/script>/;
  if (!jsonLdPattern.test(next)) {
    problems.push(`${slug}: FAQPage JSON-LD 를 찾지 못했습니다`);
    continue;
  }
  next = next.replace(
    jsonLdPattern,
    `<script type="application/ld+json">${renderFaqJsonLd(page)}</script>`
  );

  if (next === html) continue;
  if (!CHECK_ONLY) await writeFile(file, next, 'utf8');
  changed += 1;
  console.log(`  ${CHECK_ONLY ? '갱신 필요' : '갱신됨'}  ${slug} (문단 ${page.paragraphs.length} · FAQ ${page.faqs.length})`);
}

for (const problem of problems) console.log(`  ⚠ ${problem}`);

console.log(`\n${changed}개 페이지 ${CHECK_ONLY ? '갱신 필요' : '갱신'}`);
if (problems.length) process.exit(1);
if (CHECK_ONLY && changed) process.exit(1);
