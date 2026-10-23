const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'loan/index.html'), 'utf8');
const block = html.split('<!-- rates:start')[1].split('<!-- rates:end -->')[0];
const bodies = [...block.matchAll(/<tbody>([\s\S]*?)<\/tbody>/g)].map(match => match[1]);
assert.equal(bodies.length, 2);
for (const [index, name] of ['mortgage', 'rent'].entries()) {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'data/rates', name + '.json'), 'utf8'));
  const expected = data.products.flatMap(product => product.options.map((option, index) => ({ ...option,
    detail: option.mortgageType || '저장 자료에 세부조건 없음', bank: product.bank, name: product.name })))
    .filter(row => typeof row.averageRate === 'number' && row.averageRate > 0)
    .sort((a, b) => a.averageRate - b.averageRate).slice(0, 8);
  const rows = [...bodies[index].matchAll(/<tr>([\s\S]*?)<\/tr>/g)];
  assert.equal(rows.length, expected.length);
  rows.forEach((row, i) => {
    const cells = [...row[1].matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/g)].map(match => match[1]);
    assert.deepEqual(cells, [expected[i].bank, expected[i].name, expected[i].rateType,
      expected[i].repayType || '공시 없음', expected[i].detail,
      expected[i].minRate.toFixed(2) + '%', expected[i].averageRate.toFixed(2) + '%']);
  });
}
assert.equal((block.match(/<th scope="col">상환방식<\/th>/g) || []).length, 2);
assert.match(block, /수집 당시의 참고 자료/);
assert.match(block, /원본 공시에 조건이 없다는 뜻이 아니라/);
assert.doesNotMatch(block, /저장자료 \d|조건 미공시/);
assert.match(block, /공시 최저/);
assert.match(block, /전월 평균/);
console.log('loan rate rows: all 16 rows match saved source including repayment type and unchanged rates');

