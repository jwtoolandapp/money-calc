'use strict';

// placeholder 문구가 배포된 적이 있다. 4차 1단계 계산기 4종이 화면 본문과
// FAQPage JSON-LD 양쪽에 "FAQ 제목 placeholder" 를 그대로 노출한 채 라이브에
// 나가 있었다. 심사 중인 사이트에서 가장 안 좋은 종류의 결함이라,
// 특정 페이지가 아니라 전체 페이지를 대상으로 막는다.
//
// update3-content-audit 에도 같은 검사가 있지만 6개 페이지에만 걸려 있어
// 4차 페이지를 잡지 못했다. 이 파일은 페이지 목록을 하드코딩하지 않는다.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const BANNED = [
  '설명 콘텐츠 placeholder',
  'FAQ 제목 placeholder',
  'FAQ 답변 placeholder',
  'placeholder 텍스트',
  'lorem ipsum',
];

const SKIP_DIRS = new Set(['node_modules', 'tests', 'tools', 'design-preview', '.git', '.wrangler', 'dist']);

const htmlFiles = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.html')) htmlFiles.push(full);
  }
})(root);

assert.ok(htmlFiles.length > 0, 'HTML 페이지를 하나도 찾지 못했습니다');

const failures = [];
for (const file of htmlFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file).split(path.sep).join('/');
  for (const phrase of BANNED) {
    if (text.toLowerCase().includes(phrase.toLowerCase())) {
      failures.push(relative + ': "' + phrase + '" 가 남아 있습니다');
    }
  }

  // FAQPage JSON-LD 가 있으면 화면 FAQ 개수와 맞아야 한다. 한쪽만 채우면
  // 구조화 데이터와 본문이 어긋나 Search Console 이 오류로 잡는다.
  const jsonLd = text.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!jsonLd) continue;
  let parsed;
  try {
    parsed = JSON.parse(jsonLd[1]);
  } catch {
    failures.push(relative + ': JSON-LD 파싱 실패');
    continue;
  }
  if (parsed['@type'] !== 'FAQPage') continue;

  const visible = (text.match(/<article class="faq-item">/g) || []).length;
  if (visible !== parsed.mainEntity.length) {
    failures.push(
      relative + ': 화면 FAQ ' + visible + '개 vs JSON-LD ' + parsed.mainEntity.length + '개'
    );
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('no-placeholder audit: PASS · ' + htmlFiles.length + ' pages');
