const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const pages = ['property-holding-tax', 'inheritance-gift-tax', 'national-pension', 'salary-net-pay', 'severance-pay', 'weekly-holiday-pay'];
const expectedTerms = { 'property-holding-tax': 5, 'inheritance-gift-tax': 5, 'national-pension': 5, 'salary-net-pay': 5, 'severance-pay': 5, 'weekly-holiday-pay': 4 };
const context = { window: null, document: {} };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'js', 'glossary.js'), 'utf8'), context);

function decodeHtml(value) {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

for (const slug of pages) {
  const html = fs.readFileSync(path.join(root, slug, 'index.html'), 'utf8');
  // 글로서리는 tools/prerender-glossary.mjs 로 정적 HTML 에 구워져 있어야 한다.
  // JS 주입만으로는 네이버 Yeti 가 읽지 못하므로, 마운트 div 가 아니라
  // 실제로 렌더된 항목 수를 센다.
  assert.equal(context.MoneyCalcGlossary.TERMS[slug].length, expectedTerms[slug], `${slug}: glossary terms`);
  assert.ok(html.includes('class="glossary-section"'), `${slug}: 글로서리 사전 렌더링 누락 (node tools/prerender-glossary.mjs)`);
  assert.equal(
    [...html.matchAll(/<details class="glossary-item"/g)].length,
    expectedTerms[slug],
    `${slug}: 정적 글로서리 항목 수가 TERMS 와 다름`
  );

  const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(jsonLdMatch, `${slug}: FAQPage JSON-LD`);
  const jsonLd = JSON.parse(jsonLdMatch[1]);
  assert.equal(jsonLd['@type'], 'FAQPage', `${slug}: JSON-LD type`);
  assert.equal(jsonLd.mainEntity.length, 4, `${slug}: JSON-LD FAQ count`);

  const articles = [...html.matchAll(/<article class="faq-item"><h3>([\s\S]*?)<\/h3><p>([\s\S]*?)<\/p><\/article>/g)];
  assert.equal(articles.length, 4, `${slug}: visible FAQ count`);
  articles.forEach((match, index) => {
    assert.equal(decodeHtml(match[1]), jsonLd.mainEntity[index].name, `${slug}: FAQ ${index + 1} question`);
    assert.equal(decodeHtml(match[2]), jsonLd.mainEntity[index].acceptedAnswer.text, `${slug}: FAQ ${index + 1} answer`);
  });

  const explanation = html.match(/<div class="placeholder-box">([\s\S]*?)<\/div>/);
  assert.ok(explanation, `${slug}: explanation box`);
  assert.equal([...explanation[1].matchAll(/<p>/g)].length, 3, `${slug}: explanation paragraphs`);
  assert.ok(html.includes('<p class="content-basis">기준일: 2026-08-09, 2026년 제도 기준</p>'), `${slug}: content basis`);
  assert.doesNotMatch(html, /설명 콘텐츠 placeholder|FAQ 제목 placeholder|FAQ 답변 placeholder/, `${slug}: placeholders`);
}

console.log('update3 content audit: PASS');
