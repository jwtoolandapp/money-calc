(function (global) {
  'use strict';

  const CONSTANTS = global.CALC_CONSTANTS_2026;
  const DSR = CONSTANTS.DSR;
  const MATH = CONSTANTS.MATH;
  const ZERO = MATH.ZERO;
  const ONE = MATH.ONE;

  function nonNegative(value) {
    const normalized = typeof value === 'string' ? value.replace(/,/g, '') : value;
    const number = Number(normalized);
    return Number.isFinite(number) ? Math.max(ZERO, number) : ZERO;
  }

  function asBoolean(value) {
    return value === true || value === '1' || value === 'true' || value === 'yes';
  }

  function normalizeTermYears(value) {
    return Math.min(DSR.MAX_TERM_YEARS, Math.max(ONE, Math.floor(nonNegative(value))));
  }

  function annualRateToMonthly(annualRatePercent) {
    return nonNegative(annualRatePercent) / MATH.HUNDRED / MATH.MONTHS_PER_YEAR;
  }

  function calculateMonthlyAnnuity(principalValue, annualRatePercentValue, termYearsValue) {
    const principal = nonNegative(principalValue);
    const termYears = normalizeTermYears(termYearsValue);
    const termMonths = termYears * MATH.MONTHS_PER_YEAR;
    const monthlyRate = annualRateToMonthly(annualRatePercentValue);
    if (principal === ZERO) return ZERO;
    if (monthlyRate === ZERO) return principal / termMonths;
    const factor = Math.pow(ONE + monthlyRate, termMonths);
    if (!Number.isFinite(factor)) return principal * monthlyRate;
    return principal * monthlyRate * factor / (factor - ONE);
  }

  function annualPaymentFromItem(item) {
    if (item && typeof item === 'object') return nonNegative(item.annualPayment);
    return nonNegative(item);
  }

  function calculateDsr(input) {
    const source = input || {};
    const annualIncome = nonNegative(source.annualIncome);
    const existingSource = Array.isArray(source.existingLoans)
      ? source.existingLoans
      : (Array.isArray(source.existingAnnualPayments) ? source.existingAnnualPayments : []);
    const existingAnnualPayment = existingSource
      .slice(ZERO, DSR.MAX_EXISTING_LOANS)
      .reduce((total, item) => total + annualPaymentFromItem(item), ZERO);
    const newPrincipal = nonNegative(source.newPrincipal);
    const newAnnualRate = nonNegative(source.newAnnualRate);
    const stressEnabled = asBoolean(source.stressEnabled);
    const stressRegion = source.stressRegion === 'metro' ? 'metro' : 'nonMetro';
    const stressAddition = stressEnabled
      ? (stressRegion === 'metro' ? DSR.STRESS_RATE_ADDITION.METRO : DSR.STRESS_RATE_ADDITION.NON_METRO)
      : ZERO;
    const effectiveAnnualRate = newAnnualRate + stressAddition;
    const newTermYears = normalizeTermYears(source.newTermYears);
    const newMonthlyPayment = calculateMonthlyAnnuity(newPrincipal, effectiveAnnualRate, newTermYears);
    const newAnnualPayment = newMonthlyPayment * MATH.MONTHS_PER_YEAR;
    const totalAnnualPayment = existingAnnualPayment + newAnnualPayment;
    const limitAnnualPayment = annualIncome * DSR.STANDARD_LIMIT_RATE;
    const rawRemainingCapacity = limitAnnualPayment - totalAnnualPayment;
    const dsrRate = annualIncome > ZERO ? totalAnnualPayment / annualIncome : ZERO;

    return {
      annualIncome,
      existingAnnualPayment,
      newPrincipal,
      newAnnualRate,
      stressEnabled,
      stressRegion,
      stressAddition,
      effectiveAnnualRate,
      newTermYears,
      newMonthlyPayment,
      newAnnualPayment,
      totalAnnualPayment,
      dsrRate,
      dsrPercent: dsrRate * MATH.HUNDRED,
      limitRate: DSR.STANDARD_LIMIT_RATE,
      limitPercent: DSR.STANDARD_LIMIT_RATE * MATH.HUNDRED,
      limitAnnualPayment,
      remainingAnnualCapacity: Math.max(ZERO, rawRemainingCapacity),
      excessAnnualPayment: Math.max(ZERO, -rawRemainingCapacity),
      hasIncome: annualIncome > ZERO,
      isWithinLimit: annualIncome > ZERO && totalAnnualPayment <= limitAnnualPayment,
    };
  }

  const calculators = global.MoneyCalcCalculators || {};
  calculators.dsr = Object.freeze({
    annualRateToMonthly,
    calculateMonthlyAnnuity,
    calculateDsr,
    calculate: calculateDsr,
  });
  global.MoneyCalcCalculators = calculators;

  if (typeof document === 'undefined') return;

  function initDsrPage() {
    const U = global.MoneyCalc;
    const form = document.getElementById('dsr-form');
    const rowsContainer = document.getElementById('existing-loan-rows');
    const addButton = document.getElementById('add-existing-loan');
    if (!U || !form || !rowsContainer || !addButton) return;

    let rowSequence = ZERO;
    let latestShareUrl = global.location.href;
    const stressRegionInput = document.getElementById('stress-region');
    const stressRegionButtons = Array.from(form.querySelectorAll('[data-stress-region]'));

    function syncStressRegionControls() {
      if (!stressRegionInput) return;
      stressRegionButtons.forEach((button) => {
        button.setAttribute('aria-pressed', button.dataset.stressRegion === stressRegionInput.value ? 'true' : 'false');
      });
    }

    function createExistingLoanRow(name, annualPayment) {
      rowSequence += ONE;
      const row = document.createElement('div');
      const nameId = `existing-loan-name-${rowSequence}`;
      const paymentId = `existing-annual-payment-${rowSequence}`;
      row.className = 'purchase-row';
      row.dataset.existingLoanRow = 'true';
      row.innerHTML = `
        <div class="field">
          <label for="${nameId}">대출 이름 <span data-row-number></span></label>
          <div class="input-wrap">
            <input id="${nameId}" name="existingLoanName" type="text" autocomplete="off" placeholder="예: 주택담보대출">
          </div>
        </div>
        <div class="field">
          <label for="${paymentId}">연 원리금</label>
          <div class="input-wrap">
            <input id="${paymentId}" name="existingAnnualPayment" type="text" inputmode="numeric" autocomplete="off" data-number data-decimals="0">
            <span class="unit">원</span>
          </div>
        </div>
        <button class="remove-row" type="button" data-remove-existing-loan>행 삭제</button>
      `;
      row.querySelector('[name="existingLoanName"]').value = name == null ? '' : String(name);
      row.querySelector('[name="existingAnnualPayment"]').value = annualPayment == null ? '' : String(annualPayment);
      rowsContainer.appendChild(row);
      U.setupNumericInputs(row);
      updateRowsUi();
      return row;
    }

    function rows() {
      return Array.from(rowsContainer.querySelectorAll('[data-existing-loan-row]'));
    }

    function updateRowsUi() {
      const currentRows = rows();
      currentRows.forEach((row, index) => {
        const rowNumber = row.querySelector('[data-row-number]');
        const removeButton = row.querySelector('[data-remove-existing-loan]');
        if (rowNumber) rowNumber.textContent = `${index + ONE}`;
        if (removeButton) removeButton.hidden = currentRows.length <= ONE;
      });
      addButton.disabled = currentRows.length >= DSR.MAX_EXISTING_LOANS;
      document.getElementById('existing-loan-count-hint').textContent =
        `현재 ${currentRows.length}개 · 최대 ${DSR.MAX_EXISTING_LOANS}개까지 입력할 수 있습니다.`;
    }

    function existingLoansInput() {
      return rows().map((row) => ({
        name: row.querySelector('[name="existingLoanName"]').value,
        annualPayment: U.parseNumber(row.querySelector('[name="existingAnnualPayment"]').value),
      }));
    }

    function readInput() {
      return {
        annualIncome: U.parseNumber(form.elements.annualIncome.value),
        existingLoans: existingLoansInput(),
        newPrincipal: U.parseNumber(form.elements.newPrincipal.value),
        newAnnualRate: U.parseNumber(form.elements.newAnnualRate.value),
        newTermYears: U.parseNumber(form.elements.newTermYears.value),
        stressEnabled: form.elements.stressEnabled.checked,
        stressRegion: form.elements.stressRegion ? form.elements.stressRegion.value : 'nonMetro',
      };
    }

    function render(result) {
      const resultValue = document.getElementById('dsr-result-value');
      const summary = document.getElementById('dsr-result-summary');
      const status = document.getElementById('dsr-status');
      resultValue.textContent = U.formatPercent(result.dsrPercent, MATH.RATE_DISPLAY_DIGITS);
      resultValue.classList.toggle('positive', result.hasIncome && result.isWithinLimit);
      resultValue.classList.toggle('negative', result.hasIncome && !result.isWithinLimit);

      if (!result.hasIncome) {
        summary.textContent = '연소득을 입력하면 DSR과 남은 상환 여력을 계산합니다.';
        status.textContent = '연소득이 0원이어서 DSR 비율은 0%로 표시했습니다.';
        status.classList.add('error');
      } else if (result.isWithinLimit && result.remainingAnnualCapacity === ZERO) {
        summary.textContent = `일반 ${U.formatPercent(result.limitPercent, MATH.RATE_DISPLAY_DIGITS)} 기준 한도와 같습니다.`;
        status.textContent = '새 대출 실행 전 금융사의 실제 DSR 산정 결과를 확인하세요.';
        status.classList.remove('error');
      } else if (result.isWithinLimit) {
        summary.textContent = `일반 ${U.formatPercent(result.limitPercent, MATH.RATE_DISPLAY_DIGITS)} 기준까지 연 ${U.formatWon(result.remainingAnnualCapacity)}의 상환 여력이 남습니다.`;
        status.textContent = '표시된 여력은 추가 대출 원금 한도가 아니라 연간 원리금 여력입니다.';
        status.classList.remove('error');
      } else {
        summary.textContent = `일반 ${U.formatPercent(result.limitPercent, MATH.RATE_DISPLAY_DIGITS)} 기준을 연 ${U.formatWon(result.excessAnnualPayment)}만큼 초과합니다.`;
        status.textContent = '실제 적용 한도와 예외 여부는 금융사 심사에서 확인하세요.';
        status.classList.add('error');
      }

      document.getElementById('existing-annual-payment-result').textContent = U.formatWon(result.existingAnnualPayment);
      document.getElementById('new-monthly-payment-result').textContent = U.formatWon(result.newMonthlyPayment);
      document.getElementById('new-annual-payment-result').textContent = U.formatWon(result.newAnnualPayment);
      document.getElementById('total-annual-payment-result').textContent = U.formatWon(result.totalAnnualPayment);
      document.getElementById('limit-annual-payment-result').textContent = U.formatWon(result.limitAnnualPayment);
      document.getElementById('remaining-capacity-result').textContent = U.formatWon(result.remainingAnnualCapacity);
      document.getElementById('effective-rate-result').textContent = U.formatPercent(result.effectiveAnnualRate, MATH.RATE_DISPLAY_DIGITS);
    }

    function syncQuery() {
      latestShareUrl = U.setQuery(U.formToParams(form));
      return latestShareUrl;
    }

    function recalculate() {
      render(calculateDsr(readInput()));
      syncQuery();
    }

    const params = U.queryParams();
    U.restoreForm(form, params);
    const restoredNames = params.getAll('existingLoanName');
    const restoredPayments = params.getAll('existingAnnualPayment');
    if (restoredNames.length || restoredPayments.length) {
      const rowCount = Math.min(DSR.MAX_EXISTING_LOANS, Math.max(ONE, restoredNames.length, restoredPayments.length));
      for (let index = ZERO; index < rowCount; index += ONE) {
        createExistingLoanRow(restoredNames[index] || '', restoredPayments[index] || '');
      }
    } else {
      createExistingLoanRow('기존 대출 1', '20000000');
    }
    U.setupNumericInputs(form);

    addButton.addEventListener('click', () => {
      if (rows().length >= DSR.MAX_EXISTING_LOANS) return;
      const row = createExistingLoanRow('', '');
      const input = row.querySelector('input');
      if (input) input.focus();
      recalculate();
    });

    rowsContainer.addEventListener('click', (event) => {
      const removeButton = event.target.closest('[data-remove-existing-loan]');
      if (!removeButton || rows().length <= ONE) return;
      removeButton.closest('[data-existing-loan-row]').remove();
      updateRowsUi();
      recalculate();
    });

    stressRegionButtons.forEach((button) => {
      button.addEventListener('click', () => {
        if (!stressRegionInput) return;
        stressRegionInput.value = button.dataset.stressRegion;
        syncStressRegionControls();
        recalculate();
      });
    });

    form.addEventListener('input', recalculate);
    form.addEventListener('change', recalculate);
    U.bindCopyLink(document.getElementById('copy-dsr-link'), () => latestShareUrl);
    syncStressRegionControls();
    recalculate();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initDsrPage);
  else initDsrPage();
})(window);
