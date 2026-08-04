(function (global) {
  'use strict';

  const CONSTANTS = global.CALC_CONSTANTS_2026;
  const LOAN = CONSTANTS.LOAN;
  const MATH = CONSTANTS.MATH;
  const ZERO = MATH.ZERO;
  const ONE = MATH.ONE;

  function toFiniteNonNegative(value) {
    const normalized = typeof value === 'string' ? value.replace(/,/g, '') : value;
    const number = Number(normalized);
    return Number.isFinite(number) ? Math.max(ZERO, number) : ZERO;
  }

  function normalizeTermMonths(value) {
    return Math.min(
      LOAN.MAX_TERM_MONTHS,
      Math.max(LOAN.MIN_TERM_MONTHS, Math.floor(toFiniteNonNegative(value))),
    );
  }

  function normalizeMethod(method) {
    const allowed = Object.values(LOAN.METHODS);
    return allowed.includes(method) ? method : LOAN.METHODS.ANNUITY;
  }

  function annualRateToMonthly(annualRate) {
    return toFiniteNonNegative(annualRate) / LOAN.RATE_DIVISOR / LOAN.MONTHS_PER_YEAR;
  }

  function calculateAnnuityPayment(principalValue, monthlyRateValue, monthsValue) {
    const principal = toFiniteNonNegative(principalValue);
    const monthlyRate = toFiniteNonNegative(monthlyRateValue);
    const months = normalizeTermMonths(monthsValue);

    if (principal === ZERO) return ZERO;
    if (monthlyRate === ZERO) return principal / months;

    const factor = Math.pow(ONE + monthlyRate, months);
    if (!Number.isFinite(factor)) return principal * monthlyRate;
    return principal * monthlyRate * factor / (factor - ONE);
  }

  function buildRepaymentSchedule(input) {
    const source = input || {};
    const principal = toFiniteNonNegative(source.principal);
    const annualRate = toFiniteNonNegative(source.annualRate);
    const termMonths = normalizeTermMonths(source.termMonths);
    const method = normalizeMethod(source.method);
    const requestedGrace = Math.floor(toFiniteNonNegative(source.graceMonths));
    const graceLimit = Math.max(ZERO, termMonths - ONE);
    const graceMonths = method === LOAN.METHODS.BULLET
      ? ZERO
      : Math.min(requestedGrace, graceLimit);
    const repaymentMonths = method === LOAN.METHODS.BULLET
      ? termMonths
      : Math.max(LOAN.MIN_TERM_MONTHS, termMonths - graceMonths);
    const monthlyRate = annualRateToMonthly(annualRate);
    const annuityPayment = calculateAnnuityPayment(principal, monthlyRate, repaymentMonths);
    const equalPrincipalPayment = principal / repaymentMonths;
    const rows = [];
    let balance = principal;

    for (let installment = ONE; installment <= termMonths; installment += ONE) {
      const isFinalInstallment = installment === termMonths;
      const isGraceInstallment = method !== LOAN.METHODS.BULLET && installment <= graceMonths;
      const interest = balance * monthlyRate;
      let principalPayment = ZERO;

      if (method === LOAN.METHODS.BULLET) {
        principalPayment = isFinalInstallment ? balance : ZERO;
      } else if (!isGraceInstallment && method === LOAN.METHODS.EQUAL_PRINCIPAL) {
        principalPayment = isFinalInstallment ? balance : Math.min(balance, equalPrincipalPayment);
      } else if (!isGraceInstallment && method === LOAN.METHODS.ANNUITY) {
        principalPayment = isFinalInstallment
          ? balance
          : Math.min(balance, Math.max(ZERO, annuityPayment - interest));
      }

      const payment = principalPayment + interest;
      balance = Math.max(ZERO, balance - principalPayment);
      rows.push({
        installment,
        isGrace: isGraceInstallment,
        isMaturity: method === LOAN.METHODS.BULLET && isFinalInstallment,
        payment,
        principal: principalPayment,
        interest,
        balance,
      });
    }

    const totals = rows.reduce((sum, row) => ({
      principal: sum.principal + row.principal,
      interest: sum.interest + row.interest,
      payment: sum.payment + row.payment,
    }), { principal: ZERO, interest: ZERO, payment: ZERO });

    const representativeRow = method === LOAN.METHODS.BULLET
      ? null
      : rows[graceMonths] || rows[ZERO];
    const monthlyPayment = method === LOAN.METHODS.BULLET
      ? principal * monthlyRate
      : representativeRow.payment;

    return {
      principal,
      annualRate,
      monthlyRate,
      termMonths,
      graceMonths,
      repaymentMonths,
      method,
      monthlyPayment,
      firstPayment: rows[ZERO].payment,
      lastPayment: rows[rows.length - ONE].payment,
      totalPrincipal: totals.principal,
      totalInterest: totals.interest,
      totalPayment: totals.payment,
      rows,
    };
  }

  function calculatePrepaymentFee(principalValue, feeRateValue, monthsUntilWaiverValue) {
    const principal = toFiniteNonNegative(principalValue);
    const feeRate = toFiniteNonNegative(feeRateValue) / LOAN.RATE_DIVISOR;
    const remainingFeeMonths = Math.min(
      toFiniteNonNegative(monthsUntilWaiverValue),
      LOAN.PREPAYMENT_FEE_TOTAL_MONTHS,
    );
    const remainingRatio = LOAN.PREPAYMENT_FEE_TOTAL_MONTHS > ZERO
      ? remainingFeeMonths / LOAN.PREPAYMENT_FEE_TOTAL_MONTHS
      : ZERO;
    return {
      fee: principal * feeRate * remainingRatio,
      remainingFeeMonths,
      remainingRatio,
    };
  }

  function calculateRefinance(input) {
    const source = input || {};
    const principal = toFiniteNonNegative(source.principal);
    const existing = buildRepaymentSchedule({
      principal,
      annualRate: source.existingAnnualRate,
      termMonths: source.existingRemainingMonths,
      graceMonths: ZERO,
      method: LOAN.REFINANCE_ASSUMED_METHOD,
    });
    const replacement = buildRepaymentSchedule({
      principal,
      annualRate: source.newAnnualRate,
      termMonths: source.newTermMonths,
      graceMonths: ZERO,
      method: LOAN.REFINANCE_ASSUMED_METHOD,
    });
    const feeResult = calculatePrepaymentFee(
      principal,
      source.prepaymentFeeRate,
      source.monthsUntilWaiver,
    );
    const setupCost = toFiniteNonNegative(source.setupCost);
    const switchingCost = feeResult.fee + setupCost;
    const newTotalCost = replacement.totalInterest + switchingCost;
    const savings = existing.totalInterest - newTotalCost;

    return {
      principal,
      existing,
      replacement,
      existingInterest: existing.totalInterest,
      newInterest: replacement.totalInterest,
      prepaymentFee: feeResult.fee,
      remainingFeeMonths: feeResult.remainingFeeMonths,
      feeRemainingRatio: feeResult.remainingRatio,
      setupCost,
      switchingCost,
      newTotalCost,
      savings,
      isSaving: savings >= ZERO,
    };
  }

  const calculators = global.MoneyCalcCalculators || {};
  calculators.loan = Object.freeze({
    annualRateToMonthly,
    calculateAnnuityPayment,
    buildRepaymentSchedule,
    calculateLoan: buildRepaymentSchedule,
    calculatePrepaymentFee,
    calculateRefinance,
  });
  global.MoneyCalcCalculators = calculators;

  if (typeof document === 'undefined') return;

  function initializeLoanPage() {
    const common = global.MoneyCalc;
    const repaymentForm = document.getElementById('repayment-form');
    const refinanceForm = document.getElementById('refinance-form');
    if (!common || !repaymentForm || !refinanceForm) return;

    const tabButtons = Array.from(document.querySelectorAll('[data-tab]'));
    const tabPanels = Array.from(document.querySelectorAll('[data-panel]'));
    const methodHint = document.getElementById('method-hint');
    const termInputs = [
      document.getElementById('term-months'),
      document.getElementById('ref-old-months'),
      document.getElementById('ref-new-months'),
    ];
    let activeTab = 'repayment';
    let latestShareUrl = global.location.href;

    function serializeState() {
      const params = new URLSearchParams();
      params.set('tab', activeTab);
      [repaymentForm, refinanceForm].forEach((form) => {
        common.formToParams(form).forEach((value, key) => params.append(key, value));
      });
      return params;
    }

    function updateShareUrl() {
      latestShareUrl = common.setQuery(serializeState());
    }

    function constrainTermInputs() {
      termInputs.forEach((input) => {
        input.max = String(LOAN.MAX_TERM_MONTHS);
        input.title = `최대 ${LOAN.MAX_TERM_MONTHS}개월까지 계산합니다.`;
        if (common.parseNumber(input.value) > LOAN.MAX_TERM_MONTHS) {
          input.value = common.formatNumber(LOAN.MAX_TERM_MONTHS, MATH.WON_ROUNDING_DIGITS);
        }
      });
    }

    function activateTab(tabName, shouldFocus) {
      activeTab = tabName === 'refinance' ? 'refinance' : 'repayment';
      tabButtons.forEach((button) => {
        const selected = button.dataset.tab === activeTab;
        button.setAttribute('aria-selected', selected ? 'true' : 'false');
        button.tabIndex = selected ? ZERO : -ONE;
        if (selected && shouldFocus) button.focus();
      });
      tabPanels.forEach((panel) => common.setHidden(panel, panel.dataset.panel !== activeTab));
    }

    function repaymentInput() {
      return {
        principal: common.parseNumber(document.getElementById('principal').value),
        annualRate: common.parseNumber(document.getElementById('annual-rate').value),
        termMonths: common.parseNumber(document.getElementById('term-months').value),
        graceMonths: common.parseNumber(document.getElementById('grace-months').value),
        method: document.getElementById('repayment-method').value,
      };
    }

    function refinanceInput() {
      return {
        principal: common.parseNumber(document.getElementById('ref-balance').value),
        existingAnnualRate: common.parseNumber(document.getElementById('ref-old-rate').value),
        existingRemainingMonths: common.parseNumber(document.getElementById('ref-old-months').value),
        prepaymentFeeRate: common.parseNumber(document.getElementById('ref-fee-rate').value),
        monthsUntilWaiver: common.parseNumber(document.getElementById('ref-waiver-months').value),
        newAnnualRate: common.parseNumber(document.getElementById('ref-new-rate').value),
        newTermMonths: common.parseNumber(document.getElementById('ref-new-months').value),
        setupCost: common.parseNumber(document.getElementById('ref-setup-cost').value),
      };
    }

    function scheduleRowKind(row) {
      if (row.isGrace) return '거치';
      if (row.isMaturity) return '만기';
      return '상환';
    }

    function renderSchedule(result) {
      const body = document.getElementById('schedule-body');
      const fragment = document.createDocumentFragment();
      result.rows.forEach((row) => {
        const tr = document.createElement('tr');
        [
          common.formatNumber(row.installment, MATH.WON_ROUNDING_DIGITS),
          scheduleRowKind(row),
          common.formatWon(row.payment),
          common.formatWon(row.principal),
          common.formatWon(row.interest),
          common.formatWon(row.balance),
        ].forEach((value) => {
          const td = document.createElement('td');
          td.textContent = value;
          tr.appendChild(td);
        });
        fragment.appendChild(tr);
      });
      body.replaceChildren(fragment);
      document.getElementById('schedule-count').textContent = common.formatNumber(
        result.rows.length,
        MATH.WON_ROUNDING_DIGITS,
      );
    }

    function renderRepayment() {
      const result = buildRepaymentSchedule(repaymentInput());
      const label = document.getElementById('repayment-result-label');
      const summary = document.getElementById('repayment-summary');

      if (result.method === LOAN.METHODS.EQUAL_PRINCIPAL) {
        label.textContent = result.graceMonths > ZERO ? '거치 후 첫 납입액' : '첫 달 납입액';
        summary.textContent = `원금을 ${result.repaymentMonths}회로 나누어 갚아, 납입액이 매달 줄어듭니다.`;
        methodHint.textContent = '원금균등은 같은 원금을 나누어 갚으므로 이자와 월 납입액이 점차 줄어듭니다.';
      } else if (result.method === LOAN.METHODS.BULLET) {
        label.textContent = '평소 월 이자';
        summary.textContent = `매달 이자만 내다가 ${result.termMonths}회차에 원금을 한 번에 갚습니다.`;
        methodHint.textContent = '만기일시는 거치기간 입력과 관계없이 만기 전까지 이자만 납부합니다.';
      } else {
        label.textContent = result.graceMonths > ZERO ? '거치 후 월 납입액' : '예상 월 납입액';
        summary.textContent = result.graceMonths > ZERO
          ? `${result.graceMonths}회 동안 이자만 낸 뒤 ${result.repaymentMonths}회 동안 같은 원리금을 납부합니다.`
          : `${result.termMonths}회 동안 매달 같은 원리금을 납부합니다.`;
        methodHint.textContent = '원리금균등은 거치 후 매달 같은 원리금을 납부합니다.';
      }

      document.getElementById('repayment-main-result').textContent = common.formatWon(result.monthlyPayment);
      document.getElementById('repayment-total-principal').textContent = common.formatWon(result.totalPrincipal);
      document.getElementById('repayment-total-interest').textContent = common.formatWon(result.totalInterest);
      document.getElementById('repayment-total-payment').textContent = common.formatWon(result.totalPayment);
      document.getElementById('repayment-first-payment').textContent = common.formatWon(result.firstPayment);
      document.getElementById('repayment-last-payment').textContent = common.formatWon(result.lastPayment);
      renderSchedule(result);
    }

    function renderRefinance() {
      const result = calculateRefinance(refinanceInput());
      const conclusion = document.getElementById('refinance-main-result');
      const outcome = result.isSaving ? '이득' : '손해';
      conclusion.textContent = `지금 갈아타면 ${common.formatWon(Math.abs(result.savings))} ${outcome}`;
      conclusion.classList.toggle('positive', result.isSaving);
      conclusion.classList.toggle('negative', !result.isSaving);
      document.getElementById('ref-old-interest').textContent = common.formatWon(result.existingInterest);
      document.getElementById('ref-new-interest').textContent = common.formatWon(result.newInterest);
      document.getElementById('ref-prepayment-fee').textContent = common.formatWon(result.prepaymentFee);
      document.getElementById('ref-setup-cost-result').textContent = common.formatWon(result.setupCost);
      document.getElementById('ref-new-total-cost').textContent = common.formatWon(result.newTotalCost);
      document.getElementById('ref-fee-note').textContent =
        `중도상환수수료는 면제까지 남은 ${common.formatNumber(result.remainingFeeMonths, MATH.WON_ROUNDING_DIGITS)}개월을 ` +
        `전체 부과기간 ${common.formatNumber(LOAN.PREPAYMENT_FEE_TOTAL_MONTHS, MATH.WON_ROUNDING_DIGITS)}개월로 나눈 비율을 적용했습니다.`;
    }

    function renderAllAndSyncUrl() {
      constrainTermInputs();
      renderRepayment();
      renderRefinance();
      updateShareUrl();
    }

    const initialParams = common.queryParams();
    common.restoreForm(repaymentForm, initialParams);
    common.restoreForm(refinanceForm, initialParams);
    activateTab(initialParams.get('tab'), false);
    common.setupNumericInputs(document);

    [repaymentForm, refinanceForm].forEach((form) => {
      form.addEventListener('submit', (event) => event.preventDefault());
      form.addEventListener('input', renderAllAndSyncUrl);
      form.addEventListener('change', renderAllAndSyncUrl);
    });

    tabButtons.forEach((button, index) => {
      button.addEventListener('click', () => {
        activateTab(button.dataset.tab, false);
        updateShareUrl();
      });
      button.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        let targetIndex = index;
        if (event.key === 'ArrowLeft') targetIndex = (index - ONE + tabButtons.length) % tabButtons.length;
        if (event.key === 'ArrowRight') targetIndex = (index + ONE) % tabButtons.length;
        if (event.key === 'Home') targetIndex = ZERO;
        if (event.key === 'End') targetIndex = tabButtons.length - ONE;
        activateTab(tabButtons[targetIndex].dataset.tab, true);
        updateShareUrl();
      });
    });

    common.bindCopyLink(document.getElementById('copy-repayment-link'), () => latestShareUrl);
    common.bindCopyLink(document.getElementById('copy-refinance-link'), () => latestShareUrl);
    renderAllAndSyncUrl();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLoanPage);
  } else {
    initializeLoanPage();
  }
})(window);
