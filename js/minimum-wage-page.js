(function () {
  'use strict';
  var form = document.getElementById('minimum-wage-form');
  if (!form || !window.MinimumWage) return;
  var amountInput = document.getElementById('mw-amount');
  var scheduledInput = document.getElementById('mw-weekly-scheduled');
  var paidInput = document.getElementById('mw-weekly-paid');
  var hoursFields = document.getElementById('mw-hours-fields');
  var modeInputs = form.querySelectorAll('input[name="mw-mode"]');
  var amountLabel = document.getElementById('mw-amount-label');
  var valueNode = document.getElementById('mw-value');
  var summaryNode = document.getElementById('mw-summary');
  var detailsNode = document.getElementById('mw-details');
  function won(value) { return Math.round(value).toLocaleString('ko-KR') + '원'; }
  function currentMode() { for (var i = 0; i < modeInputs.length; i += 1) if (modeInputs[i].checked) return modeInputs[i].value; return 'hourly'; }
  function render() {
    var mode = currentMode(), monthly = mode === 'monthly';
    amountLabel.textContent = monthly ? '최저임금 산입 대상 월 임금' : '시급';
    amountInput.placeholder = monthly ? '2156880' : '10320';
    amountInput.step = monthly ? '1000' : '1';
    hoursFields.hidden = !monthly;
    if (amountInput.value.trim() === '') {
      valueNode.textContent = '—'; summaryNode.textContent = monthly ? '산입 대상 월 임금을 입력하세요.' : '시급을 입력하세요.'; detailsNode.innerHTML = ''; return;
    }
    var result = window.MinimumWage.calculate({ mode: mode, amount: Number(amountInput.value), weeklyScheduledHours: Number(scheduledInput.value), weeklyPaidHours: Number(paidInput.value) });
    if (!result) { valueNode.textContent = '—'; summaryNode.textContent = '입력값을 확인해 주세요.'; detailsNode.innerHTML = ''; return; }
    valueNode.textContent = result.meetsMinimum ? '최저임금 충족' : '최저임금 미달';
    summaryNode.textContent = result.meetsMinimum ? result.year + '년 최저시급 ' + won(result.minimumHourly) + ' 이상입니다.' :
      '시간당 ' + won(result.shortfallHourly) + ', 월 ' + won(result.shortfallMonthly) + ' 부족합니다.';
    var rows = [[result.year + '년 최저시급', won(result.minimumHourly)], ['월 환산 기준시간', result.standardHours + '시간'],
      ['해당 조건 월 최저임금', won(result.minimumMonthly)], ['입력 기준 시급', won(result.hourlyWage)], ['입력 기준 월 임금', won(result.monthlyWage)]];
    detailsNode.innerHTML = rows.map(function (row) { return '<div><dt>' + row[0] + '</dt><dd>' + row[1] + '</dd></div>'; }).join('');
  }
  function restore() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('a')) amountInput.value = params.get('a');
    if (params.get('wh')) scheduledInput.value = params.get('wh');
    if (params.get('ph')) paidInput.value = params.get('ph');
    if (params.get('m')) for (var i = 0; i < modeInputs.length; i += 1) modeInputs[i].checked = modeInputs[i].value === params.get('m');
  }
  restore(); render(); form.addEventListener('input', render); form.addEventListener('change', render);
  var copyButton = document.getElementById('copy-mw-link');
  if (copyButton) copyButton.addEventListener('click', function () {
    var params = new URLSearchParams(); if (amountInput.value.trim()) params.set('a', amountInput.value.trim());
    params.set('m', currentMode()); params.set('wh', scheduledInput.value); params.set('ph', paidInput.value);
    var url = window.location.origin + window.location.pathname + '?' + params.toString(); window.history.replaceState(null, '', url);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function () { copyButton.textContent = '복사했어요'; window.setTimeout(function () { copyButton.textContent = '결과 링크 복사'; }, 2000); });
  });
})();
