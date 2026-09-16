(function () {
  'use strict';
  var form = document.getElementById('percent-form');
  if (!form || !window.PercentCalc) return;

  var modeInputs = document.querySelectorAll('input[name="pct-mode"]');
  var baseInput = document.getElementById('pct-base');
  var rateInput = document.getElementById('pct-rate');
  var partInput = document.getElementById('pct-part');
  var wholeInput = document.getElementById('pct-whole');
  var fromInput = document.getElementById('pct-from');
  var toInput = document.getElementById('pct-to');
  var fieldPart = document.getElementById('field-part');
  var fieldRatio = document.getElementById('field-ratio');
  var fieldChange = document.getElementById('field-change');
  var valueNode = document.getElementById('pct-value');
  var summaryNode = document.getElementById('pct-summary');
  var detailsNode = document.getElementById('pct-details');

  function num(v) { return Math.round(v).toLocaleString('ko-KR'); }
  function pct(v) { return (Math.round(v * 100) / 100).toLocaleString('ko-KR') + '%'; }

  function mode() {
    var checked = document.querySelector('input[name="pct-mode"]:checked');
    return checked ? checked.value : 'part';
  }

  function syncFields() {
    var m = mode();
    fieldPart.hidden = m !== 'part';
    fieldRatio.hidden = m !== 'ratio';
    fieldChange.hidden = m !== 'change';
  }

  function render() {
    var m = mode();
    var result = null;
    var rows = [];

    if (m === 'part') {
      result = window.PercentCalc.calculate({ mode: 'part', base: baseInput.value, rate: rateInput.value });
      if (!result) { valueNode.textContent = '-'; summaryNode.textContent = '기준값과 비율을 입력하세요.'; detailsNode.innerHTML = ''; return; }
      valueNode.textContent = num(result.part);
      summaryNode.textContent = num(result.base) + '의 ' + pct(result.rate) + '는 ' + num(result.part) + '입니다.';
      rows = [
        ['기준값', num(result.base)],
        ['비율', pct(result.rate)],
        ['N%에 해당하는 값', num(result.part)],
        ['기준값에서 뺀 나머지 (할인 적용가)', num(result.remainder)]
      ];
    } else if (m === 'ratio') {
      result = window.PercentCalc.calculate({ mode: 'ratio', part: partInput.value, whole: wholeInput.value });
      if (!result) { valueNode.textContent = '-'; summaryNode.textContent = '부분과 전체 값을 입력하세요.'; detailsNode.innerHTML = ''; return; }
      valueNode.textContent = pct(result.rate);
      summaryNode.textContent = num(result.part) + '은(는) ' + num(result.whole) + '의 ' + pct(result.rate) + '입니다.';
      rows = [
        ['부분 값', num(result.part)],
        ['전체 값', num(result.whole)],
        ['비율', pct(result.rate)]
      ];
    } else {
      result = window.PercentCalc.calculate({ mode: 'change', from: fromInput.value, to: toInput.value });
      if (!result) { valueNode.textContent = '-'; summaryNode.textContent = '변화 전과 후의 값을 입력하세요.'; detailsNode.innerHTML = ''; return; }
      valueNode.textContent = (result.increased ? '+' : '') + pct(result.rate);
      summaryNode.textContent = num(result.from) + '에서 ' + num(result.to) + '(으)로 ' + (result.increased ? '증가' : '감소') + '했습니다.';
      rows = [
        ['변화 전', num(result.from)],
        ['변화 후', num(result.to)],
        ['차이', num(result.diff)],
        ['증감률', (result.increased ? '+' : '') + pct(result.rate)]
      ];
    }

    detailsNode.innerHTML = rows
      .map(function (row) { return '<div><dt>' + row[0] + '</dt><dd>' + row[1] + '</dd></div>'; })
      .join('');
  }

  function restore() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('m')) {
      var target = document.querySelector('input[name="pct-mode"][value="' + params.get('m') + '"]');
      if (target) target.checked = true;
    }
    if (params.get('b')) baseInput.value = params.get('b');
    if (params.get('r')) rateInput.value = params.get('r');
    if (params.get('p')) partInput.value = params.get('p');
    if (params.get('w')) wholeInput.value = params.get('w');
    if (params.get('f')) fromInput.value = params.get('f');
    if (params.get('t')) toInput.value = params.get('t');
  }

  restore();
  syncFields();
  render();
  form.addEventListener('input', render);
  form.addEventListener('change', function () { syncFields(); render(); });

  var copyButton = document.getElementById('copy-pct-link');
  if (copyButton) {
    copyButton.addEventListener('click', function () {
      var params = new URLSearchParams();
      var m = mode();
      params.set('m', m);
      if (m === 'part') { if (baseInput.value) params.set('b', baseInput.value); if (rateInput.value) params.set('r', rateInput.value); }
      if (m === 'ratio') { if (partInput.value) params.set('p', partInput.value); if (wholeInput.value) params.set('w', wholeInput.value); }
      if (m === 'change') { if (fromInput.value) params.set('f', fromInput.value); if (toInput.value) params.set('t', toInput.value); }
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
