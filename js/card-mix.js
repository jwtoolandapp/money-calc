(function (global) {
  'use strict';

  const CONSTANTS = global.CALC_CONSTANTS_2026;
  const TAX = CONSTANTS.YEAR_END_TAX;
  const MATH = CONSTANTS.MATH;
  const ZERO = MATH.ZERO;

  function nonNegative(value) {
    const normalized = typeof value === 'string' ? value.replace(/,/g, '') : value;
    const number = Number(normalized);
    return Number.isFinite(number) ? Math.max(ZERO, number) : ZERO;
  }

  function findBracket(value, brackets, limitKey) {
    return brackets.find((bracket) => bracket[limitKey] == null || value <= bracket[limitKey]) || brackets[brackets.length - 1];
  }

  // 카드 소득공제 "황금비율": 총급여의 25% 문턱까지는 어떤 카드를 써도 공제가 없으므로
  // 혜택(적립·할인)이 좋은 신용카드로 채우고, 문턱을 넘는 금액부터는 공제율이 2배(30% vs 15%)인
  // 체크카드·현금영수증으로 쓰는 것이 소득공제 관점에서 가장 유리하다. 이 계산기는 그 배분과
  // 실제 절세 효과를 계산한다. (전통시장·대중교통 40%, 도서·공연 30% 추가공제는 간이 계산 특성상 미반영 —
  // year-end-tax.js와 동일한 카드공제 상수를 그대로 재사용해 일관성을 유지한다.)
  function calculateCardMix(input) {
    const source = input || {};
    const grossSalary = nonNegative(source.grossSalary);
    const totalCardSpend = nonNegative(source.totalCardSpend);

    const threshold = grossSalary * TAX.CARD_THRESHOLD_RATE;
    const capBracket = findBracket(grossSalary, TAX.CARD_CAP_BRACKETS, 'salaryUpTo');
    const cap = capBracket.cap;

    const hasThresholdCleared = totalCardSpend > threshold;
    const eligibleAmount = Math.max(ZERO, totalCardSpend - threshold);

    // 황금비율 배분: 신용카드로 문턱까지, 나머지는 체크카드·현금영수증으로.
    const recommendedCredit = Math.min(totalCardSpend, threshold);
    const recommendedDebit = Math.max(ZERO, totalCardSpend - threshold);
    const goldenDeductionRaw = recommendedDebit * TAX.DEBIT_CASH_DEDUCTION_RATE;
    const goldenDeduction = Math.min(goldenDeductionRaw, cap);

    // 비교: 총 사용액을 전부 신용카드로만 썼을 경우.
    const allCreditDeductionRaw = eligibleAmount * TAX.CREDIT_CARD_DEDUCTION_RATE;
    const allCreditDeduction = Math.min(allCreditDeductionRaw, cap);

    const extraBenefit = Math.max(ZERO, goldenDeduction - allCreditDeduction);
    const isCapped = goldenDeductionRaw > cap;

    return {
      grossSalary,
      totalCardSpend,
      threshold,
      thresholdRate: TAX.CARD_THRESHOLD_RATE,
      cap,
      hasThresholdCleared,
      eligibleAmount,
      recommendedCredit,
      recommendedDebit,
      goldenDeduction,
      allCreditDeduction,
      extraBenefit,
      isCapped,
      creditRate: TAX.CREDIT_CARD_DEDUCTION_RATE,
      debitRate: TAX.DEBIT_CASH_DEDUCTION_RATE,
    };
  }

  const calculators = global.MoneyCalcCalculators || {};
  calculators.cardMix = Object.freeze({ calculateCardMix, calculate: calculateCardMix });
  global.MoneyCalcCalculators = calculators;

  if (typeof document === 'undefined') return;

  function initCardMixPage() {
    const U = global.MoneyCalc;
    const form = document.getElementById('card-mix-form');
    if (!U || !form) return;

    function readInput() {
      return {
        grossSalary: U.parseNumber(form.elements.grossSalary.value),
        totalCardSpend: U.parseNumber(form.elements.totalCardSpend.value),
      };
    }

    function render(result) {
      const resultValue = document.getElementById('card-mix-result-value');
      const summary = document.getElementById('card-mix-result-summary');
      const status = document.getElementById('card-mix-status');

      resultValue.textContent = U.formatWon(result.goldenDeduction);

      if (result.totalCardSpend === ZERO) {
        summary.textContent = '연간 카드 사용 예정액을 입력하면 최적 배분을 계산합니다.';
        status.hidden = true;
      } else if (!result.hasThresholdCleared) {
        summary.textContent = `총급여의 ${U.formatPercent(result.thresholdRate * MATH.HUNDRED, 0)}(${U.formatWon(result.threshold)}) 문턱을 넘지 않아 카드 공제 자체가 발생하지 않습니다.`;
        status.hidden = false;
        status.textContent = '문턱 이하 금액은 어떤 카드로 써도 공제와 무관하니, 혜택 좋은 카드를 자유롭게 쓰세요.';
        status.classList.remove('error');
      } else {
        summary.textContent = `신용카드 ${U.formatWon(result.recommendedCredit)} + 체크카드·현금영수증 ${U.formatWon(result.recommendedDebit)}로 나눠 쓰면 예상 공제액입니다.`;
        status.hidden = false;
        if (result.extraBenefit > ZERO) {
          status.textContent = `전부 신용카드로만 썼을 때(${U.formatWon(result.allCreditDeduction)})보다 ${U.formatWon(result.extraBenefit)} 더 공제받는 배분입니다.`;
        } else {
          status.textContent = '이미 공제 한도에 도달해 배분을 바꿔도 공제액 차이는 없습니다.';
        }
        status.classList.toggle('error', false);
      }

      document.getElementById('threshold-result').textContent = U.formatWon(result.threshold);
      document.getElementById('recommended-credit-result').textContent = U.formatWon(result.recommendedCredit);
      document.getElementById('recommended-debit-result').textContent = U.formatWon(result.recommendedDebit);
      document.getElementById('golden-deduction-result').textContent = U.formatWon(result.goldenDeduction);
      document.getElementById('all-credit-deduction-result').textContent = U.formatWon(result.allCreditDeduction);
      document.getElementById('extra-benefit-result').textContent = U.formatWon(result.extraBenefit);
      document.getElementById('cap-result').textContent = U.formatWon(result.cap);
    }

    function recalculate() {
      render(calculateCardMix(readInput()));
      U.setQuery(U.formToParams(form));
    }

    U.setupNumericInputs(form);
    U.restoreForm(form);
    form.addEventListener('input', recalculate);
    form.addEventListener('change', recalculate);
    U.bindCopyLink(document.getElementById('copy-card-mix-link'), () => global.location.href);
    recalculate();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCardMixPage);
  else initCardMixPage();
})(window);
