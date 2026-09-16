(function () {
  'use strict';
  var form = document.getElementById('overtime-form');
  if (!form || !window.OvertimePay) return;
  var wageInput = document.getElementById('ot-wage');
  var monthlyHoursInput = document.getElementById('ot-monthly-hours');
  var weekdayOvertimeInput = document.getElementById('ot-weekday-overtime');
  var weekdayNightInput = document.getElementById('ot-weekday-night');
  var holidayInput = document.getElementById('ot-holiday');
  var holidayNightInput = document.getElementById('ot-holiday-night');
  var smallInput = document.getElementById('ot-small');
  var valueNode = document.getElementById('ot-value');
  var summaryNode = document.getElementById('ot-summary');
  var detailsNode = document.getElementById('ot-details');
  var errorNode = document.getElementById('ot-input-error');
  function won(value) { return Math.round(value).toLocaleString('ko-KR') + '원'; }
  function render() {
    errorNode.hidden = true; weekdayNightInput.removeAttribute('aria-invalid'); holidayNightInput.removeAttribute('aria-invalid');
    if (wageInput.value.trim() === '') { valueNode.textContent = '0원'; summaryNode.textContent = '월 통상임금과 근로시간을 입력하세요.'; detailsNode.innerHTML = ''; return; }
    var result = window.OvertimePay.calculate({ monthlyOrdinaryWage: Number(wageInput.value), monthlyStandardHours: Number(monthlyHoursInput.value),
      weekdayOvertimeHours: Number(weekdayOvertimeInput.value || 0), weekdayNightHours: Number(weekdayNightInput.value || 0),
      holidayHours: Number(holidayInput.value || 0), holidayNightHours: Number(holidayNightInput.value || 0), isSmallWorkplace: smallInput.checked });
    if (!result) { valueNode.textContent = '—'; summaryNode.textContent = '입력값을 확인해 주세요.'; detailsNode.innerHTML = ''; return; }
    if (!result.valid) {
      valueNode.textContent = '—'; summaryNode.textContent = '근로시간 입력을 확인해 주세요.'; detailsNode.innerHTML = '';
      errorNode.hidden = false; errorNode.textContent = result.errors.join(' ');
      if (Number(weekdayNightInput.value) > Number(weekdayOvertimeInput.value)) weekdayNightInput.setAttribute('aria-invalid', 'true');
      if (Number(holidayNightInput.value) > Number(holidayInput.value)) holidayNightInput.setAttribute('aria-invalid', 'true');
      return;
    }
    valueNode.textContent = won(result.total);
    summaryNode.textContent = result.isSmallWorkplace ? '상시 5명 미만 사업장은 가산 없이 실제 근로시간의 통상임금만 계산합니다.' : '통상시급 ' + won(result.hourlyOrdinaryWage) + ' 기준입니다.';
    var rows = [['통상시급 (월 통상임금 ÷ ' + result.monthlyStandardHours + '시간)', won(result.hourlyOrdinaryWage)],
      ['평일 연장근로 수당', won(result.overtimePay)], ['평일 야간 추가 가산', won(result.weekdayNightPay)],
      ['휴일근로 수당', won(result.holidayPay)], ['휴일 야간 추가 가산', won(result.holidayNightPay)]];
    if (result.holidayOverHours > 0) rows.push(['휴일 8시간 초과', result.holidayOverHours + '시간 (2배 적용)']);
    detailsNode.innerHTML = rows.map(function (row) { return '<div><dt>' + row[0] + '</dt><dd>' + row[1] + '</dd></div>'; }).join('');
  }
  function restore() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('w')) wageInput.value = params.get('w'); if (params.get('mh')) monthlyHoursInput.value = params.get('mh');
    if (params.get('wo')) weekdayOvertimeInput.value = params.get('wo'); else if (params.get('o')) weekdayOvertimeInput.value = params.get('o');
    if (params.get('wn')) weekdayNightInput.value = params.get('wn'); else if (params.get('n')) weekdayNightInput.value = params.get('n');
    if (params.get('hh')) holidayInput.value = params.get('hh'); else if (params.get('h')) holidayInput.value = params.get('h');
    if (params.get('hn')) holidayNightInput.value = params.get('hn'); if (params.get('s') === '1') smallInput.checked = true;
  }
  restore(); render(); form.addEventListener('input', render); form.addEventListener('change', render);
  var copyButton = document.getElementById('copy-ot-link');
  if (copyButton) copyButton.addEventListener('click', function () {
    var params = new URLSearchParams(); if (wageInput.value.trim()) params.set('w', wageInput.value.trim()); params.set('mh', monthlyHoursInput.value);
    if (weekdayOvertimeInput.value.trim()) params.set('wo', weekdayOvertimeInput.value.trim()); if (weekdayNightInput.value.trim()) params.set('wn', weekdayNightInput.value.trim());
    if (holidayInput.value.trim()) params.set('hh', holidayInput.value.trim()); if (holidayNightInput.value.trim()) params.set('hn', holidayNightInput.value.trim()); if (smallInput.checked) params.set('s', '1');
    var url = window.location.origin + window.location.pathname + '?' + params.toString(); window.history.replaceState(null, '', url);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function () { copyButton.textContent = '복사했어요'; window.setTimeout(function () { copyButton.textContent = '결과 링크 복사'; }, 2000); });
  });
})();
