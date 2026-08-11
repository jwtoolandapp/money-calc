(function () {
  'use strict';
  var form = document.getElementById('income-tax-form');
  if (!form || !window.IncomeTax) return;

  var revenueInput = document.getElementById('it-revenue');
  var expensesInput = document.getElementById('it-expenses');
  var deductionsInput = document.getElementById('it-deductions');
  var prepaidInput = document.getElementById('it-prepaid');
  var valueNode = document.getElementById('it-value');
  var summaryNode = document.getElementById('it-summary');
  var detailsNode = document.getElementById('it-details');

  function won(value) { return Math.round(value).toLocaleString('ko-KR') + '원'; }
  function pct(rate) { return (Math.round(rate * 1000) / 10) + '%'; }

  function render() {
    if (revenueInput.value.trim() === '') {
      valueNode.textContent = '0원';
      summaryNode.textContent = '수입과 경비를 입력하세요.';
      detailsNode.innerHTML = '';
      return;
    }

    var result = window.IncomeTax.calculate({
      revenue: Number(revenueInput.value),
      expenses: Number(expensesInput.value) || 0,
      deductions: Number(deductionsInput.value) || 0,
      prepaidTax: Number(prepaidInput.value) || 0
    });
    if (!result) return;

    valueNode.textContent = won(result.totalTax);
    // 최고세율과 실효세율을 함께 말해준다. 둘을 혼동하는 것이 이 주제의 핵심 오해다.
    summaryNode.textContent = '최고세율 ' + pct(result.marginalRate) +
      ' 구간 · 실효세율 ' + pct(result.effectiveRate) + '입니다.';

    var rows = [
      ['소득금액 (수입 − 경비)', won(result.income)],
      ['과세표준 (− 소득공제)', won(result.taxBase)],
      ['종합소득세', won(result.incomeTax)],
      ['지방소득세 (10%)', won(result.localTax)],
      ['누진공제액', won(result.quickDeduction)]
    ];

    if (result.isRefund) {
      rows.push(['환급 예상액', won(Math.abs(result.balance))]);
    } else {
      rows.push(['추가 납부액', won(result.balance)]);
    }
    if (result.taxBase > 0) {
      rows.push(['누진공제 빼먹으면', won(result.taxWithoutQuickDeduction) + ' (잘못된 계산)']);
    }

    detailsNode.innerHTML = rows
      .map(function (row) { return '<div><dt>' + row[0] + '</dt><dd>' + row[1] + '</dd></div>'; })
      .join('');
  }

  function restore() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('r')) revenueInput.value = params.get('r');
    if (params.get('e')) expensesInput.value = params.get('e');
    if (params.get('d')) deductionsInput.value = params.get('d');
    if (params.get('p')) prepaidInput.value = params.get('p');
  }

  restore();
  render();
  form.addEventListener('input', render);

  var copyButton = document.getElementById('copy-it-link');
  if (copyButton) {
    copyButton.addEventListener('click', function () {
      var params = new URLSearchParams();
      if (revenueInput.value.trim()) params.set('r', revenueInput.value.trim());
      if (expensesInput.value.trim()) params.set('e', expensesInput.value.trim());
      if (deductionsInput.value.trim()) params.set('d', deductionsInput.value.trim());
      if (prepaidInput.value.trim()) params.set('p', prepaidInput.value.trim());
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
