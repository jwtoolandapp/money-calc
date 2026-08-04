(function (global) {
  'use strict';

  const C = global.CALC_CONSTANTS_2026;
  const U = global.MoneyCalc;
  if (!C || !U) return;

  const FX = C.FX;
  const MATH = C.MATH;
  const ZERO = MATH.ZERO;
  const ONE = MATH.ONE;

  function nonNegative(value) {
    return Math.max(ZERO, U.parseNumber(value));
  }

  function normalizeCurrency(value) {
    const code = String(value || '').toUpperCase();
    return Object.prototype.hasOwnProperty.call(FX.CURRENCIES, code) ? code : 'OTHER';
  }

  function percentToRate(value) {
    return U.clamp(nonNegative(value), ZERO, MATH.HUNDRED) / MATH.HUNDRED;
  }

  function own(source, key) {
    return Object.prototype.hasOwnProperty.call(source, key);
  }

  function calculateCardCharge(input) {
    const source = input || {};
    const foreignAmount = nonNegative(source.foreignAmount);
    const exchangeRate = nonNegative(source.exchangeRate);
    const brandFeeRate = own(source, 'brandFeeRate')
      ? nonNegative(source.brandFeeRate)
      : own(source, 'brandFeePercent')
        ? percentToRate(source.brandFeePercent)
        : FX.DEFAULT_BRAND_FEE_RATE;
    const issuerFeeRate = own(source, 'issuerFeeRate')
      ? nonNegative(source.issuerFeeRate)
      : own(source, 'issuerFeePercent')
        ? percentToRate(source.issuerFeePercent)
        : FX.DEFAULT_ISSUER_FEE_RATE;
    const baseWon = foreignAmount * exchangeRate;
    const brandFee = baseWon * brandFeeRate;
    const issuerFee = baseWon * issuerFeeRate;
    const totalFee = brandFee + issuerFee;
    const totalCharge = baseWon + totalFee;

    return {
      foreignAmount,
      exchangeRate,
      baseWon: Number.isFinite(baseWon) ? baseWon : ZERO,
      brandFeeRate,
      issuerFeeRate,
      totalFeeRate: brandFeeRate + issuerFeeRate,
      brandFee: Number.isFinite(brandFee) ? brandFee : ZERO,
      issuerFee: Number.isFinite(issuerFee) ? issuerFee : ZERO,
      totalFee: Number.isFinite(totalFee) ? totalFee : ZERO,
      totalCharge: Number.isFinite(totalCharge) ? totalCharge : ZERO,
    };
  }

  function calculateCashExchange(input) {
    const source = input || {};
    const currency = normalizeCurrency(source.currency);
    const foreignAmount = nonNegative(source.foreignAmount);
    const exchangeRate = nonNegative(source.exchangeRate);
    const preferenceRate = percentToRate(source.preferencePercent);
    const spreadRate = FX.CASH_SPREADS[currency];
    const appliedSpreadRate = spreadRate * (ONE - preferenceRate);
    const baseWon = foreignAmount * exchangeRate;
    const spreadCost = baseWon * appliedSpreadRate;
    const totalCost = baseWon + spreadCost;

    return {
      currency,
      foreignAmount,
      exchangeRate,
      preferenceRate,
      spreadRate,
      appliedSpreadRate,
      baseWon: Number.isFinite(baseWon) ? baseWon : ZERO,
      spreadCost: Number.isFinite(spreadCost) ? spreadCost : ZERO,
      totalCost: Number.isFinite(totalCost) ? totalCost : ZERO,
    };
  }

  function compareCashAndCard(input) {
    const source = input || {};
    const card = calculateCardCharge(source);
    const cash = calculateCashExchange(source);
    const signedDifference = card.totalCharge - cash.totalCost;
    const difference = Math.abs(signedDifference);
    const better = signedDifference > ZERO ? 'cash' : signedDifference < ZERO ? 'card' : 'same';
    return {
      card,
      cash,
      difference,
      signedDifference,
      better,
    };
  }

  global.MoneyCalcCalculators = global.MoneyCalcCalculators || {};
  global.MoneyCalcCalculators.fxFee = Object.freeze({
    normalizeCurrency,
    calculateCardCharge,
    calculateCashExchange,
    compareCashAndCard,
    calculate: calculateCardCharge,
  });

  if (typeof document === 'undefined') return;

  function init() {
    const form = document.getElementById('fx-fee-form');
    if (!form) return;

    const params = U.queryParams();
    const tabButtons = Array.from(form.querySelectorAll('[data-tab]'));
    const tabPanels = Array.from(form.querySelectorAll('[data-panel]'));
    const currencyInput = form.elements.currency;
    const brandFeeInput = form.elements.brandFeePercent;
    const issuerFeeInput = form.elements.issuerFeePercent;
    let activeTab = params.get('tab') === 'compare' ? 'compare' : 'card';
    let latestUrl = global.location.href;

    U.restoreForm(form, params);
    if (!params.has('brandFeePercent')) {
      brandFeeInput.value = U.formatNumber(FX.DEFAULT_BRAND_FEE_RATE * MATH.HUNDRED, 3);
    }
    if (!params.has('issuerFeePercent')) {
      issuerFeeInput.value = U.formatNumber(FX.DEFAULT_ISSUER_FEE_RATE * MATH.HUNDRED, 3);
    }

    function readInput() {
      return {
        currency: currencyInput.value,
        foreignAmount: U.parseNumber(form.elements.foreignAmount.value),
        exchangeRate: U.parseNumber(form.elements.exchangeRate.value),
        brandFeePercent: U.parseNumber(brandFeeInput.value),
        issuerFeePercent: U.parseNumber(issuerFeeInput.value),
        preferencePercent: U.parseNumber(form.elements.preferencePercent.value),
      };
    }

    function updateCurrencyPresentation() {
      const currency = normalizeCurrency(currencyInput.value);
      const config = FX.CURRENCIES[currency];
      document.getElementById('fx-amount-unit').textContent = config.symbol || '외화';
      document.getElementById('fx-rate-unit-copy').textContent = config.rateUnit;
      document.getElementById('fx-currency-name').textContent = config.label;
    }

    function activateTab(nextTab, shouldFocus) {
      activeTab = nextTab === 'compare' ? 'compare' : 'card';
      tabButtons.forEach((button) => {
        const selected = button.dataset.tab === activeTab;
        button.setAttribute('aria-selected', selected ? 'true' : 'false');
        button.tabIndex = selected ? ZERO : -ONE;
        if (selected && shouldFocus) button.focus();
      });
      tabPanels.forEach((panel) => U.setHidden(panel, panel.dataset.panel !== activeTab));
      U.setHidden(document.getElementById('dcc-warning'), activeTab !== 'card');
    }

    function setRows(rows) {
      const list = document.getElementById('fx-result-details');
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
      const input = readInput();
      const resultLabel = document.getElementById('fx-result-label');
      const resultValue = document.getElementById('fx-result-value');
      const resultSummary = document.getElementById('fx-result-summary');
      const resultStatus = document.getElementById('fx-result-status');

      if (activeTab === 'card') {
        const result = calculateCardCharge(input);
        resultLabel.textContent = '예상 카드 청구액';
        resultValue.textContent = U.formatWon(result.totalCharge);
        resultSummary.textContent = `${FX.CURRENCIES[normalizeCurrency(input.currency)].label} 결제액에 입력한 환율과 두 수수료를 적용했습니다.`;
        setRows([
          ['환율 적용 원화금액', U.formatWon(result.baseWon)],
          [`국제브랜드 수수료 (${U.formatPercent(result.brandFeeRate * MATH.HUNDRED, 3)})`, U.formatWon(result.brandFee)],
          [`카드사 해외이용 수수료 (${U.formatPercent(result.issuerFeeRate * MATH.HUNDRED, 3)})`, U.formatWon(result.issuerFee)],
          ['총 해외결제 수수료', U.formatWon(result.totalFee)],
        ]);
        resultStatus.textContent = `카드 총 수수료율은 ${U.formatPercent(result.totalFeeRate * MATH.HUNDRED, 3)}입니다.`;
        return result;
      }

      const comparison = compareCashAndCard(input);
      if (comparison.better === 'cash') {
        resultLabel.textContent = '현금 환전 예상 절약액';
        resultValue.textContent = U.formatWon(comparison.difference);
        resultSummary.textContent = `이 금액이면 현금 환전이 ${U.formatWon(comparison.difference)} 더 유리합니다.`;
      } else if (comparison.better === 'card') {
        resultLabel.textContent = '카드 결제 예상 절약액';
        resultValue.textContent = U.formatWon(comparison.difference);
        resultSummary.textContent = `이 금액이면 카드 결제가 ${U.formatWon(comparison.difference)} 더 유리합니다.`;
      } else {
        resultLabel.textContent = '예상 비용 차이';
        resultValue.textContent = U.formatWon(ZERO);
        resultSummary.textContent = '입력한 조건에서는 현금 환전과 카드 결제 비용이 같습니다.';
      }
      setRows([
        ['매매기준율 적용금액', U.formatWon(comparison.cash.baseWon)],
        ['우대 적용 후 현찰 스프레드', U.formatWon(comparison.cash.spreadCost)],
        ['현금 환전 예상 비용', U.formatWon(comparison.cash.totalCost)],
        ['카드 결제 예상 청구액', U.formatWon(comparison.card.totalCharge)],
      ]);
      resultStatus.textContent =
        `${FX.CURRENCIES[comparison.cash.currency].label} 기본 현찰 스프레드 ${U.formatPercent(comparison.cash.spreadRate * MATH.HUNDRED, 2)}에서 ` +
        `환전 우대를 반영한 실질 스프레드는 ${U.formatPercent(comparison.cash.appliedSpreadRate * MATH.HUNDRED, 3)}입니다.`;
      return comparison;
    }

    function syncQuery() {
      const next = U.formToParams(form);
      next.set('tab', activeTab);
      latestUrl = U.setQuery(next);
      return latestUrl;
    }

    function recalculate() {
      updateCurrencyPresentation();
      activateTab(activeTab, false);
      render();
      syncQuery();
    }

    tabButtons.forEach((button, index) => {
      button.addEventListener('click', () => {
        activeTab = button.dataset.tab;
        recalculate();
      });
      button.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        let targetIndex = index;
        if (event.key === 'ArrowLeft') targetIndex = (index - ONE + tabButtons.length) % tabButtons.length;
        if (event.key === 'ArrowRight') targetIndex = (index + ONE) % tabButtons.length;
        if (event.key === 'Home') targetIndex = ZERO;
        if (event.key === 'End') targetIndex = tabButtons.length - ONE;
        activeTab = tabButtons[targetIndex].dataset.tab;
        activateTab(activeTab, true);
        render();
        syncQuery();
      });
    });

    form.addEventListener('input', recalculate);
    form.addEventListener('change', recalculate);
    U.setupNumericInputs(form);
    document.getElementById('dcc-min-rate').textContent = U.formatNumber(FX.DCC_WARNING_MIN * MATH.HUNDRED, ZERO);
    document.getElementById('dcc-max-rate').textContent = U.formatNumber(FX.DCC_WARNING_MAX * MATH.HUNDRED, ZERO);
    recalculate();
    U.bindCopyLink(document.getElementById('copy-fx-link'), () => latestUrl);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
