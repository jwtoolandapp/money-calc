const assert = require('node:assert/strict');
(async () => {
  const { shapeLoanProducts } = await import('../tools/fetch-finlife.mjs');
  const base = { fin_co_no: 'bank', fin_prdt_cd: 'loan', kor_co_nm: '은행', fin_prdt_nm: '상품' };
  const option = { ...base, lend_rate_type_nm: '변동', rpay_type_nm: '분할',
    lend_rate_min: '5.15', lend_rate_max: '7', lend_rate_avg: '4.11' };
  const [product] = shapeLoanProducts({ baseList: [base], optionList: [
    { ...option, mrtg_type_nm: '아파트', mrtg_type: 'A', lend_rate_type:'V', rpay_type:'D' },
    { ...option, mrtg_type_nm: '아파트외', mrtg_type:'B', lend_rate_avg:'4.16' },
    option,
  ] });
  assert.equal(product.options[0].mortgageType, '아파트');
  assert.equal(product.options[1].mortgageTypeCode, 'B');
  assert.equal(product.options[0].rateTypeCode, 'V');
  assert.equal(product.options[0].repayTypeCode, 'D');
  assert.equal(product.options[2].mortgageType, null);
  assert.equal(product.options[2].mortgageTypeCode, null);
  assert.deepEqual(product.options.map(x => x.averageRate), [4.11,4.16,4.11]);
  console.log('loan option details: preserve supplied source values; do not invent missing metadata');
})().catch(error => { console.error(error); process.exitCode = 1; });
