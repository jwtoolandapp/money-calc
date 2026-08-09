(function (global) {
  'use strict';

  const C = global.CALC_CONSTANTS_2026;
  const MC = global.MoneyCalc;
  const TAX = C.YEAR_END_TAX;
  const MATH = C.MATH;
  const ZERO = MATH.ZERO;
  const ONE = MATH.ONE;

  function nonNegative(value) {
    return Math.max(ZERO, MC.parseNumber(value));
  }

  function findBracket(value, brackets, limitKey) {
    return brackets.find((bracket) => bracket[limitKey] == null || value <= bracket[limitKey]) || brackets[brackets.length - ONE];
  }

  function earnedIncomeDeduction(grossSalary) {
    const salary = nonNegative(grossSalary);
    const bracket = findBracket(salary, TAX.EARNED_INCOME_DEDUCTION_BRACKETS, 'upTo');
    const calculated = bracket.base + Math.max(ZERO, salary - bracket.excessFrom) * bracket.rate;
    return Math.min(calculated, TAX.EARNED_INCOME_DEDUCTION_CAP, salary);
  }

  function cardDeduction(grossSalary, creditCard, debitCash, traditionalMarket, publicTransport, culture) {
    const salary = nonNegative(grossSalary);
    const credit = nonNegative(creditCard);
    const debit = nonNegative(debitCash);
    const market = nonNegative(traditionalMarket);
    const transport = nonNegative(publicTransport);
    const cultureSpend = salary <= TAX.CULTURE_ELIGIBLE_SALARY_LIMIT ? nonNegative(culture) : ZERO;
    const total = credit + debit + market + transport + cultureSpend;
    const threshold = salary * TAX.CARD_THRESHOLD_RATE;
    if (total <= threshold) return ZERO;

    // 2026년 귀속 placeholder 계산 순서: 최저 공제율인 신용카드 사용액부터 문턱을 차감한다.
    const thresholdUsedByCredit = Math.min(credit, threshold);
    const remainingThreshold = Math.max(ZERO, threshold - thresholdUsedByCredit);
    const eligibleCredit = Math.max(ZERO, credit - thresholdUsedByCredit);
    const thresholdUsedByDebit = Math.min(debit, remainingThreshold);
    const remainingAfterDebit = Math.max(ZERO, remainingThreshold - thresholdUsedByDebit);
    const eligibleDebit = Math.max(ZERO, debit - thresholdUsedByDebit);
    let specialThreshold = remainingAfterDebit;
    const eligibleCulture = Math.max(ZERO, cultureSpend - Math.min(cultureSpend, specialThreshold));
    specialThreshold = Math.max(ZERO, specialThreshold - cultureSpend);
    const eligibleMarket = Math.max(ZERO, market - Math.min(market, specialThreshold));
    specialThreshold = Math.max(ZERO, specialThreshold - market);
    const eligibleTransport = Math.max(ZERO, transport - Math.min(transport, specialThreshold));
    const rawBasicDeduction = eligibleCredit * TAX.CREDIT_CARD_DEDUCTION_RATE
      + eligibleDebit * TAX.DEBIT_CASH_DEDUCTION_RATE;
    const rawAdditionalDeduction = eligibleMarket * TAX.TRADITIONAL_MARKET_RATE
      + eligibleTransport * TAX.PUBLIC_TRANSPORT_RATE
      + eligibleCulture * TAX.CULTURE_RATE;
    const capBracket = findBracket(salary, TAX.CARD_CAP_BRACKETS, 'salaryUpTo');
    const additionalCapBracket = findBracket(salary, TAX.ADDITIONAL_CARD_CAP_BRACKETS, 'salaryUpTo');
    return Math.min(rawBasicDeduction, capBracket.cap) + Math.min(rawAdditionalDeduction, additionalCapBracket.cap);
  }

  function incomeTax(taxableIncome) {
    const base = nonNegative(taxableIncome);
    const bracket = findBracket(base, TAX.INCOME_TAX_BRACKETS, 'upTo');
    return Math.max(ZERO, base * bracket.rate - bracket.quickDeduction);
  }

  function earnedTaxCredit(calculatedTax, grossSalary) {
    const tax = nonNegative(calculatedTax);
    const config = TAX.EARNED_TAX_CREDIT;
    const raw = tax <= config.FIRST_TAX_THRESHOLD
      ? tax * config.FIRST_RATE
      : config.EXCESS_BASE + (tax - config.FIRST_TAX_THRESHOLD) * config.EXCESS_RATE;
    const capBracket = findBracket(nonNegative(grossSalary), config.SALARY_CAP_BRACKETS, 'salaryUpTo');
    return Math.min(raw, capBracket.cap, tax);
  }

  function pensionCredit(grossSalary, pensionSavings, irp) {
    const pensionConfig = TAX.PENSION;
    const savingsApplied = Math.min(nonNegative(pensionSavings), pensionConfig.PENSION_SAVINGS_CAP);
    const irpApplied = Math.min(nonNegative(irp), Math.max(ZERO, pensionConfig.COMBINED_CAP - savingsApplied));
    const applied = savingsApplied + irpApplied;
    const rate = nonNegative(grossSalary) <= pensionConfig.HIGH_RATE_SALARY_LIMIT
      ? pensionConfig.HIGH_RATE
      : pensionConfig.STANDARD_RATE;
    return {
      applied,
      savingsApplied,
      irpApplied,
      rate,
      credit: applied * rate,
      remaining: Math.max(ZERO, pensionConfig.COMBINED_CAP - applied),
    };
  }

  function donationCredit(donation) {
    const amount = nonNegative(donation);
    const config = TAX.DONATION;
    const first = Math.min(amount, config.FIRST_THRESHOLD) * config.FIRST_RATE;
    const excess = Math.max(ZERO, amount - config.FIRST_THRESHOLD) * config.EXCESS_RATE;
    return first + excess;
  }

  function calculateYearEndTax(input) {
    const grossSalary = nonNegative(input.grossSalary);
    const withheldTax = nonNegative(input.withheldTax);
    const dependentCount = Math.floor(nonNegative(input.dependents));
    const workDeduction = earnedIncomeDeduction(grossSalary);
    const earnedIncome = Math.max(ZERO, grossSalary - workDeduction);
    const additional = TAX.ADDITIONAL_DEDUCTIONS;
    const additionalPersonalDeduction = Math.floor(nonNegative(input.elderly70Count)) * additional.ELDERLY_70_UP
      + Math.floor(nonNegative(input.disabledCount)) * additional.DISABLED
      + ((input.singleParent === true || input.singleParent === '1') ? additional.SINGLE_PARENT
        : (input.singleWomanHead === true || input.singleWomanHead === '1') ? additional.SINGLE_WOMAN_HEAD : ZERO);
    const personalDeduction = Math.min(
      earnedIncome,
      (TAX.TAXPAYER_COUNT + dependentCount) * TAX.PERSONAL_DEDUCTION_PER_PERSON + additionalPersonalDeduction,
    );
    const card = cardDeduction(grossSalary, input.creditCard, input.debitCash, input.traditionalMarket, input.publicTransport, input.culture);
    const taxableIncome = Math.max(ZERO, earnedIncome - personalDeduction - card);
    const calculatedTax = incomeTax(taxableIncome);

    const workTaxCredit = earnedTaxCredit(calculatedTax, grossSalary);
    const pension = pensionCredit(grossSalary, input.pensionSavings, input.irp);
    const medicalGeneralEligible = Math.max(
      ZERO,
      nonNegative(input.medical) + Math.min(nonNegative(input.medicalDependent), TAX.MEDICAL_DEPENDENT_CAP)
        - grossSalary * TAX.MEDICAL.SALARY_THRESHOLD_RATE,
    );
    const medicalCredit = medicalGeneralEligible * TAX.MEDICAL.CREDIT_RATE
      + nonNegative(input.medicalFertility) * TAX.MEDICAL_FERTILITY_RATE
      + nonNegative(input.medicalPremature) * TAX.MEDICAL_PREMATURE_RATE;
    const preschoolHighApplied = Math.min(nonNegative(input.educationPreschoolHigh), Math.floor(nonNegative(input.educationPreschoolHighCount)) * TAX.EDUCATION_CAP_PRESCHOOL_TO_HIGH);
    const collegeApplied = Math.min(nonNegative(input.educationCollege), Math.floor(nonNegative(input.educationCollegeCount)) * TAX.EDUCATION_CAP_COLLEGE);
    const educationCredit = (nonNegative(input.education) + preschoolHighApplied + collegeApplied) * TAX.EDUCATION.CREDIT_RATE;
    const rentEligible = grossSalary <= TAX.RENT.ELIGIBLE_SALARY_LIMIT;
    const rentRate = grossSalary <= TAX.RENT.HIGH_RATE_SALARY_LIMIT ? TAX.RENT.HIGH_RATE : TAX.RENT.STANDARD_RATE;
    const rentCredit = rentEligible
      ? Math.min(nonNegative(input.rent), TAX.RENT.PAYMENT_CAP) * rentRate
      : ZERO;
    const donation = donationCredit(nonNegative(input.donation) + nonNegative(input.donationCarryforward));
    const totalTaxCredits = workTaxCredit + pension.credit + medicalCredit + educationCredit + rentCredit + donation;
    const appliedTaxCredits = Math.min(calculatedTax, totalTaxCredits);
    const decidedTax = Math.max(ZERO, calculatedTax - appliedTaxCredits);
    const settlement = withheldTax - decidedTax;
    const possibleIrpCredit = Math.min(pension.remaining * pension.rate, decidedTax);

    return {
      grossSalary,
      withheldTax,
      workDeduction,
      earnedIncome,
      personalDeduction,
      additionalPersonalDeduction,
      cardDeduction: card,
      taxableIncome,
      calculatedTax,
      workTaxCredit,
      pensionCredit: pension.credit,
      medicalCredit,
      educationCredit,
      rentCredit,
      donationCredit: donation,
      totalTaxCredits,
      appliedTaxCredits,
      decidedTax,
      settlement,
      irpAdditionalRoom: pension.remaining,
      irpAdditionalRefund: possibleIrpCredit,
    };
  }

  global.MoneyCalcCalculators = global.MoneyCalcCalculators || {};
  global.MoneyCalcCalculators.yearEndTax = Object.freeze({
    earnedIncomeDeduction,
    cardDeduction,
    incomeTax,
    earnedTaxCredit,
    pensionCredit,
    donationCredit,
    calculate: calculateYearEndTax,
  });

  function init() {
    const form = document.getElementById('tax-form');
    if (!form) return;

    const stepInput = document.getElementById('current-step');
    const steps = Array.from(form.querySelectorAll('[data-step]'));
    const progress = Array.from(form.querySelectorAll('.wizard-progress span'));
    const autoWithheld = document.getElementById('auto-withheld');
    const withheldInput = document.getElementById('withheld-tax');
    const withheldHint = document.getElementById('withheld-hint');
    const copyButton = document.getElementById('copy-tax-link');
    const hasQuery = [...MC.queryParams().keys()].length > ZERO;

    MC.setupNumericInputs(form);
    MC.restoreForm(form);

    function value(name) {
      const control = form.elements[name];
      return control ? MC.parseNumber(control.value) : ZERO;
    }

    function syncAutoWithheld() {
      withheldInput.readOnly = autoWithheld.checked;
      withheldInput.setAttribute('aria-readonly', autoWithheld.checked ? 'true' : 'false');
      if (autoWithheld.checked) {
        const familyCount = TAX.TAXPAYER_COUNT + Math.floor(value('dependents'));
        const withholding = global.MoneyCalcWithholding;
        const estimated = withholding
          ? withholding.estimateAnnualWithheldTax(value('grossSalary'), familyCount)
          : value('grossSalary') * TAX.WITHHELD_ESTIMATE_RATE;
        withheldInput.value = MC.formatNumber(Math.round(estimated), MATH.WON_ROUNDING_DIGITS);
        withheldHint.textContent = '국세청 근로소득 간이세액표(월급여·부양가족수 기준) 조회값 × 12로 추정한 값입니다.';
      } else {
        withheldHint.textContent = '급여명세서의 소득세 누계액을 입력하세요.';
      }
    }

    function readInput() {
      syncAutoWithheld();
      return {
        grossSalary: value('grossSalary'),
        withheldTax: value('withheldTax'),
        dependents: value('dependents'),
        creditCard: value('creditCard'),
        debitCash: value('debitCash'),
        traditionalMarket: value('traditionalMarket'),
        publicTransport: value('publicTransport'),
        culture: value('culture'),
        elderly70Count: value('elderly70Count'),
        disabledCount: value('disabledCount'),
        singleWomanHead: form.elements.singleWomanHead && form.elements.singleWomanHead.checked,
        singleParent: form.elements.singleParent && form.elements.singleParent.checked,
        medical: value('medical'),
        medicalDependent: value('medicalDependent'),
        medicalFertility: value('medicalFertility'),
        medicalPremature: value('medicalPremature'),
        education: value('education'),
        educationPreschoolHigh: value('educationPreschoolHigh'),
        educationPreschoolHighCount: value('educationPreschoolHighCount'),
        educationCollege: value('educationCollege'),
        educationCollegeCount: value('educationCollegeCount'),
        pensionSavings: value('pensionSavings'),
        irp: value('irp'),
        rent: value('rent'),
        donation: value('donation'),
        donationCarryforward: value('donationCarryforward'),
      };
    }

    function render(result) {
      const isRefund = result.settlement >= ZERO;
      const amount = Math.abs(Math.round(result.settlement));
      const resultLabel = document.getElementById('tax-result-label');
      const resultValue = document.getElementById('tax-result-value');
      resultLabel.textContent = isRefund ? '예상 환급액' : '예상 추가 납부액';
      resultValue.textContent = MC.formatWon(amount);
      resultValue.classList.toggle('positive', isRefund && amount > ZERO);
      resultValue.classList.toggle('negative', !isRefund);
      document.getElementById('tax-result-summary').textContent = isRefund
        ? '기납부세액이 간이 결정세액보다 많아 환급으로 예상됩니다.'
        : '간이 결정세액이 기납부세액보다 많아 추가 납부로 예상됩니다.';
      document.getElementById('calculated-tax').textContent = MC.formatWon(result.calculatedTax);
      document.getElementById('decided-tax').textContent = MC.formatWon(result.decidedTax);
      document.getElementById('paid-tax').textContent = MC.formatWon(result.withheldTax);

      const breakdown = [
        ['근로소득공제', result.workDeduction, '소득공제'],
        ['인적공제', result.personalDeduction, '소득공제'],
        ['카드 사용액 공제', result.cardDeduction, '소득공제'],
        ['근로소득 세액공제', result.workTaxCredit, '세액공제'],
        ['연금저축·IRP', result.pensionCredit, '세액공제'],
        ['의료비', result.medicalCredit, '세액공제'],
        ['교육비', result.educationCredit, '세액공제'],
        ['월세', result.rentCredit, '세액공제'],
        ['기부금', result.donationCredit, '세액공제'],
      ];
      document.getElementById('tax-breakdown').innerHTML = breakdown.map(([label, amountValue, type]) => (
        `<div class="breakdown-row"><dt>${label}<small class="microcopy"> · ${type}</small></dt><dd>${MC.formatWon(amountValue)}</dd></div>`
      )).join('');

      const room = Math.round(result.irpAdditionalRoom);
      const extraRefund = Math.round(result.irpAdditionalRefund);
      document.getElementById('irp-tip').textContent = room > ZERO
        ? `IRP에 ${MC.formatWon(room)} 더 넣으면 환급 효과가 최대 ${MC.formatWon(extraRefund)} 늘어날 수 있어요.`
        : '현재 입력 기준으로 연금계좌 세액공제 한도를 모두 사용했어요.';
    }

    function syncQuery() {
      const params = MC.formToParams(form);
      MC.setQuery(params);
      return params;
    }

    function recalculate() {
      const result = calculateYearEndTax(readInput());
      render(result);
      syncQuery();
      return result;
    }

    function showStep(nextStep, focusHeading) {
      const normalized = MC.clamp(Number.parseInt(nextStep, 10) || ONE, ONE, steps.length);
      stepInput.value = String(normalized);
      steps.forEach((section) => {
        const active = Number.parseInt(section.dataset.step, 10) === normalized;
        MC.setHidden(section, !active);
      });
      progress.forEach((bar, index) => {
        const position = index + ONE;
        bar.classList.toggle('active', position === normalized);
        bar.classList.toggle('done', position < normalized);
      });
      recalculate();
      if (focusHeading) {
        const heading = steps[normalized - ONE].querySelector('h2');
        if (heading) heading.focus({ preventScroll: true });
        global.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }

    form.addEventListener('input', (event) => {
      if (event.target === autoWithheld || event.target.name === 'grossSalary' || event.target.name === 'dependents') syncAutoWithheld();
      recalculate();
    });
    form.addEventListener('change', recalculate);
    form.querySelectorAll('[data-next]').forEach((button) => button.addEventListener('click', () => showStep(Number(stepInput.value) + ONE, true)));
    form.querySelectorAll('[data-prev]').forEach((button) => button.addEventListener('click', () => showStep(Number(stepInput.value) - ONE, true)));
    MC.bindCopyLink(copyButton, () => MC.makeUrl(MC.formToParams(form)));

    syncAutoWithheld();
    const restoredStep = hasQuery ? Number.parseInt(stepInput.value, 10) : ONE;
    showStep(restoredStep, false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
