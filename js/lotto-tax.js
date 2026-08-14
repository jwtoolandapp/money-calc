(function (global) {
  'use strict';

  const C = global.CALC_CONSTANTS_2026;
  const MoneyCalc = global.MoneyCalc;
  if (!C || !MoneyCalc) return;

  const ZERO = C.MATH.ZERO;
  const HUNDRED = C.MATH.HUNDRED;
  const LOTTO = C.LOTTO_TAX;

  function nonNegative(value) {
    return Math.max(ZERO, MoneyCalc.parseNumber(value));
  }

  function calculateLottoTax(prizeValue) {
    const source = typeof prizeValue === 'object' && prizeValue !== null
      ? (prizeValue.prize != null ? prizeValue.prize : prizeValue.amount)
      : prizeValue;
    const prize = nonNegative(source);

    // 200만원은 **공제가 아니라 문턱**이다(소득세법 제84조 과세최저한).
    // 건별 당첨금이 200만원 이하이면 과세하지 않고, 1원이라도 넘으면 전액이
    // 과세 대상이 된다. 예전에는 이 금액을 빼고 과세해서 2등(5,000만원) 세금이
    // 1,056만원으로 나왔다 — 실제는 1,100만원이다.
    const taxFreeLimit = LOTTO.TAX_FREE_UP_TO || ZERO;
    const exempt = prize <= taxFreeLimit;
    const taxFreeAmount = exempt ? prize : ZERO;
    const taxableBase = exempt ? ZERO : prize;
    const lowerTaxableAmount = Math.min(taxableBase, LOTTO.THRESHOLD);
    const upperTaxableAmount = Math.max(ZERO, taxableBase - LOTTO.THRESHOLD);
    const lowerBracketTax = lowerTaxableAmount * LOTTO.LOWER_RATE;
    const upperBracketTax = upperTaxableAmount * LOTTO.UPPER_RATE;
    const totalTax = lowerBracketTax + upperBracketTax;
    const netAmount = prize - totalTax;
    const effectiveTaxRate = prize > ZERO ? totalTax / prize * HUNDRED : ZERO;

    return {
      prize,
      taxFreeAmount,
      lowerTaxableAmount,
      upperTaxableAmount,
      lowerBracketTax,
      upperBracketTax,
      totalTax: Number.isFinite(totalTax) ? totalTax : ZERO,
      netAmount: Number.isFinite(netAmount) ? netAmount : ZERO,
      effectiveTaxRate: Number.isFinite(effectiveTaxRate) ? effectiveTaxRate : ZERO,
    };
  }

  global.MoneyCalcCalculators = global.MoneyCalcCalculators || {};
  global.MoneyCalcCalculators.lottoTax = Object.freeze({
    calculateLottoTax,
    calculate: calculateLottoTax,
  });

  if (!global.document) return;

  function initLottoTaxCalculator() {
    const form = document.getElementById('lotto-tax-form');
    if (!form) return;

    const prizeInput = document.getElementById('prize-amount');
    const presetButton = document.getElementById('average-prize-preset');
    const resultValue = document.getElementById('lotto-result-value');
    const resultSummary = document.getElementById('lotto-result-summary');
    const resultDetails = document.getElementById('lotto-result-details');
    const copyButton = document.getElementById('copy-result-link');
    let latestShareUrl = global.location.href;

    MoneyCalc.restoreForm(form, MoneyCalc.queryParams());
    MoneyCalc.setupNumericInputs(form);
    presetButton.title = `현재 참고 프리셋: ${MoneyCalc.formatWon(LOTTO.AVERAGE_FIRST_PRIZE)}`;

    function appendDetail(label, value) {
      const row = document.createElement('div');
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      row.className = 'result-row';
      term.textContent = label;
      description.textContent = value;
      row.append(term, description);
      resultDetails.appendChild(row);
    }

    function calculateAndRender() {
      const result = calculateLottoTax(prizeInput.value);
      resultValue.textContent = MoneyCalc.formatWon(result.netAmount);
      resultSummary.textContent = `당첨금 ${MoneyCalc.formatWon(result.prize)}에서 예상 세금을 뺀 금액입니다.`;
      resultDetails.replaceChildren();
      appendDetail(
        `비과세 구간 (${MoneyCalc.formatWon(LOTTO.TAX_FREE_UP_TO)}까지)`,
        MoneyCalc.formatWon(result.taxFreeAmount)
      );
      appendDetail(
        `${MoneyCalc.formatWon(LOTTO.TAX_FREE_UP_TO)}~${MoneyCalc.formatWon(LOTTO.THRESHOLD)} 구간 세금 (${MoneyCalc.formatPercent(LOTTO.LOWER_RATE * HUNDRED, ZERO)})`,
        MoneyCalc.formatWon(result.lowerBracketTax)
      );
      appendDetail(
        `${MoneyCalc.formatWon(LOTTO.THRESHOLD)} 초과 구간 세금 (${MoneyCalc.formatPercent(LOTTO.UPPER_RATE * HUNDRED, ZERO)})`,
        MoneyCalc.formatWon(result.upperBracketTax)
      );
      appendDetail('예상 총 세금', MoneyCalc.formatWon(result.totalTax));
      appendDetail('실효 세율', MoneyCalc.formatPercent(result.effectiveTaxRate, C.MATH.RATE_DISPLAY_DIGITS));
      latestShareUrl = MoneyCalc.setQuery(MoneyCalc.formToParams(form));
    }

    presetButton.addEventListener('click', () => {
      prizeInput.value = String(LOTTO.AVERAGE_FIRST_PRIZE);
      MoneyCalc.formatNumericInput(prizeInput);
      calculateAndRender();
    });
    form.addEventListener('input', calculateAndRender);
    form.addEventListener('change', calculateAndRender);
    MoneyCalc.bindCopyLink(copyButton, () => latestShareUrl);
    calculateAndRender();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLottoTaxCalculator);
  } else {
    initLottoTaxCalculator();
  }
})(window);
