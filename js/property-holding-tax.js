(function (global) {
  'use strict';
  const C = global.CALC_CONSTANTS_2026;
  const U = global.MoneyCalc;
  if (!C || !U) return;
  const TAX = C.PROPERTY_HOLDING_TAX;
  const ZERO = C.MATH.ZERO;
  const nonNegative = (value) => Math.max(ZERO, U.parseNumber(value));
  const bracketFor = (value, brackets) => brackets.find((item) => item.upTo == null || value <= item.upTo) || brackets[brackets.length - 1];
  const progressiveTax = (value, brackets) => { const bracket = bracketFor(value, brackets); return Math.max(ZERO, value * bracket.rate - bracket.quickDeduction); };

  function calculatePropertyTax(input) {
    const assessedPrice = nonNegative(input.assessedPrice);
    const houseCount = Math.max(1, Math.floor(nonNegative(input.houseCount) || 1));
    const special = houseCount === 1 && assessedPrice <= TAX.SINGLE_HOUSE_SPECIAL_PRICE_LIMIT;
    let ratio = TAX.FAIR_MARKET_VALUE_RATIO.STANDARD;
    if (special) {
      if (assessedPrice <= 300000000) ratio = TAX.FAIR_MARKET_VALUE_RATIO.SPECIAL_LOW;
      else if (assessedPrice <= 600000000) ratio = TAX.FAIR_MARKET_VALUE_RATIO.SPECIAL_MID;
      else ratio = TAX.FAIR_MARKET_VALUE_RATIO.SPECIAL_HIGH;
    }
    const taxBase = assessedPrice * ratio;
    const brackets = special ? TAX.HOUSE_TAX_BRACKETS_SPECIAL : TAX.HOUSE_TAX_BRACKETS_STANDARD;
    const houseTax = progressiveTax(taxBase, brackets);
    const urbanAreaTax = taxBase * TAX.URBAN_AREA_RATE;
    const localEducationTax = houseTax * TAX.LOCAL_EDU_TAX_RATE;
    return { assessedPrice, houseCount, special, ratio, taxBase, houseTax, urbanAreaTax, localEducationTax, totalTax: houseTax + urbanAreaTax + localEducationTax };
  }

  function calculateComprehensiveTax(input) {
    const assessedPrice = nonNegative(input.comprehensivePrice);
    const ownershipType = ['single', 'under2', 'over3'].includes(input.ownershipType) ? input.ownershipType : 'single';
    const deduction = ownershipType === 'single' ? TAX.COMPREHENSIVE_TAX_DEDUCTION.SINGLE_HOUSE : TAX.COMPREHENSIVE_TAX_DEDUCTION.STANDARD;
    const taxBase = Math.max(ZERO, assessedPrice - deduction) * TAX.COMPREHENSIVE_FAIR_MARKET_VALUE_RATIO;
    const brackets = ownershipType === 'over3' ? TAX.COMPREHENSIVE_TAX_BRACKETS_OVER_3 : TAX.COMPREHENSIVE_TAX_BRACKETS_UNDER_2;
    const calculatedTax = progressiveTax(taxBase, brackets);
    const propertyTaxCredit = Math.min(calculatedTax, nonNegative(input.propertyTaxCredit));
    return { assessedPrice, ownershipType, deduction, taxBase, calculatedTax, propertyTaxCredit, payableTax: Math.max(ZERO, calculatedTax - propertyTaxCredit), age: nonNegative(input.age), holdingYears: nonNegative(input.holdingYears) };
  }

  global.MoneyCalcCalculators = global.MoneyCalcCalculators || {};
  global.MoneyCalcCalculators.propertyHoldingTax = Object.freeze({ calculatePropertyTax, calculateComprehensiveTax });
  if (typeof document === 'undefined') return;
  function init() {
    const form = document.getElementById('property-holding-tax-form'); if (!form) return;
    const buttons = Array.from(document.querySelectorAll('[data-tax-mode]'));
    const panels = Array.from(form.querySelectorAll('[data-tax-panel]'));
    let mode = 'property';
    U.setupNumericInputs(form); U.restoreForm(form); const params = U.queryParams(); if (params.get('mode') === 'comprehensive') mode = 'comprehensive';
    const value = (name) => form.elements[name] ? U.parseNumber(form.elements[name].value) : ZERO;
    const setRows = (rows) => { document.getElementById('property-result-details').innerHTML = rows.map(([a,b]) => `<div class="result-row"><dt>${a}</dt><dd>${b}</dd></div>`).join(''); };
    function render() {
      buttons.forEach((b) => b.setAttribute('aria-pressed', b.dataset.taxMode === mode ? 'true' : 'false'));
      panels.forEach((p) => U.setHidden(p, p.dataset.taxPanel !== mode));
      if (mode === 'property') {
        const result = calculatePropertyTax({ assessedPrice: value('assessedPrice'), houseCount: value('houseCount') });
        document.getElementById('property-result-label').textContent = '예상 재산세 합계';
        document.getElementById('property-result-value').textContent = U.formatWon(Math.round(result.totalTax));
        document.getElementById('property-result-summary').textContent = `${result.special ? '1세대1주택 특례' : '표준'} 공정시장가액비율 ${(result.ratio * 100).toFixed(0)}%를 적용했습니다.`;
        setRows([['과세표준',U.formatWon(result.taxBase)],['재산세 본세',U.formatWon(result.houseTax)],['도시지역분',U.formatWon(result.urbanAreaTax)],['지방교육세',U.formatWon(result.localEducationTax)]]);
        form.elements.propertyTaxCredit.value = U.formatNumber(Math.round(result.houseTax), 0);
      } else {
        const result = calculateComprehensiveTax({ comprehensivePrice:value('comprehensivePrice'), ownershipType:form.elements.ownershipType.value, propertyTaxCredit:value('propertyTaxCredit'), age:value('age'), holdingYears:value('holdingYears') });
        document.getElementById('property-result-label').textContent = '예상 종합부동산세';
        document.getElementById('property-result-value').textContent = U.formatWon(Math.round(result.payableTax));
        document.getElementById('property-result-summary').textContent = '고령자·장기보유 세액공제와 세부담상한은 계산에 반영하지 않았습니다.';
        setRows([['기본공제',U.formatWon(result.deduction)],['과세표준',U.formatWon(result.taxBase)],['산출세액',U.formatWon(result.calculatedTax)],['재산세액공제(간이)',U.formatWon(result.propertyTaxCredit)]]);
      }
      const q=U.formToParams(form);q.set('mode',mode);U.setQuery(q);return mode;
    }
    buttons.forEach((b)=>b.addEventListener('click',()=>{mode=b.dataset.taxMode;render();}));
    form.addEventListener('input',render);form.addEventListener('change',render);U.bindCopyLink(document.getElementById('copy-property-link'),()=>global.location.href);render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);
