(function () {
  'use strict';
  var form = document.getElementById('annual-leave-form');
  if (!form || !window.AnnualLeavePay) return;

  var wageInput = document.getElementById('al-wage');
  var yearsInput = document.getElementById('al-years');
  var usedInput = document.getElementById('al-used');
  var monthsInput = document.getElementById('al-months');
  var monthlyHoursInput = document.getElementById('al-monthly-hours');
  var dailyHoursInput = document.getElementById('al-daily-hours');
  var conditionInputs = form.querySelectorAll('input[name="al-condition"]');
  var monthsField = document.getElementById('al-months-field');
  var monthsLabel = document.getElementById('al-months-label');
  var yearsField = document.getElementById('al-years-field');
  var valueNode = document.getElementById('al-value');
  var summaryNode = document.getElementById('al-summary');
  var detailsNode = document.getElementById('al-details');
  var errorNode = document.getElementById('al-input-error');

  function won(value) { return Math.round(value).toLocaleString('ko-KR') + '원'; }
  function currentCondition() {
    for (var i = 0; i < conditionInputs.length; i += 1) if (conditionInputs[i].checked) return conditionInputs[i].value;
    return 'overOneYear80OrMore';
  }
  function selectCondition(condition) {
    for (var i = 0; i < conditionInputs.length; i += 1) conditionInputs[i].checked = conditionInputs[i].value === condition;
  }

  function render() {
    var condition = currentCondition();
    var usesMonthlyAttendance = condition !== 'overOneYear80OrMore';
    monthsField.hidden = !usesMonthlyAttendance;
    yearsField.hidden = condition === 'underOneYear';
    monthsInput.max = condition === 'underOneYear' ? '11' : '12';
    monthsLabel.textContent = condition === 'underOneYear' ? '개근한 개월 수' : '직전 1년 중 개근한 개월 수';
    errorNode.hidden = true;

    if (wageInput.value.trim() === '') {
      valueNode.textContent = '0원'; summaryNode.textContent = '월 통상임금을 입력하세요.'; detailsNode.innerHTML = ''; return;
    }
    var result = window.AnnualLeavePay.calculate({
      monthlyOrdinaryWage: Number(wageInput.value), serviceYears: Number(yearsInput.value),
      usedDays: Number(usedInput.value || 0), employmentCondition: condition,
      monthsWorked: Number(monthsInput.value || 0), monthlyStandardHours: Number(monthlyHoursInput.value),
      dailyScheduledHours: Number(dailyHoursInput.value)
    });
    if (!result) {
      valueNode.textContent = '—'; summaryNode.textContent = '입력값을 확인해 주세요.'; detailsNode.innerHTML = ''; return;
    }
    valueNode.textContent = won(result.allowance);
    summaryNode.textContent = '발생 ' + result.grantedDays + '일 중 ' + result.remainingDays + '일이 남았습니다.' +
      (result.isAtMaxDays ? ' 근속이 더 늘어도 25일에서 멈춥니다.' : '');
    if (result.exceedsGrantedDays) {
      errorNode.hidden = false;
      errorNode.textContent = '사용 연차가 발생 연차보다 ' + result.excessUsedDays + '일 많습니다. 입력값을 확인해 주세요.';
    }
    var rows = [
      ['발생 연차', result.grantedDays + '일'], ['사용 연차', result.usedDays + '일'], ['미사용 연차', result.remainingDays + '일'],
      ['통상시급 (월 통상임금 ÷ ' + result.monthlyStandardHours + '시간)', won(result.hourlyOrdinaryWage)],
      ['1일 통상임금 (통상시급 × ' + result.dailyScheduledHours + '시간)', won(result.dailyOrdinaryWage)]
    ];
    if (result.remainingDays > 0) rows.push(['월급 ÷ 30 으로 계산하면', won(result.wrongWayAllowance) + ' (잘못된 계산)']);
    detailsNode.innerHTML = rows.map(function (row) { return '<div><dt>' + row[0] + '</dt><dd>' + row[1] + '</dd></div>'; }).join('');
  }

  function restore() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('w')) wageInput.value = params.get('w');
    if (params.get('y')) yearsInput.value = params.get('y');
    if (params.get('u')) usedInput.value = params.get('u');
    if (params.get('m')) monthsInput.value = params.get('m');
    if (params.get('sh')) monthlyHoursInput.value = params.get('sh');
    if (params.get('dh')) dailyHoursInput.value = params.get('dh');
    if (params.get('c')) selectCondition(params.get('c'));
    else if (params.get('m')) selectCondition('underOneYear');
  }

  restore(); render();
  form.addEventListener('input', render); form.addEventListener('change', render);
  var copyButton = document.getElementById('copy-al-link');
  if (copyButton) copyButton.addEventListener('click', function () {
    var params = new URLSearchParams();
    if (wageInput.value.trim()) params.set('w', wageInput.value.trim());
    params.set('c', currentCondition());
    if (yearsInput.value.trim()) params.set('y', yearsInput.value.trim());
    if (monthsInput.value.trim()) params.set('m', monthsInput.value.trim());
    if (usedInput.value.trim()) params.set('u', usedInput.value.trim());
    params.set('sh', monthlyHoursInput.value); params.set('dh', dailyHoursInput.value);
    var url = window.location.origin + window.location.pathname + '?' + params.toString();
    window.history.replaceState(null, '', url);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function () {
      copyButton.textContent = '복사했어요'; window.setTimeout(function () { copyButton.textContent = '결과 링크 복사'; }, 2000);
    });
  });
})();
