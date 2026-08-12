(function () {
  'use strict';
  var form = document.getElementById('annual-leave-form');
  if (!form || !window.AnnualLeavePay) return;

  var wageInput = document.getElementById('al-wage');
  var yearsInput = document.getElementById('al-years');
  var usedInput = document.getElementById('al-used');
  var underInput = document.getElementById('al-under-one-year');
  var monthsInput = document.getElementById('al-months');
  var monthsField = document.getElementById('al-months-field');
  var yearsField = document.getElementById('al-years-field');
  var valueNode = document.getElementById('al-value');
  var summaryNode = document.getElementById('al-summary');
  var detailsNode = document.getElementById('al-details');

  function won(value) { return Math.round(value).toLocaleString('ko-KR') + '원'; }

  function render() {
    var underOneYear = underInput.checked;
    // 1년 미만이면 근속연수 대신 개근 개월 수를 묻는다. 두 규정은 별개다.
    monthsField.hidden = !underOneYear;
    yearsField.hidden = underOneYear;

    if (wageInput.value.trim() === '') {
      valueNode.textContent = '0원';
      summaryNode.textContent = '월 통상임금을 입력하세요.';
      detailsNode.innerHTML = '';
      return;
    }

    var result = window.AnnualLeavePay.calculate({
      monthlyOrdinaryWage: Number(wageInput.value),
      serviceYears: Number(yearsInput.value) || 0,
      usedDays: Number(usedInput.value) || 0,
      underOneYear: underOneYear,
      monthsWorked: Number(monthsInput.value) || 0
    });
    if (!result) return;

    valueNode.textContent = won(result.allowance);
    summaryNode.textContent = '발생 ' + result.grantedDays + '일 중 ' +
      result.remainingDays + '일이 남았습니다.' +
      (result.isAtMaxDays ? ' 근속이 더 늘어도 25일에서 멈춥니다.' : '');

    var rows = [
      ['발생 연차', result.grantedDays + '일'],
      ['사용 연차', result.usedDays + '일'],
      ['미사용 연차', result.remainingDays + '일'],
      ['통상시급 (월 통상임금 ÷ 209)', won(result.hourlyOrdinaryWage)],
      ['1일 통상임금 (통상시급 × 8시간)', won(result.dailyOrdinaryWage)]
    ];
    if (result.remainingDays > 0) {
      rows.push(['월급 ÷ 30 으로 계산하면', won(result.wrongWayAllowance) + ' (잘못된 계산)']);
    }

    detailsNode.innerHTML = rows
      .map(function (row) { return '<div><dt>' + row[0] + '</dt><dd>' + row[1] + '</dd></div>'; })
      .join('');
  }

  function restore() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('w')) wageInput.value = params.get('w');
    if (params.get('y')) yearsInput.value = params.get('y');
    if (params.get('u')) usedInput.value = params.get('u');
    if (params.get('m')) { monthsInput.value = params.get('m'); underInput.checked = true; }
  }

  restore();
  render();
  form.addEventListener('input', render);
  form.addEventListener('change', render);

  var copyButton = document.getElementById('copy-al-link');
  if (copyButton) {
    copyButton.addEventListener('click', function () {
      var params = new URLSearchParams();
      if (wageInput.value.trim()) params.set('w', wageInput.value.trim());
      if (underInput.checked) {
        if (monthsInput.value.trim()) params.set('m', monthsInput.value.trim());
      } else if (yearsInput.value.trim()) {
        params.set('y', yearsInput.value.trim());
      }
      if (usedInput.value.trim()) params.set('u', usedInput.value.trim());
      var url = window.location.origin + window.location.pathname + '?' + params.toString();
      window.history.replaceState(null, '', url);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () {
          copyButton.textContent = '복사했어요';
          window.setTimeout(function () { copyButton.textContent = '결과 링크 복사'; }, 2000);
        });
      }
    });
  }
})();
