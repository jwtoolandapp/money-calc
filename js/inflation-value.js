(function (global) {
  'use strict';

  const C = global.CALC_CONSTANTS_2026;
  const U = global.MoneyCalc;
  if (!C || !U) return;

  const MATH = C.MATH;
  const ZERO = MATH.ZERO;
  const ONE = MATH.ONE;
  const HUNDRED = MATH.HUNDRED;

  function nonNegative(value) {
    return Math.max(ZERO, U.parseNumber(value));
  }

  function growthFactor(years, inflationRatePercent) {
    const rate = nonNegative(inflationRatePercent) / HUNDRED;
    const safeYears = Math.max(ZERO, nonNegative(years));
    return Math.pow(ONE + rate, safeYears);
  }

  function calculateInflationValue(input) {
    const source = input || {};
    const mode = source.mode === 'future' ? 'future' : 'past';
    const years = Math.max(ZERO, nonNegative(source.years));
    const inflationRate = nonNegative(source.inflationRate);
    const factor = growthFactor(years, inflationRate);

    if (mode === 'future') {
      const todayAmount = nonNegative(source.todayAmount);
      const futureRealValue = factor > ZERO ? todayAmount / factor : ZERO;
      const futureNominalNeeded = todayAmount * factor;
      const purchasingPowerLossPercent = factor > ZERO ? (ONE - ONE / factor) * HUNDRED : ZERO;
      return {
        mode,
        years,
        inflationRate,
        factor,
        todayAmount,
        futureRealValue,
        futureNominalNeeded,
        purchasingPowerLossPercent,
      };
    }

    const pastAmount = nonNegative(source.pastAmount);
    const todayEquivalent = pastAmount * factor;
    return {
      mode,
      years,
      inflationRate,
      factor,
      pastAmount,
      todayEquivalent,
    };
  }

  global.MoneyCalcCalculators = global.MoneyCalcCalculators || {};
  global.MoneyCalcCalculators.inflationValue = Object.freeze({
    growthFactor,
    calculate: calculateInflationValue,
  });

  if (typeof document === 'undefined') return;

  function initInflationValuePage() {
    const form = document.getElementById('inflation-value-form');
    if (!form) return;

    const modeButtons = Array.from(form.querySelectorAll('[data-mode]'));
    const pastModeField = document.getElementById('past-mode-field');
    const futureModeField = document.getElementById('future-mode-field');
    let mode = 'past';

    function readInput() {
      return {
        mode,
        pastAmount: U.parseNumber(form.elements.pastAmount.value),
        todayAmount: U.parseNumber(form.elements.todayAmount.value),
        years: U.parseNumber(form.elements.years.value),
        inflationRate: U.parseNumber(form.elements.inflationRate.value),
      };
    }

    function updatePresentation() {
      modeButtons.forEach((button) => {
        button.setAttribute('aria-pressed', button.dataset.mode === mode ? 'true' : 'false');
      });
      U.setHidden(pastModeField, mode !== 'past');
      U.setHidden(futureModeField, mode !== 'future');
    }

    function setResultRows(rows) {
      const list = document.getElementById('inflation-result-details');
      const fragment = document.createDocumentFragment();
      rows.forEach(([label, value]) => {
        const row = document.createElement('div');
        const term = document.createElement('dt');
        const description = document.createElement('dd');
        row.className = 'result-row';
        term.textContent = label;
        description.textContent = value;
        row.append(term, description);
        fragment.appendChild(row);
      });
      list.replaceChildren(fragment);
    }

    function render() {
      const result = calculateInflationValue(readInput());
      const label = document.getElementById('inflation-result-label');
      const value = document.getElementById('inflation-result-value');
      const summary = document.getElementById('inflation-result-summary');

      if (result.mode === 'past') {
        label.textContent = '오늘 기준 환산 금액';
        value.textContent = U.formatWon(Math.round(result.todayEquivalent));
        summary.textContent = `${U.formatNumber(result.years, 0)}년 전 ${U.formatWon(Math.round(result.pastAmount))}은 연 ${U.formatNumber(result.inflationRate, MATH.RATE_DISPLAY_DIGITS)}% 물가상승률 가정 시 오늘 ${U.formatWon(Math.round(result.todayEquivalent))}과 같은 가치입니다.`;
        setResultRows([
          ['기준 금액(과거)', U.formatWon(Math.round(result.pastAmount))],
          ['경과 기간', `${U.formatNumber(result.years, 0)}년`],
          ['가정 연 물가상승률', `${U.formatNumber(result.inflationRate, MATH.RATE_DISPLAY_DIGITS)}%`],
          ['누적 물가 배율', `${U.formatNumber(result.factor, 2)}배`],
          ['오늘 기준 환산 금액', U.formatWon(Math.round(result.todayEquivalent))],
        ]);
      } else {
        label.textContent = '미래 시점 실질가치(오늘 구매력 기준)';
        value.textContent = U.formatWon(Math.round(result.futureRealValue));
        summary.textContent = `오늘 ${U.formatWon(Math.round(result.todayAmount))}은 ${U.formatNumber(result.years, 0)}년 후 구매력 기준으로 오늘의 ${U.formatWon(Math.round(result.futureRealValue))}과 같아집니다.`;
        setResultRows([
          ['기준 금액(오늘)', U.formatWon(Math.round(result.todayAmount))],
          ['경과 기간', `${U.formatNumber(result.years, 0)}년`],
          ['가정 연 물가상승률', `${U.formatNumber(result.inflationRate, MATH.RATE_DISPLAY_DIGITS)}%`],
          ['미래 시점 실질가치', U.formatWon(Math.round(result.futureRealValue))],
          ['구매력 감소율', `${U.formatNumber(result.purchasingPowerLossPercent, MATH.RATE_DISPLAY_DIGITS)}%`],
          ['같은 구매력 유지에 필요한 미래 금액', U.formatWon(Math.round(result.futureNominalNeeded))],
        ]);
      }

      return result;
    }

    function recalculate() {
      updatePresentation();
      render();
      // mode 는 폼 필드가 아니라 버튼 상태라 formToParams 에 안 잡힌다. 읽기 쪽은
      // 예전부터 params.get("mode") 를 보고 있었지만 쓰기에서 빠져 있어서, 공유한 링크가
      // 언제나 과거 모드로 열렸다.
      const params = U.formToParams(form);
      params.set("mode", mode);
      U.setQuery(params);
    }

    modeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        mode = button.dataset.mode === 'future' ? 'future' : 'past';
        recalculate();
      });
    });

    U.setupNumericInputs(form);
    U.restoreForm(form);
    const params = U.queryParams();
    if (params.get('mode') === 'future') mode = 'future';

    form.addEventListener('input', recalculate);
    form.addEventListener('change', recalculate);
    U.bindCopyLink(document.getElementById('copy-inflation-link'), () => global.location.href);
    updatePresentation();
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initInflationValuePage);
  else initInflationValuePage();
})(window);
