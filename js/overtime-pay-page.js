(function () {
  'use strict';
  var form = document.getElementById('overtime-form');
  if (!form || !window.OvertimePay) return;

  var wageInput = document.getElementById('ot-wage');
  var overtimeInput = document.getElementById('ot-overtime');
  var nightInput = document.getElementById('ot-night');
  var holidayInput = document.getElementById('ot-holiday');
  var smallInput = document.getElementById('ot-small');
  var valueNode = document.getElementById('ot-value');
  var summaryNode = document.getElementById('ot-summary');
  var detailsNode = document.getElementById('ot-details');

  function won(value) { return Math.round(value).toLocaleString('ko-KR') + '원'; }

  function render() {
    if (wageInput.value.trim() === '') {
      valueNode.textContent = '0원';
      summaryNode.textContent = '월 통상임금과 근로시간을 입력하세요.';
      detailsNode.innerHTML = '';
      return;
    }

    var result = window.OvertimePay.calculate({
      monthlyOrdinaryWage: Number(wageInput.value),
      overtimeHours: Number(overtimeInput.value) || 0,
      nightHours: Number(nightInput.value) || 0,
      holidayHours: Number(holidayInput.value) || 0,
      isSmallWorkplace: smallInput.checked
    });
    if (!result) return;

    valueNode.textContent = won(result.total);
    summaryNode.textContent = result.isSmallWorkplace
      ? '상시 5명 미만 사업장은 가산 규정이 적용되지 않아 통상임금만 지급됩니다.'
      : '통상시급 ' + won(result.hourlyOrdinaryWage) + ' 기준입니다.';

    var rows = [
      ['통상시급 (월 통상임금 ÷ 209)', won(result.hourlyOrdinaryWage)],
      ['연장근로 수당', won(result.overtimePay)],
      ['야간근로 가산', won(result.nightPay)],
      ['휴일근로 수당', won(result.holidayPay)]
    ];
    if (result.holidayOverHours > 0) {
      rows.push([
        '휴일 8시간 초과',
        result.holidayOverHours + '시간 (2배 적용)'
      ]);
      rows.push([
        '전부 1.5배로 계산하면',
        won(result.wrongWayHolidayPay) + ' (잘못된 계산)'
      ]);
    }
    if (result.nightPay > 0) {
      rows.push(['야간 가산을 빼먹으면', won(result.totalWithoutNightPremium) + ' (잘못된 계산)']);
    }

    detailsNode.innerHTML = rows
      .map(function (row) { return '<div><dt>' + row[0] + '</dt><dd>' + row[1] + '</dd></div>'; })
      .join('');
  }

  function restore() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('w')) wageInput.value = params.get('w');
    if (params.get('o')) overtimeInput.value = params.get('o');
    if (params.get('n')) nightInput.value = params.get('n');
    if (params.get('h')) holidayInput.value = params.get('h');
    if (params.get('s') === '1') smallInput.checked = true;
  }

  restore();
  render();
  form.addEventListener('input', render);
  form.addEventListener('change', render);

  var copyButton = document.getElementById('copy-ot-link');
  if (copyButton) {
    copyButton.addEventListener('click', function () {
      var params = new URLSearchParams();
      if (wageInput.value.trim()) params.set('w', wageInput.value.trim());
      if (overtimeInput.value.trim()) params.set('o', overtimeInput.value.trim());
      if (nightInput.value.trim()) params.set('n', nightInput.value.trim());
      if (holidayInput.value.trim()) params.set('h', holidayInput.value.trim());
      if (smallInput.checked) params.set('s', '1');
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
