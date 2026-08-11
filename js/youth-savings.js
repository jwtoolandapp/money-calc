(function (global) {
  'use strict';
  const C = global.CALC_CONSTANTS_2026, U = global.MoneyCalc;
  if (!C || !U) return;
  const L = C.YOUTH_LEAP_ACCOUNT, T = C.YOUTH_TOMORROW_SAVINGS;
  const nonNegative = (value) => Math.max(0, U.parseNumber(value));
  function annuityFutureValue(monthlyPayment, months, annualRatePercent) {
    const rate = nonNegative(annualRatePercent) / 100 / 12;
    if (!rate) return monthlyPayment * months;
    return monthlyPayment * ((Math.pow(1 + rate, months) - 1) / rate);
  }
  function leapMonthlyContribution(deposit, annualIncome) {
    const safeDeposit = Math.min(nonNegative(deposit), L.MAX_MONTHLY_DEPOSIT);
    const bracket = L.MATCHING_BRACKETS.find((row) => nonNegative(annualIncome) <= row.incomeUpTo) || L.MATCHING_BRACKETS[L.MATCHING_BRACKETS.length - 1];
    if (!bracket || bracket.maxMonthly === 0) return 0;
    const first = Math.min(safeDeposit, bracket.matchCapFirst) * bracket.rateFirst;
    const remainder = Math.max(0, safeDeposit - bracket.matchCapFirst) * bracket.rateRemaining;
    return Math.min(bracket.maxMonthly, first + remainder);
  }
  function calculateLeap(input) {
    const monthlyDeposit = Math.min(nonNegative(input && input.monthlyDeposit), L.MAX_MONTHLY_DEPOSIT);
    const annualIncome = nonNegative(input && input.annualIncome), annualRate = nonNegative(input && input.annualRate);
    const monthlyContribution = leapMonthlyContribution(monthlyDeposit, annualIncome);
    const principal = monthlyDeposit * L.MATURITY_MONTHS, governmentContribution = monthlyContribution * L.MATURITY_MONTHS;
    const maturity = annuityFutureValue(monthlyDeposit + monthlyContribution, L.MATURITY_MONTHS, annualRate);
    return { monthlyDeposit, annualIncome, annualRate, months: L.MATURITY_MONTHS, monthlyContribution, principal, governmentContribution, interest: Math.max(0, maturity - principal - governmentContribution), maturity };
  }
  function calculateTomorrow(input) {
    const monthlyDeposit = U.clamp(nonNegative(input && input.monthlyDeposit), T.MIN_MONTHLY_DEPOSIT, T.MAX_MONTHLY_DEPOSIT);
    const nearPoverty = Boolean(input && input.nearPoverty), annualRate = nonNegative(input && input.annualRate);
    const monthlyContribution = nearPoverty ? T.NEAR_POVERTY_OR_BELOW.monthlyGovSupport : T.GENERAL.monthlyGovSupport;
    const principal = monthlyDeposit * T.MATURITY_MONTHS, governmentContribution = monthlyContribution * T.MATURITY_MONTHS;
    const maturity = annuityFutureValue(monthlyDeposit + monthlyContribution, T.MATURITY_MONTHS, annualRate);
    return { monthlyDeposit, nearPoverty, annualRate, months: T.MATURITY_MONTHS, monthlyContribution, principal, governmentContribution, interest: Math.max(0, maturity - principal - governmentContribution), maturity };
  }
  global.MoneyCalcCalculators = global.MoneyCalcCalculators || {};
  global.MoneyCalcCalculators.youthSavings = Object.freeze({ calculateLeap, calculateTomorrow, leapMonthlyContribution });
  if (typeof document === 'undefined') return;
  function init() {
    const leapForm = document.getElementById('youth-leap-form'), tomorrowForm = document.getElementById('youth-tomorrow-form');
    if (!leapForm || !tomorrowForm) return;
    U.setupNumericInputs(document); const params = U.queryParams(); U.restoreForm(leapForm, params); U.restoreForm(tomorrowForm, params);
    const buttons = Array.from(document.querySelectorAll('[data-youth-tab]'));
    let activeTab = params.get('tab') === 'tomorrow' ? 'tomorrow' : 'leap';
    function setTab(tab) {
      activeTab = tab === 'tomorrow' ? 'tomorrow' : 'leap';
      buttons.forEach((button) => button.setAttribute('aria-selected', String(button.dataset.youthTab === activeTab)));
      document.getElementById('youth-leap-panel').hidden = activeTab !== 'leap';
      document.getElementById('youth-tomorrow-panel').hidden = activeTab !== 'tomorrow';
      render();
    }
    function render() {
      let result, label;
      if (activeTab === 'leap') {
        result = calculateLeap({ monthlyDeposit: leapForm.elements.leapMonthlyDeposit.value, annualIncome: leapForm.elements.annualIncome.value, annualRate: leapForm.elements.leapAnnualRate.value }); label = '청년도약계좌';
      } else {
        result = calculateTomorrow({ monthlyDeposit: tomorrowForm.elements.tomorrowMonthlyDeposit.value, annualRate: tomorrowForm.elements.tomorrowAnnualRate.value, nearPoverty: tomorrowForm.elements.nearPoverty.checked }); label = '청년내일저축계좌';
      }
      document.getElementById('youth-result-value').textContent = U.formatWon(result.maturity);
      document.getElementById('youth-result-summary').textContent = `${label} ${result.months}개월 만기 예상액(월복리 가정)`;
      document.getElementById('youth-result-details').innerHTML = [['본인 납입 원금', U.formatWon(result.principal)], ['정부지원 합계', U.formatWon(result.governmentContribution)], ['예상 이자(비과세 가정)', U.formatWon(result.interest)], ['월 정부지원', U.formatWon(result.monthlyContribution)]].map(([a,b]) => `<div class="result-row"><dt>${a}</dt><dd>${b}</dd></div>`).join('');
      const form = activeTab === 'leap' ? leapForm : tomorrowForm, out = U.formToParams(form); out.set('tab', activeTab); U.setQuery(out);
    }
    buttons.forEach((button) => button.addEventListener('click', () => setTab(button.dataset.youthTab)));
    [leapForm, tomorrowForm].forEach((form) => { form.addEventListener('input', render); form.addEventListener('change', render); });
    U.bindCopyLink(document.getElementById('copy-youth-link'), () => global.location.href); setTab(activeTab);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
