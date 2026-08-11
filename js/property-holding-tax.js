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
  const rateForRange = (value, brackets, minKey, maxKey) => {
    const bracket = brackets.find((item) => value >= item[minKey] && (item[maxKey] == null || value < item[maxKey]));
    return bracket ? bracket.rate : ZERO;
  };

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
    // 시행령 제4조의3① 정밀식은 주택분 재산세 합계 × [(종부세 과세표준 × 재산세 공정시장가액비율)
    // × 재산세 표준세율] ÷ 전체 주택 합산 표준세율 재산세 상당액이다. 현재 종부세 입력은 개별 주택별
    // 공시가격을 받지 않아 분모를 재현할 수 없으므로 재산세 탭에서 계산한 본세를 차감하는 간이화를 유지한다.
    const propertyTaxCredit = Math.min(calculatedTax, nonNegative(input.propertyTaxCredit));
    const taxAfterPropertyCredit = Math.max(ZERO, calculatedTax - propertyTaxCredit);
    const age = nonNegative(input.age);
    const holdingYears = nonNegative(input.holdingYears);
    const creditConfig = TAX.COMPREHENSIVE_TAX_CREDIT;
    const elderlyCreditRate = ownershipType === 'single'
      ? rateForRange(age, creditConfig.ELDERLY_BRACKETS, 'minAge', 'maxAge') : ZERO;
    const longTermCreditRate = ownershipType === 'single'
      ? rateForRange(holdingYears, creditConfig.LONG_TERM_BRACKETS, 'minYears', 'maxYears') : ZERO;
    const combinedCreditRate = Math.min(creditConfig.CREDIT_CAP, elderlyCreditRate + longTermCreditRate);
    const singleHouseCredit = taxAfterPropertyCredit * combinedCreditRate;
    const payableTax = Math.max(ZERO, taxAfterPropertyCredit - singleHouseCredit);
    return {
      assessedPrice, ownershipType, deduction, taxBase, calculatedTax, propertyTaxCredit, taxAfterPropertyCredit,
      age, holdingYears, elderlyCreditRate, longTermCreditRate, combinedCreditRate, singleHouseCredit, payableTax,
    };
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
        document.getElementById('property-result-summary').textContent = result.ownershipType === 'single'
          ? `고령자 ${U.formatPercent(result.elderlyCreditRate * 100, 0)} + 장기보유 ${U.formatPercent(result.longTermCreditRate * 100, 0)}를 합산 ${U.formatPercent(result.combinedCreditRate * 100, 0)} 한도로 적용했습니다.`
          : '1세대1주택 고령자·장기보유 세액공제는 적용되지 않는 보유 유형입니다.';
        setRows([
          ['기본공제',U.formatWon(result.deduction)],['과세표준',U.formatWon(result.taxBase)],
          ['산출세액',U.formatWon(result.calculatedTax)],['재산세액공제(간이)',U.formatWon(result.propertyTaxCredit)],
          ['재산세액공제 후 세액',U.formatWon(result.taxAfterPropertyCredit)],
          ['1세대1주택 세액공제',`${U.formatWon(result.singleHouseCredit)} (${U.formatPercent(result.combinedCreditRate * 100, 0)})`],
        ]);
      }
      const q=U.formToParams(form);q.set('mode',mode);U.setQuery(q);return mode;
    }
    buttons.forEach((b)=>b.addEventListener('click',()=>{mode=b.dataset.taxMode;render();}));
    form.addEventListener('input',render);form.addEventListener('change',render);U.bindCopyLink(document.getElementById('copy-property-link'),()=>global.location.href);render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);
