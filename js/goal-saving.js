(function (global) {
  'use strict';

  const C = global.CALC_CONSTANTS_2026;
  const U = global.MoneyCalc;
  if (!C || !U) return;

  const GOAL = C.GOAL_SAVING;
  const MATH = C.MATH;
  const ZERO = MATH.ZERO;
  const ONE = MATH.ONE;

  function nonNegative(value) {
    return Math.max(ZERO, U.parseNumber(value));
  }

  function monthlyRate(annualRatePercent) {
    return nonNegative(annualRatePercent) / MATH.HUNDRED / MATH.MONTHS_PER_YEAR;
  }

  function normalizeMonths(value) {
    const months = Math.floor(nonNegative(value));
    return U.clamp(months, GOAL.MIN_MONTHS, GOAL.MAX_MONTHS);
  }

  function futureValueOfMonthlySaving(monthlySavingValue, annualRatePercent, monthsValue) {
    const payment = nonNegative(monthlySavingValue);
    const months = normalizeMonths(monthsValue);
    const rate = monthlyRate(annualRatePercent);
    if (payment === ZERO) return ZERO;
    if (rate === ZERO) return payment * months;
    const factor = Math.pow(ONE + rate, months);
    const result = payment * (factor - ONE) / rate;
    return Number.isFinite(result) ? result : Number.MAX_VALUE;
  }

  function requiredMonthlySaving(targetAmountValue, annualRatePercent, monthsValue) {
    const targetAmount = nonNegative(targetAmountValue);
    const months = normalizeMonths(monthsValue);
    const rate = monthlyRate(annualRatePercent);
    if (targetAmount === ZERO) return ZERO;
    if (rate === ZERO) return targetAmount / months;
    const factor = Math.pow(ONE + rate, months);
    const denominator = factor - ONE;
    if (!Number.isFinite(denominator)) return ZERO;
    return denominator > ZERO ? targetAmount * rate / denominator : ZERO;
  }

  function calculateMonthsToGoal(targetAmountValue, monthlySavingValue, annualRatePercent) {
    const targetAmount = nonNegative(targetAmountValue);
    const payment = nonNegative(monthlySavingValue);
    const rate = monthlyRate(annualRatePercent);
    if (targetAmount === ZERO) return { months: ZERO, reachable: true, reason: 'already-reached' };
    if (payment === ZERO) return { months: GOAL.MAX_MONTHS, reachable: false, reason: 'no-saving' };

    let rawMonths;
    if (rate === ZERO) {
      rawMonths = Math.ceil(targetAmount / payment);
    } else {
      const ratio = ONE + targetAmount * rate / payment;
      rawMonths = Math.ceil(Math.log(ratio) / Math.log(ONE + rate));
    }

    if (!Number.isFinite(rawMonths) || rawMonths > GOAL.MAX_MONTHS) {
      return { months: GOAL.MAX_MONTHS, reachable: false, reason: 'over-limit' };
    }
    return {
      months: Math.max(GOAL.MIN_MONTHS, rawMonths),
      reachable: true,
      reason: '',
    };
  }

  function presentValueForInflation(futureAmountValue, inflationRatePercent, monthsValue) {
    const futureAmount = nonNegative(futureAmountValue);
    const inflationRate = nonNegative(inflationRatePercent) / MATH.HUNDRED;
    const months = Math.max(ZERO, Math.floor(nonNegative(monthsValue)));
    if (futureAmount === ZERO || inflationRate === ZERO || months === ZERO) return futureAmount;
    const factor = Math.pow(ONE + inflationRate, months / MATH.MONTHS_PER_YEAR);
    const result = futureAmount / factor;
    return Number.isFinite(result) ? result : ZERO;
  }

  function calculateGoalSaving(input) {
    const source = input || {};
    const mode = source.mode === 'monthly' ? 'monthly' : 'target';
    const targetAmount = nonNegative(source.targetAmount);
    const annualRate = nonNegative(source.annualRate);
    const inflationEnabled = source.inflationEnabled === true || source.inflationEnabled === '1';
    const inflationRate = nonNegative(source.inflationRate);
    const requestedMonths = source.months != null
      ? nonNegative(source.months)
      : nonNegative(source.durationYears != null ? source.durationYears : source.years) * MATH.MONTHS_PER_YEAR;

    if (mode === 'target') {
      const durationIsValid = requestedMonths >= GOAL.MIN_MONTHS;
      const months = durationIsValid ? normalizeMonths(requestedMonths) : ZERO;
      const monthlySaving = durationIsValid
        ? requiredMonthlySaving(targetAmount, annualRate, months)
        : ZERO;
      const totalContribution = monthlySaving * months;
      return {
        mode,
        targetAmount,
        annualRate,
        months,
        reachable: durationIsValid,
        reason: durationIsValid ? '' : 'invalid-duration',
        monthlySaving,
        finalBalance: durationIsValid ? targetAmount : ZERO,
        totalContribution,
        interestEarned: durationIsValid ? Math.max(ZERO, targetAmount - totalContribution) : ZERO,
        inflationEnabled,
        inflationRate,
        presentValue: inflationEnabled && durationIsValid
          ? presentValueForInflation(targetAmount, inflationRate, months)
          : null,
      };
    }

    const monthlySaving = nonNegative(source.monthlySaving);
    const reach = calculateMonthsToGoal(targetAmount, monthlySaving, annualRate);
    const finalBalance = reach.reachable && reach.months > ZERO
      ? futureValueOfMonthlySaving(monthlySaving, annualRate, reach.months)
      : ZERO;
    const totalContribution = reach.reachable && reach.months > ZERO ? monthlySaving * reach.months : ZERO;
    return {
      mode,
      targetAmount,
      annualRate,
      months: reach.months,
      reachable: reach.reachable,
      reason: reach.reason,
      monthlySaving,
      finalBalance,
      totalContribution,
      interestEarned: Math.max(ZERO, finalBalance - totalContribution),
      inflationEnabled,
      inflationRate,
      presentValue: inflationEnabled && reach.reachable
        ? presentValueForInflation(targetAmount, inflationRate, reach.months)
        : null,
    };
  }

  global.MoneyCalcCalculators = global.MoneyCalcCalculators || {};
  global.MoneyCalcCalculators.goalSaving = Object.freeze({
    monthlyRate,
    futureValueOfMonthlySaving,
    requiredMonthlySaving,
    calculateMonthsToGoal,
    presentValueForInflation,
    calculate: calculateGoalSaving,
  });

  if (typeof document === 'undefined') return;

  function init() {
    const form = document.getElementById('goal-saving-form');
    if (!form) return;

    const params = U.queryParams();
    const modeButtons = Array.from(form.querySelectorAll('[data-mode]'));
    const targetModeField = document.getElementById('target-mode-field');
    const monthlyModeField = document.getElementById('monthly-mode-field');
    const inflationRateField = document.getElementById('inflation-rate-field');
    const inflationToggle = form.elements.inflationEnabled;
    const startDateInput = form.elements.startDate;
    let mode = params.get('mode') === 'monthly' ? 'monthly' : 'target';
    let latestUrl = global.location.href;

    U.restoreForm(form, params);
    if (!startDateInput.value) startDateInput.value = U.todayIso();
    form.elements.durationYears.max = String(GOAL.MAX_MONTHS / MATH.MONTHS_PER_YEAR);

    function readInput() {
      return {
        mode,
        targetAmount: U.parseNumber(form.elements.targetAmount.value),
        durationYears: U.parseNumber(form.elements.durationYears.value),
        monthlySaving: U.parseNumber(form.elements.monthlySaving.value),
        annualRate: U.parseNumber(form.elements.annualRate.value),
        inflationEnabled: inflationToggle.checked,
        inflationRate: U.parseNumber(form.elements.inflationRate.value),
      };
    }

    function updatePresentation() {
      modeButtons.forEach((button) => {
        button.setAttribute('aria-pressed', button.dataset.mode === mode ? 'true' : 'false');
      });
      U.setHidden(targetModeField, mode !== 'target');
      U.setHidden(monthlyModeField, mode !== 'monthly');
      U.setHidden(inflationRateField, !inflationToggle.checked);
    }

    function periodText(months) {
      const years = Math.floor(months / MATH.MONTHS_PER_YEAR);
      const remainder = months % MATH.MONTHS_PER_YEAR;
      if (years > ZERO && remainder > ZERO) return `${years}년 ${remainder}개월`;
      if (years > ZERO) return `${years}년`;
      return `${remainder}개월`;
    }

    function targetDateText(months) {
      if (!startDateInput.value || months <= ZERO) return '-';
      const start = new Date(`${startDateInput.value}T00:00:00`);
      if (Number.isNaN(start.getTime())) return '-';
      return U.addMonths(start, months).toLocaleDateString('ko-KR');
    }

    function setResultRows(rows) {
      const list = document.getElementById('goal-result-details');
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
      const result = calculateGoalSaving(readInput());
      const label = document.getElementById('goal-result-label');
      const value = document.getElementById('goal-result-value');
      const summary = document.getElementById('goal-result-summary');
      const status = document.getElementById('goal-result-status');
      const rows = [];

      if (result.mode === 'target') {
        label.textContent = '목표 달성에 필요한 월 저축액';
        value.textContent = result.reachable ? U.formatWon(result.monthlySaving) : '기간 입력 필요';
        summary.textContent = result.reachable
          ? `${periodText(result.months)} 동안 매월 말 같은 금액을 저축하는 경우입니다.`
          : '저축 기간을 0보다 크게 입력해 주세요.';
        rows.push(
          ['목표 금액', U.formatWon(result.targetAmount)],
          ['저축 기간', periodText(result.months)],
          ['총 납입 원금', U.formatWon(result.totalContribution)],
          ['예상 이자 기여분', U.formatWon(result.interestEarned)]
        );
      } else if (!result.reachable) {
        label.textContent = '예상 목표 도달시점';
        value.textContent = `${periodText(GOAL.MAX_MONTHS)} 초과`;
        summary.textContent = result.reason === 'no-saving'
          ? '월 저축액을 0보다 크게 입력해 주세요.'
          : '현재 조건으로는 계산기의 최대 기간 안에 목표에 도달하기 어렵습니다.';
        rows.push(
          ['목표 금액', U.formatWon(result.targetAmount)],
          ['월 저축액', U.formatWon(result.monthlySaving)]
        );
      } else {
        label.textContent = '예상 목표 도달시점';
        value.textContent = periodText(result.months);
        summary.textContent = `${targetDateText(result.months)} 무렵 목표를 넘을 것으로 예상됩니다.`;
        rows.push(
          ['예상 도달일', targetDateText(result.months)],
          ['도달 시 예상 잔액', U.formatWon(result.finalBalance)],
          ['총 납입 원금', U.formatWon(result.totalContribution)],
          ['예상 이자 기여분', U.formatWon(result.interestEarned)]
        );
      }

      if (result.inflationEnabled && result.presentValue != null) {
        rows.push(['미래 목표액의 현재가치', U.formatWon(result.presentValue)]);
      }
      setResultRows(rows);
      status.textContent = result.inflationEnabled
        ? `물가상승률 연 ${U.formatNumber(result.inflationRate, MATH.RATE_DISPLAY_DIGITS)}%를 현재가치 표시에만 반영했습니다.`
        : '금리는 월복리, 납입은 매월 말에 이뤄지는 것으로 가정합니다.';
      return result;
    }

    function syncQuery() {
      const next = U.formToParams(form);
      next.set('mode', mode);
      latestUrl = U.setQuery(next);
      return latestUrl;
    }

    function recalculate() {
      updatePresentation();
      render();
      syncQuery();
    }

    modeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        mode = button.dataset.mode === 'monthly' ? 'monthly' : 'target';
        recalculate();
      });
    });
    form.addEventListener('input', recalculate);
    form.addEventListener('change', recalculate);

    U.setupNumericInputs(form);
    updatePresentation();
    render();
    syncQuery();
    U.bindCopyLink(document.getElementById('copy-goal-link'), () => latestUrl);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
