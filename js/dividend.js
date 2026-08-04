(function (global) {
  'use strict';

  const C = global.CALC_CONSTANTS_2026;
  const MATH = C.MATH;
  const TAX = C.FINANCIAL_TAX;
  const ZERO = MATH.ZERO;
  const ONE = MATH.ONE;
  const HUNDRED = MATH.HUNDRED;
  const MONTHS_PER_YEAR = MATH.MONTHS_PER_YEAR;
  const DAYS_PER_YEAR = MATH.DAYS_PER_YEAR;
  const DIVIDEND_TAX_RATE = TAX.DIVIDEND_WITHHOLDING_TAX_RATE;

  function nonNegativeNumber(value) {
    const parsed = typeof value === 'number'
      ? value
      : Number.parseFloat(String(value == null ? '' : value).replace(/,/g, ''));
    return Number.isFinite(parsed) ? Math.max(ZERO, parsed) : ZERO;
  }

  function firstValue(source, keys) {
    const input = source || {};
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(input, key) && input[key] !== '') return input[key];
    }
    return ZERO;
  }

  function normalizeForwardOptions(investmentOrOptions, annualYieldPercent) {
    if (investmentOrOptions && typeof investmentOrOptions === 'object') return investmentOrOptions;
    return { investment: investmentOrOptions, annualYieldPercent };
  }

  function normalizeReverseOptions(monthlyTargetOrOptions, annualYieldPercent) {
    if (monthlyTargetOrOptions && typeof monthlyTargetOrOptions === 'object') return monthlyTargetOrOptions;
    return { monthlyNetTarget: monthlyTargetOrOptions, annualYieldPercent };
  }

  function calculateDividend(investmentOrOptions, annualYieldPercent) {
    const options = normalizeForwardOptions(investmentOrOptions, annualYieldPercent);
    const investment = nonNegativeNumber(firstValue(options, ['investment', 'principal', 'capital']));
    const yieldPercent = nonNegativeNumber(firstValue(options, [
      'annualYieldPercent',
      'annualYield',
      'dividendYieldPercent',
      'yieldRate',
      'yield',
    ]));
    const annualYieldRate = yieldPercent / HUNDRED;
    const grossAnnualDividend = investment * annualYieldRate;
    const withholdingTax = grossAnnualDividend * DIVIDEND_TAX_RATE;
    const netAnnualDividend = Math.max(ZERO, grossAnnualDividend - withholdingTax);
    const grossMonthlyDividend = grossAnnualDividend / MONTHS_PER_YEAR;
    const netMonthlyDividend = netAnnualDividend / MONTHS_PER_YEAR;
    const netDailyDividend = netAnnualDividend / DAYS_PER_YEAR;

    return {
      investment,
      yieldPercent,
      annualYieldRate,
      dividendTaxRate: DIVIDEND_TAX_RATE,
      grossAnnualDividend,
      annualGrossDividend: grossAnnualDividend,
      withholdingTax,
      tax: withholdingTax,
      netAnnualDividend,
      annualNetDividend: netAnnualDividend,
      grossMonthlyDividend,
      netMonthlyDividend,
      monthlyNetDividend: netMonthlyDividend,
      netDailyDividend,
      dailyNetDividend: netDailyDividend,
    };
  }

  function calculateRequiredInvestment(monthlyTargetOrOptions, annualYieldPercent) {
    const options = normalizeReverseOptions(monthlyTargetOrOptions, annualYieldPercent);
    const monthlyNetTarget = nonNegativeNumber(firstValue(options, [
      'monthlyNetTarget',
      'monthlyTarget',
      'targetMonthlyNet',
      'target',
    ]));
    const yieldPercent = nonNegativeNumber(firstValue(options, [
      'annualYieldPercent',
      'annualYield',
      'dividendYieldPercent',
      'yieldRate',
      'yield',
    ]));
    const annualYieldRate = yieldPercent / HUNDRED;
    const afterTaxRate = ONE - DIVIDEND_TAX_RATE;
    const annualNetTarget = monthlyNetTarget * MONTHS_PER_YEAR;
    const reachable = monthlyNetTarget === ZERO || (annualYieldRate > ZERO && afterTaxRate > ZERO);
    const requiredInvestment = reachable && monthlyNetTarget > ZERO
      ? annualNetTarget / (annualYieldRate * afterTaxRate)
      : ZERO;
    const requiredGrossAnnualDividend = afterTaxRate > ZERO
      ? annualNetTarget / afterTaxRate
      : ZERO;
    const estimatedWithholdingTax = Math.max(ZERO, requiredGrossAnnualDividend - annualNetTarget);

    return {
      reachable,
      monthlyNetTarget,
      yieldPercent,
      annualYieldRate,
      dividendTaxRate: DIVIDEND_TAX_RATE,
      afterTaxRate,
      annualNetTarget,
      requiredInvestment,
      requiredCapital: requiredInvestment,
      requiredGrossAnnualDividend,
      grossAnnualDividend: requiredGrossAnnualDividend,
      estimatedWithholdingTax,
      withholdingTax: estimatedWithholdingTax,
      netDailyTarget: annualNetTarget / DAYS_PER_YEAR,
    };
  }

  global.MoneyCalcCalculators = global.MoneyCalcCalculators || {};
  global.MoneyCalcCalculators.dividend = Object.freeze({
    calculateDividend,
    calculateForward: calculateDividend,
    calculateRequiredInvestment,
    calculateReverse: calculateRequiredInvestment,
    calculateTarget: calculateRequiredInvestment,
  });

  if (!global.document) return;

  function initDividendCalculator() {
    const form = document.getElementById('dividend-form');
    if (!form) return;

    const MoneyCalc = global.MoneyCalc;
    const modeButtons = Array.from(form.querySelectorAll('[data-mode]'));
    const forwardFields = document.getElementById('forward-fields');
    const reverseFields = document.getElementById('reverse-fields');
    const investmentInput = document.getElementById('investment');
    const yieldInput = document.getElementById('annual-yield');
    const monthlyTargetInput = document.getElementById('monthly-net-target');
    const taxRateCopy = document.getElementById('dividend-tax-rate');
    const resultHeading = document.getElementById('dividend-result-heading');
    const resultValue = document.getElementById('dividend-result-value');
    const resultSummary = document.getElementById('dividend-result-summary');
    const resultDetails = document.getElementById('dividend-result-details');
    const resultNote = document.getElementById('dividend-result-note');
    const copyButton = document.getElementById('copy-dividend-link');
    const state = { mode: 'forward' };
    let latestShareUrl = global.location.href;

    function rawValue(input) {
      return input ? String(input.value).replace(/,/g, '') : '';
    }

    function renderDetailRows(rows) {
      resultDetails.replaceChildren();
      rows.forEach((item) => {
        const row = document.createElement('div');
        const label = document.createElement('dt');
        const value = document.createElement('dd');
        row.className = 'result-row';
        label.textContent = item.label;
        value.textContent = item.value;
        row.append(label, value);
        resultDetails.appendChild(row);
      });
    }

    function setResultNote(message, isError) {
      resultNote.textContent = message;
      resultNote.classList.toggle('error', Boolean(isError));
    }

    function applyModePresentation() {
      modeButtons.forEach((button) => {
        button.setAttribute('aria-pressed', button.dataset.mode === state.mode ? 'true' : 'false');
      });
      MoneyCalc.setHidden(forwardFields, state.mode !== 'forward');
      MoneyCalc.setHidden(reverseFields, state.mode !== 'reverse');
    }

    function renderForwardResult() {
      const result = calculateDividend({
        investment: rawValue(investmentInput),
        annualYieldPercent: rawValue(yieldInput),
      });

      resultHeading.textContent = '연 세후 배당금';
      resultValue.textContent = MoneyCalc.formatWon(result.netAnnualDividend);
      resultSummary.textContent = `월 평균 ${MoneyCalc.formatWon(result.netMonthlyDividend)} · 일 평균 ${MoneyCalc.formatWon(result.netDailyDividend)}`;
      renderDetailRows([
        { label: '투자금', value: MoneyCalc.formatWon(result.investment) },
        { label: '연 세전 배당금', value: MoneyCalc.formatWon(result.grossAnnualDividend) },
        { label: '예상 원천징수', value: MoneyCalc.formatWon(result.withholdingTax) },
        { label: '월 세후 배당금', value: MoneyCalc.formatWon(result.netMonthlyDividend) },
        { label: '일 세후 배당금', value: MoneyCalc.formatWon(result.netDailyDividend) },
      ]);
      setResultNote('연간 예상 배당을 월·일로 단순 환산한 값이며 실제 지급 횟수와 시점은 종목마다 다릅니다.', false);
    }

    function renderReverseResult() {
      const result = calculateRequiredInvestment({
        monthlyNetTarget: rawValue(monthlyTargetInput),
        annualYieldPercent: rawValue(yieldInput),
      });

      resultHeading.textContent = '목표 월배당에 필요한 투자금';
      if (!result.reachable) {
        resultValue.textContent = '계산 불가';
        resultSummary.textContent = '목표 금액이 있다면 배당수익률을 0보다 크게 입력해 주세요.';
        renderDetailRows([
          { label: '목표 월 세후 배당', value: MoneyCalc.formatWon(result.monthlyNetTarget) },
          { label: '입력한 연 배당수익률', value: MoneyCalc.formatPercent(result.yieldPercent, MATH.RATE_DISPLAY_DIGITS) },
        ]);
        setResultNote('배당수익률이 0%이면 양수인 월 세후 배당 목표를 역산할 수 없습니다.', true);
        return;
      }

      resultValue.textContent = MoneyCalc.formatWon(result.requiredInvestment);
      resultSummary.textContent = `세후 월 ${MoneyCalc.formatWon(result.monthlyNetTarget)}를 목표로 한 간이 역산값입니다.`;
      renderDetailRows([
        { label: '목표 월 세후 배당', value: MoneyCalc.formatWon(result.monthlyNetTarget) },
        { label: '목표 연 세후 배당', value: MoneyCalc.formatWon(result.annualNetTarget) },
        { label: '필요 연 세전 배당', value: MoneyCalc.formatWon(result.requiredGrossAnnualDividend) },
        { label: '예상 원천징수', value: MoneyCalc.formatWon(result.estimatedWithholdingTax) },
      ]);
      setResultNote('주가와 배당금 변동, 배당 지급 주기, 거래 비용은 필요 투자금 역산에 포함하지 않았습니다.', false);
    }

    function serializeState() {
      const params = MoneyCalc.formToParams(form);
      params.set('mode', state.mode);
      return params;
    }

    function calculateAndRender() {
      if (state.mode === 'reverse') renderReverseResult();
      else renderForwardResult();
      latestShareUrl = MoneyCalc.setQuery(serializeState());
    }

    function restoreFromQuery() {
      const params = MoneyCalc.queryParams();
      if (![...params.keys()].length) return false;
      if (['forward', 'reverse'].includes(params.get('mode'))) state.mode = params.get('mode');
      MoneyCalc.restoreForm(form, params);
      return true;
    }

    restoreFromQuery();
    MoneyCalc.setupNumericInputs(form);
    applyModePresentation();
    taxRateCopy.textContent = MoneyCalc.formatPercent(
      DIVIDEND_TAX_RATE * HUNDRED,
      MATH.RATE_DISPLAY_DIGITS
    );

    modeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        state.mode = button.dataset.mode;
        applyModePresentation();
        calculateAndRender();
      });
    });
    form.addEventListener('input', calculateAndRender);
    form.addEventListener('change', calculateAndRender);
    MoneyCalc.bindCopyLink(copyButton, () => latestShareUrl);
    calculateAndRender();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDividendCalculator);
  } else {
    initDividendCalculator();
  }
})(window);
