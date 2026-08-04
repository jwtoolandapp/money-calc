(function (global) {
  'use strict';

  const C = global.CALC_CONSTANTS_2026;
  const MoneyCalc = global.MoneyCalc;
  if (!C || !MoneyCalc) return;

  const ZERO = C.MATH.ZERO;
  const ONE = C.MATH.ONE;
  const TWO = C.MATH.TWO;
  const HUNDRED = C.MATH.HUNDRED;
  const PERIODS = C.SAVINGS.COMPOUNDING_PERIODS_PER_YEAR;
  const MAX_MONTHS = C.SAVINGS.MAX_MONTHS;
  const TAX_RATE = C.FINANCIAL_TAX.INTEREST_INCOME_TAX_RATE;

  function nonNegative(value) {
    return Math.max(ZERO, MoneyCalc.parseNumber(value));
  }

  function normalizedMonths(value) {
    return Math.min(MAX_MONTHS, Math.max(ZERO, Math.trunc(nonNegative(value))));
  }

  function enabled(value) {
    return value === true || value === ONE || ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
  }

  function calculateDeposit(options) {
    const input = options || {};
    const amount = nonNegative(input.amount != null ? input.amount : input.principal);
    const months = normalizedMonths(input.months);
    const annualRatePercent = nonNegative(input.annualRatePercent != null ? input.annualRatePercent : input.rate);
    const annualRate = annualRatePercent / HUNDRED;
    const interestType = input.interestType === 'compound' || input.interest === 'compound' ? 'compound' : 'simple';
    const monthlyRate = annualRate / PERIODS;
    const grossInterest = interestType === 'compound'
      ? amount * (Math.pow(ONE + monthlyRate, months) - ONE)
      : amount * annualRate * months / PERIODS;

    return {
      productType: 'deposit',
      interestType,
      amount,
      months,
      annualRatePercent,
      principalAmount: amount,
      grossInterest: Number.isFinite(grossInterest) ? Math.max(ZERO, grossInterest) : ZERO,
    };
  }

  function calculateInstallment(options) {
    const input = options || {};
    const amount = nonNegative(input.amount != null ? input.amount : input.monthlyPayment);
    const months = normalizedMonths(input.months);
    const annualRatePercent = nonNegative(input.annualRatePercent != null ? input.annualRatePercent : input.rate);
    const annualRate = annualRatePercent / HUNDRED;
    const interestType = input.interestType === 'compound' || input.interest === 'compound' ? 'compound' : 'simple';
    const monthlyRate = annualRate / PERIODS;
    const principalAmount = amount * months;
    let maturityBeforeTax = principalAmount;

    if (interestType === 'compound' && monthlyRate > ZERO) {
      maturityBeforeTax = amount * (ONE + monthlyRate) * (Math.pow(ONE + monthlyRate, months) - ONE) / monthlyRate;
    } else if (interestType === 'simple') {
      maturityBeforeTax += amount * annualRate / PERIODS * months * (months + ONE) / TWO;
    }
    const grossInterest = Math.max(ZERO, maturityBeforeTax - principalAmount);

    return {
      productType: 'installment',
      interestType,
      amount,
      months,
      annualRatePercent,
      principalAmount,
      grossInterest: Number.isFinite(grossInterest) ? grossInterest : ZERO,
    };
  }

  function calculateSavings(options) {
    const input = options || {};
    const productType = input.productType === 'deposit' || input.product === 'deposit' ? 'deposit' : 'installment';
    const base = productType === 'deposit' ? calculateDeposit(input) : calculateInstallment(input);
    const taxFree = enabled(input.taxFree);
    const taxAmount = taxFree ? ZERO : base.grossInterest * TAX_RATE;
    const netInterest = base.grossInterest - taxAmount;
    const maturityAmount = base.principalAmount + netInterest;

    return Object.assign({}, base, {
      taxFree,
      taxRate: taxFree ? ZERO : TAX_RATE,
      taxAmount: Number.isFinite(taxAmount) ? taxAmount : ZERO,
      netInterest: Number.isFinite(netInterest) ? netInterest : ZERO,
      maturityAmount: Number.isFinite(maturityAmount) ? maturityAmount : ZERO,
    });
  }

  global.MoneyCalcCalculators = global.MoneyCalcCalculators || {};
  global.MoneyCalcCalculators.savings = Object.freeze({
    calculateSavings,
    calculateDeposit,
    calculateInstallment,
  });

  if (!global.document) return;

  function initSavingsCalculator() {
    const form = document.getElementById('savings-form');
    if (!form) return;

    const productInput = document.getElementById('product-value');
    const interestInput = document.getElementById('interest-value');
    const productButtons = Array.from(form.querySelectorAll('[data-product]'));
    const interestButtons = Array.from(form.querySelectorAll('[data-interest]'));
    const amountLabel = document.getElementById('amount-label');
    const resultValue = document.getElementById('savings-result-value');
    const resultSummary = document.getElementById('savings-result-summary');
    const resultDetails = document.getElementById('savings-result-details');
    const copyButton = document.getElementById('copy-result-link');
    let latestShareUrl = global.location.href;

    MoneyCalc.restoreForm(form, MoneyCalc.queryParams());
    if (!['deposit', 'installment'].includes(productInput.value)) productInput.value = 'installment';
    if (!['simple', 'compound'].includes(interestInput.value)) interestInput.value = 'simple';
    MoneyCalc.setupNumericInputs(form);

    function raw(id) {
      const element = document.getElementById(id);
      return element ? String(element.value).replace(/,/g, '') : '';
    }

    function syncControls() {
      productButtons.forEach((button) => {
        button.setAttribute('aria-pressed', button.dataset.product === productInput.value ? 'true' : 'false');
      });
      interestButtons.forEach((button) => {
        button.setAttribute('aria-pressed', button.dataset.interest === interestInput.value ? 'true' : 'false');
      });
      amountLabel.textContent = productInput.value === 'deposit' ? '예치금' : '월 납입액';
    }

    function appendDetail(label, value, className) {
      const row = document.createElement('div');
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      row.className = 'result-row';
      term.textContent = label;
      description.textContent = value;
      if (className) description.classList.add(className);
      row.append(term, description);
      resultDetails.appendChild(row);
    }

    function calculateAndRender() {
      const result = calculateSavings({
        product: productInput.value,
        interest: interestInput.value,
        amount: raw('amount'),
        months: raw('months'),
        rate: raw('annual-rate'),
        taxFree: document.getElementById('tax-free').checked,
      });
      const productName = result.productType === 'deposit' ? '예금' : '적금';
      const interestName = result.interestType === 'compound' ? '월복리' : '단리';

      resultValue.textContent = MoneyCalc.formatWon(result.maturityAmount);
      resultSummary.textContent = `${productName} ${interestName}, ${MoneyCalc.formatNumber(result.months, ZERO)}개월 기준 예상 금액입니다.`;
      resultDetails.replaceChildren();
      appendDetail('납입 원금', MoneyCalc.formatWon(result.principalAmount));
      appendDetail('세전 이자', MoneyCalc.formatWon(result.grossInterest));
      appendDetail(
        result.taxFree
          ? '이자소득세 (비과세)'
          : `이자소득세 ${MoneyCalc.formatPercent(TAX_RATE * HUNDRED, ONE)}`,
        MoneyCalc.formatWon(result.taxAmount)
      );
      appendDetail('세후 이자', MoneyCalc.formatWon(result.netInterest), 'positive');
      latestShareUrl = MoneyCalc.setQuery(MoneyCalc.formToParams(form));
    }

    productButtons.forEach((button) => {
      button.addEventListener('click', () => {
        productInput.value = button.dataset.product;
        syncControls();
        calculateAndRender();
      });
    });
    interestButtons.forEach((button) => {
      button.addEventListener('click', () => {
        interestInput.value = button.dataset.interest;
        syncControls();
        calculateAndRender();
      });
    });
    form.addEventListener('input', calculateAndRender);
    form.addEventListener('change', calculateAndRender);
    MoneyCalc.bindCopyLink(copyButton, () => latestShareUrl);
    syncControls();
    calculateAndRender();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSavingsCalculator);
  } else {
    initSavingsCalculator();
  }
})(window);
