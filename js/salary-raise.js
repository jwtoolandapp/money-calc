(function (global) {
  'use strict';

  const C = global.CALC_CONSTANTS_2026;
  const U = global.MoneyCalc;
  if (!C || !U) return;

  const MATH = C.MATH;
  const ZERO = MATH.ZERO;
  const HUNDRED = MATH.HUNDRED;

  function nonNegative(value) {
    return Math.max(ZERO, U.parseNumber(value));
  }

  function calculateSalaryRaise(input) {
    const source = input || {};
    const mode = source.mode === 'target' ? 'target' : 'rate';
    const currentSalary = nonNegative(source.currentSalary);
    const inflationEnabled = source.inflationEnabled === true || source.inflationEnabled === '1';
    const inflationRate = nonNegative(source.inflationRate);

    let raiseRate;
    let newSalary;

    if (mode === 'target') {
      const targetSalary = nonNegative(source.targetSalary);
      newSalary = targetSalary;
      raiseRate = currentSalary > ZERO ? (targetSalary / currentSalary - 1) * HUNDRED : ZERO;
    } else {
      raiseRate = nonNegative(source.raiseRate);
      newSalary = currentSalary * (1 + raiseRate / HUNDRED);
    }

    const raiseAmount = newSalary - currentSalary;
    const currentMonthly = currentSalary / MATH.MONTHS_PER_YEAR;
    const newMonthly = newSalary / MATH.MONTHS_PER_YEAR;
    const monthlyRaiseAmount = newMonthly - currentMonthly;

    // 실질 인상률 = (1+명목 인상률)÷(1+물가상승률) − 1. 물가가 오른 만큼 명목 인상률의 실제 구매력을 낮춰본다.
    const realRaiseRate = inflationEnabled
      ? ((1 + raiseRate / HUNDRED) / (1 + inflationRate / HUNDRED) - 1) * HUNDRED
      : null;

    return {
      mode,
      currentSalary,
      newSalary,
      raiseAmount,
      raiseRate,
      currentMonthly,
      newMonthly,
      monthlyRaiseAmount,
      inflationEnabled,
      inflationRate,
      realRaiseRate,
    };
  }

  global.MoneyCalcCalculators = global.MoneyCalcCalculators || {};
  global.MoneyCalcCalculators.salaryRaise = Object.freeze({
    calculate: calculateSalaryRaise,
  });

  if (typeof document === 'undefined') return;

  function initSalaryRaisePage() {
    const form = document.getElementById('salary-raise-form');
    if (!form) return;

    const modeButtons = Array.from(form.querySelectorAll('[data-mode]'));
    const rateModeField = document.getElementById('rate-mode-field');
    const targetModeField = document.getElementById('target-mode-field');
    const inflationRateField = document.getElementById('inflation-rate-field');
    const inflationToggle = form.elements.inflationEnabled;
    let mode = 'rate';

    function readInput() {
      return {
        mode,
        currentSalary: U.parseNumber(form.elements.currentSalary.value),
        raiseRate: U.parseNumber(form.elements.raiseRate.value),
        targetSalary: U.parseNumber(form.elements.targetSalary.value),
        inflationEnabled: inflationToggle.checked,
        inflationRate: U.parseNumber(form.elements.inflationRate.value),
      };
    }

    function updatePresentation() {
      modeButtons.forEach((button) => {
        button.setAttribute('aria-pressed', button.dataset.mode === mode ? 'true' : 'false');
      });
      U.setHidden(rateModeField, mode !== 'rate');
      U.setHidden(targetModeField, mode !== 'target');
      U.setHidden(inflationRateField, !inflationToggle.checked);
    }

    function setResultRows(rows) {
      const list = document.getElementById('raise-result-details');
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
      const result = calculateSalaryRaise(readInput());
      const label = document.getElementById('raise-result-label');
      const value = document.getElementById('raise-result-value');
      const summary = document.getElementById('raise-result-summary');
      const status = document.getElementById('raise-result-status');

      if (result.mode === 'rate') {
        label.textContent = '인상 후 예상 연봉';
        value.textContent = U.formatWon(Math.round(result.newSalary));
        summary.textContent = `현재 연봉보다 ${U.formatWon(Math.round(result.raiseAmount))} 오른 금액입니다.`;
      } else {
        label.textContent = '목표 달성에 필요한 인상률';
        value.textContent = `${U.formatNumber(result.raiseRate, MATH.RATE_DISPLAY_DIGITS)}%`;
        summary.textContent = result.currentSalary > ZERO
          ? `현재 연봉에서 ${U.formatWon(Math.round(result.raiseAmount))} 오르면 목표 연봉에 도달합니다.`
          : '현재 연봉을 입력해 주세요.';
      }

      setResultRows([
        ['현재 연봉', U.formatWon(Math.round(result.currentSalary))],
        ['인상 후 연봉', U.formatWon(Math.round(result.newSalary))],
        ['인상액(연)', U.formatWon(Math.round(result.raiseAmount))],
        ['인상률', `${U.formatNumber(result.raiseRate, MATH.RATE_DISPLAY_DIGITS)}%`],
        ['월급 환산(현재 → 인상 후)', `${U.formatWon(Math.round(result.currentMonthly))} → ${U.formatWon(Math.round(result.newMonthly))}`],
        ['월 환산 인상액', U.formatWon(Math.round(result.monthlyRaiseAmount))],
      ]);

      if (result.inflationEnabled && result.realRaiseRate != null) {
        status.hidden = false;
        status.textContent = `물가상승률 연 ${U.formatNumber(result.inflationRate, MATH.RATE_DISPLAY_DIGITS)}%를 반영한 실질 인상률은 약 ${U.formatNumber(result.realRaiseRate, MATH.RATE_DISPLAY_DIGITS)}%입니다.`;
        status.classList.toggle('error', result.realRaiseRate < ZERO);
      } else {
        status.hidden = true;
      }

      return result;
    }

    function syncQuery() {
      const params = U.formToParams(form);
      params.set('mode', mode);
      U.setQuery(params);
    }

    function recalculate() {
      updatePresentation();
      render();
      syncQuery();
    }

    modeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        mode = button.dataset.mode === 'target' ? 'target' : 'rate';
        recalculate();
      });
    });

    U.setupNumericInputs(form);
    U.restoreForm(form);
    const params = U.queryParams();
    if (params.get('mode') === 'target') mode = 'target';

    form.addEventListener('input', recalculate);
    form.addEventListener('change', recalculate);
    U.bindCopyLink(document.getElementById('copy-raise-link'), () => global.location.href);
    updatePresentation();
    render();
    syncQuery();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSalaryRaisePage);
  else initSalaryRaisePage();
})(window);
