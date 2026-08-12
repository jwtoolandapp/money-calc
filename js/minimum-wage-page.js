(function () {
  'use strict';
  var form = document.getElementById('minimum-wage-form');
  if (!form || !window.MinimumWage) return;

  var amountInput = document.getElementById('mw-amount');
  var modeInputs = form.querySelectorAll('input[name="mw-mode"]');
  var amountLabel = document.getElementById('mw-amount-label');
  var amountUnit = document.getElementById('mw-amount-unit');
  var valueNode = document.getElementById('mw-value');
  var summaryNode = document.getElementById('mw-summary');
  var detailsNode = document.getElementById('mw-details');

  function won(value) { return Math.round(value).toLocaleString('ko-KR') + '원'; }

  function currentMode() {
    for (var i = 0; i < modeInputs.length; i += 1) {
      if (modeInputs[i].checked) return modeInputs[i].value;
    }
    return 'hourly';
  }

  function render() {
    var mode = currentMode();
    amountLabel.textContent = mode === 'monthly' ? '월급 (세전)' : '시급';
    amountUnit.textContent = '원';

    if (amountInput.value.trim() === '') {
      valueNode.textContent = '—';
      summaryNode.textContent = mode === 'monthly' ? '세전 월급을 입력하세요.' : '시급을 입력하세요.';
      detailsNode.innerHTML = '';
      return;
    }

    var result = window.MinimumWage.calculate({ mode: mode, amount: Number(amountInput.value) });
    if (!result) return;

    valueNode.textContent = result.meetsMinimum ? '최저임금 충족' : '최저임금 미달';
    summaryNode.textContent = result.meetsMinimum
      ? result.year + '년 최저시급 ' + won(result.minimumHourly) + ' 이상입니다.'
      : '시간당 ' + won(result.shortfallHourly) + ', 월 ' + won(result.shortfallMonthly) + ' 부족합니다.';

    var rows = [
      [result.year + '년 최저시급', won(result.minimumHourly)],
      ['최저임금 월 환산액 (209시간)', won(result.minimumMonthly)],
      ['입력 기준 시급', won(result.hourlyWage)],
      ['입력 기준 월급', won(result.monthlyWage)]
    ];
    if (result.hourlyByActualHours !== null) {
      // 174시간으로 나누면 시급이 높게 나와 위반을 놓친다. 나란히 보여준다.
      rows.push([
        '174시간으로 나누면',
        won(result.hourlyByActualHours) + ' (주휴시간 누락)'
      ]);
    }

    detailsNode.innerHTML = rows
      .map(function (row) { return '<div><dt>' + row[0] + '</dt><dd>' + row[1] + '</dd></div>'; })
      .join('');
  }

  function restore() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('a')) amountInput.value = params.get('a');
    if (params.get('m') === 'monthly') {
      for (var i = 0; i < modeInputs.length; i += 1) {
        if (modeInputs[i].value === 'monthly') modeInputs[i].checked = true;
      }
    }
  }

  restore();
  render();
  form.addEventListener('input', render);
  form.addEventListener('change', render);

  var copyButton = document.getElementById('copy-mw-link');
  if (copyButton) {
    copyButton.addEventListener('click', function () {
      var params = new URLSearchParams();
      if (amountInput.value.trim()) params.set('a', amountInput.value.trim());
      params.set('m', currentMode());
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
