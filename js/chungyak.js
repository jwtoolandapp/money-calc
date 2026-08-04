(function (global) {
  'use strict';

  const C = global.CALC_CONSTANTS_2026;
  const U = global.MoneyCalc;
  const SCORE = C && C.CHUNGYAK;

  function parseIsoDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return null;
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, monthIndex, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== monthIndex ||
      date.getUTCDate() !== day
    ) return null;
    return date;
  }

  function toIsoDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  }

  function addYears(date, years) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
    const targetYear = date.getUTCFullYear() + years;
    const monthIndex = date.getUTCMonth();
    const day = date.getUTCDate();
    const target = new Date(Date.UTC(targetYear, monthIndex, day));
    if (target.getUTCMonth() !== monthIndex) {
      return new Date(Date.UTC(targetYear, monthIndex + 1, 0));
    }
    return target;
  }

  function completedMonthsBetween(start, end) {
    if (!start || !end || end.getTime() < start.getTime()) return 0;
    let months = (end.getUTCFullYear() - start.getUTCFullYear()) * C.MATH.MONTHS_PER_YEAR;
    months += end.getUTCMonth() - start.getUTCMonth();
    if (end.getUTCDate() < start.getUTCDate()) months -= 1;
    return Math.max(C.MATH.ZERO, months);
  }

  function laterDate(first, second) {
    if (!first) return second;
    if (!second) return first;
    return first.getTime() >= second.getTime() ? first : second;
  }

  function asBoolean(value) {
    return value === true || value === '1' || value === 'yes' || value === 'true';
  }

  function calculateHomelessScore(input) {
    const values = input || {};
    const rules = SCORE.HOMELESS;
    const currentHomeowner = asBoolean(values.currentHomeowner) || values.currentHomeowner === 'yes';
    const birthDate = parseIsoDate(values.birthDate);
    const asOfDate = parseIsoDate(values.asOfDate);
    const isMarried = asBoolean(values.married) || values.married === 'yes';
    const marriageDate = isMarried ? parseIsoDate(values.marriageDate) : null;
    const hasOwnedBefore = asBoolean(values.everOwned) || values.everOwned === 'yes';
    const homelessSince = hasOwnedBefore ? parseIsoDate(values.homelessSince) : null;
    const errors = [];

    if (!birthDate) errors.push('생년월일을 확인해 주세요.');
    if (!asOfDate) errors.push('계산 기준일을 확인해 주세요.');
    if (birthDate && asOfDate && asOfDate < birthDate) errors.push('계산 기준일은 생년월일보다 빠를 수 없습니다.');
    if (isMarried && !marriageDate) errors.push('혼인신고일을 확인해 주세요.');
    if (marriageDate && birthDate && marriageDate < birthDate) errors.push('혼인신고일은 생년월일보다 빠를 수 없습니다.');
    if (marriageDate && asOfDate && marriageDate > asOfDate) errors.push('혼인신고일은 계산 기준일보다 늦을 수 없습니다.');
    if (!currentHomeowner && hasOwnedBefore && !homelessSince) errors.push('무주택이 된 날짜를 확인해 주세요.');
    if (homelessSince && birthDate && homelessSince < birthDate) errors.push('무주택이 된 날짜는 생년월일보다 빠를 수 없습니다.');
    if (homelessSince && asOfDate && homelessSince > asOfDate) errors.push('무주택이 된 날짜는 계산 기준일보다 늦을 수 없습니다.');

    if (errors.length) {
      return {
        points: C.MATH.ZERO,
        completedYears: C.MATH.ZERO,
        completedMonths: C.MATH.ZERO,
        startDate: '',
        reason: 'invalid',
        valid: false,
        errors,
      };
    }

    if (currentHomeowner) {
      return {
        points: rules.CURRENT_HOMEOWNER_POINTS,
        completedYears: C.MATH.ZERO,
        completedMonths: C.MATH.ZERO,
        startDate: '',
        reason: 'current-homeowner',
        valid: true,
        errors,
      };
    }

    const ageStartDate = addYears(birthDate, rules.START_AGE);
    const eligibilityStart = marriageDate && ageStartDate && marriageDate < ageStartDate
      ? marriageDate
      : ageStartDate;
    const scoreStart = hasOwnedBefore
      ? (homelessSince ? laterDate(eligibilityStart, homelessSince) : null)
      : eligibilityStart;
    const months = completedMonthsBetween(scoreStart, asOfDate);
    const completedYears = Math.min(
      rules.MAX_YEARS,
      Math.floor(months / C.MATH.MONTHS_PER_YEAR)
    );
    const points = Math.min(
      rules.MAX_POINTS,
      rules.BASE_POINTS + completedYears * rules.POINTS_PER_YEAR
    );

    return {
      points,
      completedYears,
      completedMonths: months,
      startDate: toIsoDate(scoreStart),
      reason: 'calculated',
      valid: true,
      errors,
    };
  }

  function calculateDependentScore(input) {
    const values = input || {};
    const rules = SCORE.DEPENDENTS;
    const spouseCount = asBoolean(values.spouse) ? C.MATH.ONE : C.MATH.ZERO;
    const ancestorCount = Math.max(C.MATH.ZERO, Math.floor(U.parseNumber(values.ancestorCount)));
    const childCount = Math.max(C.MATH.ZERO, Math.floor(U.parseNumber(values.childCount)));
    const enteredPeople = spouseCount + ancestorCount + childCount;
    const countedPeople = U.clamp(enteredPeople, C.MATH.ZERO, rules.MAX_PEOPLE);
    const points = Math.min(
      rules.MAX_POINTS,
      rules.BASE_POINTS + countedPeople * rules.POINTS_PER_PERSON
    );

    return { points, enteredPeople, countedPeople };
  }

  function calculateAccountScore(input) {
    const values = input || {};
    const rules = SCORE.ACCOUNT;
    const accountDate = parseIsoDate(values.accountDate);
    const asOfDate = parseIsoDate(values.accountAsOfDate || values.asOfDate);
    const errors = [];
    if (!accountDate) errors.push('청약통장 가입일을 확인해 주세요.');
    if (!asOfDate) errors.push('통장 계산 기준일을 확인해 주세요.');
    if (accountDate && asOfDate && accountDate > asOfDate) {
      errors.push('청약통장 가입일은 계산 기준일보다 늦을 수 없습니다.');
    }
    if (errors.length) {
      return {
        points: C.MATH.ZERO,
        completedMonths: C.MATH.ZERO,
        completedYears: C.MATH.ZERO,
        valid: false,
        errors,
      };
    }
    const months = completedMonthsBetween(accountDate, asOfDate);
    let points;

    if (months < rules.MONTHS_BEFORE_SECOND_BAND) {
      points = rules.UNDER_SIX_MONTHS_POINTS;
    } else {
      const completedYears = Math.floor(months / C.MATH.MONTHS_PER_YEAR);
      points = Math.min(rules.MAX_POINTS, rules.SIX_TO_TWELVE_MONTHS_POINTS + completedYears);
    }

    return {
      points,
      completedMonths: months,
      completedYears: Math.floor(months / C.MATH.MONTHS_PER_YEAR),
      valid: true,
      errors,
    };
  }

  function calculateScore(input) {
    const homeless = calculateHomelessScore(input);
    const dependents = calculateDependentScore(input);
    const account = calculateAccountScore(input);
    const errors = [...homeless.errors, ...account.errors];
    const valid = homeless.valid && account.valid;
    return {
      total: valid
        ? Math.min(SCORE.TOTAL_MAX_POINTS, homeless.points + dependents.points + account.points)
        : C.MATH.ZERO,
      homeless,
      dependents,
      account,
      valid,
      errors,
    };
  }

  global.MoneyCalcCalculators = global.MoneyCalcCalculators || {};
  global.MoneyCalcCalculators.chungyak = Object.freeze({
    calculateHomelessScore,
    calculateDependentScore,
    calculateAccountScore,
    calculateScore,
  });

  function init() {
    const form = document.getElementById('chungyak-form');
    if (!form || !C || !U || !SCORE) return;

    const params = U.queryParams();
    const relevantKeys = [
      'currentHomeowner', 'birthDate', 'asOfDate', 'married', 'marriageDate',
      'everOwned', 'homelessSince', 'spouse', 'ancestorCount', 'childCount',
      'accountDate', 'accountAsOfDate',
    ];
    const hasRestorableValues = relevantKeys.some((key) => params.has(key));
    U.restoreForm(form, params);

    const asOfInput = form.elements.asOfDate;
    const accountAsOfInput = form.elements.accountAsOfDate;
    if (!asOfInput.value) asOfInput.value = U.todayIso();
    if (!accountAsOfInput.value) accountAsOfInput.value = asOfInput.value;

    let currentStep = U.clamp(
      Number.parseInt(params.get('step') || (hasRestorableValues ? '4' : '1'), 10) || C.MATH.ONE,
      C.MATH.ONE,
      4
    );
    let latestUrl = global.location.href;

    const steps = Array.from(form.querySelectorAll('[data-step]'));
    const progress = Array.from(document.querySelectorAll('[data-progress]'));
    const stepLabel = document.getElementById('step-label');
    const marriageDateField = document.getElementById('marriage-date-field');
    const marriageDateInput = form.elements.marriageDate;
    const ownershipHistoryFields = document.getElementById('ownership-history-fields');
    const homelessSinceField = document.getElementById('homeless-since-field');
    const homelessSinceInput = form.elements.homelessSince;
    const homeownerMessage = document.getElementById('homeowner-message');
    const ancestorInput = form.elements.ancestorCount;
    const childInput = form.elements.childCount;

    function renderRuleConstants() {
      const text = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.textContent = String(value);
      };
      text('intro-total-max', SCORE.TOTAL_MAX_POINTS);
      text('homeless-start-age', SCORE.HOMELESS.START_AGE);
      text('marriage-start-age', SCORE.HOMELESS.START_AGE);
      text('ancestor-registry-years', SCORE.DEPENDENTS.ASCENDANT_REGISTRY_YEARS);
      text('child-max-age', SCORE.DEPENDENTS.CHILD_MAX_AGE_EXCLUSIVE);
      text('dependent-max-people', SCORE.DEPENDENTS.MAX_PEOPLE);
      text('dependent-base-points', SCORE.DEPENDENTS.BASE_POINTS);
      text('dependent-points-per-person', SCORE.DEPENDENTS.POINTS_PER_PERSON);
      text('total-max-score', SCORE.TOTAL_MAX_POINTS);
      text('homeless-max-score', SCORE.HOMELESS.MAX_POINTS);
      text('dependent-max-score', SCORE.DEPENDENTS.MAX_POINTS);
      text('account-max-score', SCORE.ACCOUNT.MAX_POINTS);
      ancestorInput.max = String(SCORE.DEPENDENTS.MAX_PEOPLE);
      childInput.max = String(SCORE.DEPENDENTS.MAX_PEOPLE);
    }

    function formValues() {
      const data = new FormData(form);
      return {
        currentHomeowner: data.get('currentHomeowner'),
        birthDate: data.get('birthDate'),
        asOfDate: data.get('asOfDate'),
        married: data.get('married'),
        marriageDate: data.get('marriageDate'),
        everOwned: data.get('everOwned'),
        homelessSince: data.get('homelessSince'),
        spouse: data.get('spouse') === '1',
        ancestorCount: data.get('ancestorCount'),
        childCount: data.get('childCount'),
        accountDate: data.get('accountDate'),
        accountAsOfDate: data.get('accountAsOfDate'),
      };
    }

    function syncConditionalFields() {
      const values = formValues();
      const married = values.married === 'yes';
      const homeowner = values.currentHomeowner === 'yes';
      const ownedBefore = values.everOwned === 'yes';

      U.setHidden(marriageDateField, !married);
      marriageDateInput.required = married;
      U.setHidden(ownershipHistoryFields, homeowner);
      U.setHidden(homelessSinceField, homeowner || !ownedBefore);
      homelessSinceInput.required = !homeowner && ownedBefore;
      U.setHidden(homeownerMessage, !homeowner);

      const birthDateInput = form.elements.birthDate;
      const accountDateInput = form.elements.accountDate;
      const dateInputs = [birthDateInput, asOfInput, marriageDateInput, homelessSinceInput, accountDateInput, accountAsOfInput];
      dateInputs.forEach((input) => input.setCustomValidity(''));
      const birthDate = birthDateInput.value;
      const asOfDate = asOfInput.value;
      const marriageDate = marriageDateInput.value;
      const homelessSince = homelessSinceInput.value;
      const accountDate = accountDateInput.value;
      const accountAsOfDate = accountAsOfInput.value;

      if (birthDate && asOfDate && asOfDate < birthDate) {
        asOfInput.setCustomValidity('계산 기준일은 생년월일보다 빠를 수 없습니다.');
      }
      if (married && marriageDate && birthDate && marriageDate < birthDate) {
        marriageDateInput.setCustomValidity('혼인신고일은 생년월일보다 빠를 수 없습니다.');
      } else if (married && marriageDate && asOfDate && marriageDate > asOfDate) {
        marriageDateInput.setCustomValidity('혼인신고일은 계산 기준일보다 늦을 수 없습니다.');
      }
      if (!homeowner && ownedBefore && homelessSince && birthDate && homelessSince < birthDate) {
        homelessSinceInput.setCustomValidity('무주택이 된 날짜는 생년월일보다 빠를 수 없습니다.');
      } else if (!homeowner && ownedBefore && homelessSince && asOfDate && homelessSince > asOfDate) {
        homelessSinceInput.setCustomValidity('무주택이 된 날짜는 계산 기준일보다 늦을 수 없습니다.');
      }
      if (accountDate && accountAsOfDate && accountDate > accountAsOfDate) {
        accountDateInput.setCustomValidity('청약통장 가입일은 계산 기준일보다 늦을 수 없습니다.');
      }
    }

    function updateUrl() {
      const nextParams = U.formToParams(form);
      nextParams.set('step', String(currentStep));
      latestUrl = U.setQuery(nextParams);
      return latestUrl;
    }

    function renderResult() {
      const result = calculateScore(formValues());
      document.getElementById('total-score').textContent = result.valid
        ? U.formatNumber(result.total, C.MATH.ZERO)
        : '입력 확인';
      document.getElementById('homeless-score').textContent = U.formatNumber(result.homeless.points, 0);
      document.getElementById('dependent-score').textContent = U.formatNumber(result.dependents.points, 0);
      document.getElementById('account-score').textContent = U.formatNumber(result.account.points, 0);

      const summary = !result.valid
        ? result.errors[0]
        : result.homeless.reason === 'current-homeowner'
        ? `현재 유주택으로 입력해 무주택기간은 ${SCORE.HOMELESS.CURRENT_HOMEOWNER_POINTS}점으로 처리했습니다.`
        : `무주택 ${result.homeless.completedYears}년, 부양가족 ${result.dependents.countedPeople}명, 통장 ${result.account.completedYears}년 기준입니다.`;
      document.getElementById('score-summary').textContent = summary;

      const detailParts = [];
      if (!result.valid) detailParts.push('날짜의 선후관계를 수정한 뒤 다시 확인해 주세요.');
      if (result.homeless.startDate) detailParts.push(`무주택 기산일 ${result.homeless.startDate}`);
      if (result.dependents.enteredPeople > result.dependents.countedPeople) {
        detailParts.push(`부양가족은 최대 ${SCORE.DEPENDENTS.MAX_PEOPLE}명까지 반영`);
      }
      detailParts.push('실제 신청 전 청약홈에서 자격과 점수를 확인하세요.');
      document.getElementById('result-detail').textContent = detailParts.join(' · ');
      return result;
    }

    function showStep(step, shouldUpdateUrl) {
      currentStep = U.clamp(step, C.MATH.ONE, steps.length);
      steps.forEach((section) => {
        U.setHidden(section, Number(section.dataset.step) !== currentStep);
      });
      progress.forEach((item) => {
        const itemStep = Number(item.dataset.progress);
        item.classList.toggle('active', itemStep === currentStep);
        item.classList.toggle('done', itemStep < currentStep);
      });
      stepLabel.textContent = `${currentStep} / ${steps.length}`;
      renderResult();
      if (shouldUpdateUrl !== false) updateUrl();
      const heading = steps[currentStep - C.MATH.ONE].querySelector('h3');
      if (heading && shouldUpdateUrl !== false) heading.focus({ preventScroll: true });
    }

    function validateStep(step) {
      const section = form.querySelector(`[data-step="${step}"]`);
      if (!section) return true;
      const required = Array.from(section.querySelectorAll('[required]')).filter((input) => !input.closest('[hidden]'));
      const invalid = required.find((input) => !input.checkValidity());
      if (invalid) {
        invalid.reportValidity();
        invalid.focus();
        return false;
      }
      return true;
    }

    form.addEventListener('input', (event) => {
      if (event.target === asOfInput && asOfInput.value) accountAsOfInput.value = asOfInput.value;
      syncConditionalFields();
      renderResult();
      updateUrl();
    });

    form.addEventListener('change', (event) => {
      if (event.target === asOfInput && asOfInput.value) accountAsOfInput.value = asOfInput.value;
      syncConditionalFields();
      renderResult();
      updateUrl();
    });

    form.addEventListener('click', (event) => {
      const next = event.target.closest('[data-next]');
      const back = event.target.closest('[data-back]');
      if (next) {
        if (!validateStep(currentStep)) return;
        showStep(currentStep + C.MATH.ONE);
      } else if (back) {
        showStep(currentStep - C.MATH.ONE);
      }
    });

    U.setupNumericInputs(form);
    renderRuleConstants();
    syncConditionalFields();
    renderResult();
    showStep(currentStep, false);
    latestUrl = updateUrl();
    U.bindCopyLink(document.getElementById('copy-result-link'), () => latestUrl || updateUrl());
  }

  document.addEventListener('DOMContentLoaded', init);
})(window);
