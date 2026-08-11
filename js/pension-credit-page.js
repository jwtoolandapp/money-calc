(function () {
  'use strict';
  var form = document.getElementById('pension-credit-form');
  if (!form || !window.PensionCredit) return;

  var salaryInput = document.getElementById('pension-salary');
  var savingsInput = document.getElementById('pension-savings');
  var irpInput = document.getElementById('pension-irp');
  var valueNode = document.getElementById('pension-credit-value');
  var summaryNode = document.getElementById('pension-credit-summary');
  var detailsNode = document.getElementById('pension-credit-details');

  function won(value) { return Math.round(value).toLocaleString('ko-KR') + '원'; }
  function pct(rate) { return (Math.round(rate * 1000) / 10) + '%'; }

  function render() {
    var salary = Number(salaryInput.value);
    if (!Number.isFinite(salary) || salaryInput.value.trim() === '') {
      valueNode.textContent = '0원';
      summaryNode.textContent = '총급여와 납입액을 입력하세요.';
      detailsNode.innerHTML = '';
      return;
    }

    var result = window.PensionCredit.calculate({
      salary: salary,
      pensionSavings: Number(savingsInput.value) || 0,
      irp: Number(irpInput.value) || 0
    });
    if (!result) return;

    valueNode.textContent = won(result.totalCredit);
    summaryNode.textContent = '공제 대상 ' + won(result.eligibleTotal) +
      ' · 공제율 ' + pct(result.combinedRate) + ' (지방소득세 포함) 기준입니다.';

    var rows = [
      ['연금저축 공제 대상', won(result.eligibleSavings)],
      ['IRP 공제 대상', won(result.eligibleIrp)],
      ['공제 대상 합계', won(result.eligibleTotal)],
      ['소득세 기준 공제액', won(result.incomeTaxCredit) + ' (' + pct(result.incomeTaxRate) + ')'],
      ['남은 한도', won(result.roomLeft)]
    ];

    // 한도를 넘겨 넣은 돈은 공제를 못 받는다. 가장 알려주고 싶은 정보라 눈에 띄게 둔다.
    if (result.unusedSavings > 0) {
      rows.push(['연금저축 한도 초과분', won(result.unusedSavings) + ' (공제 안 됨)']);
    }
    if (result.unusedTotal > 0) {
      rows.push(['합산 한도 초과분', won(result.unusedTotal) + ' (공제 안 됨)']);
    }

    detailsNode.innerHTML = rows
      .map(function (row) { return '<div><dt>' + row[0] + '</dt><dd>' + row[1] + '</dd></div>'; })
      .join('');
  }

  function restore() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('s')) salaryInput.value = params.get('s');
    if (params.get('p')) savingsInput.value = params.get('p');
    if (params.get('i')) irpInput.value = params.get('i');
  }

  restore();
  render();
  form.addEventListener('input', render);

  var copyButton = document.getElementById('copy-pension-link');
  if (copyButton) {
    copyButton.addEventListener('click', function () {
      var params = new URLSearchParams();
      if (salaryInput.value.trim()) params.set('s', salaryInput.value.trim());
      if (savingsInput.value.trim()) params.set('p', savingsInput.value.trim());
      if (irpInput.value.trim()) params.set('i', irpInput.value.trim());
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
