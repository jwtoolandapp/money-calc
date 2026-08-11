(function () {
  'use strict';
  var form = document.getElementById('prepayment-fee-form');
  if (!form || !window.PrepaymentFee) return;

  var amountInput = document.getElementById('prepay-amount');
  var rateInput = document.getElementById('prepay-rate');
  var periodInput = document.getElementById('prepay-period');
  var elapsedInput = document.getElementById('prepay-elapsed');
  var valueNode = document.getElementById('prepay-fee-value');
  var summaryNode = document.getElementById('prepay-fee-summary');
  var detailsNode = document.getElementById('prepay-fee-details');

  function won(value) { return Math.round(value).toLocaleString('ko-KR') + '원'; }
  function pct(value) { return (Math.round(value * 1000) / 1000) + '%'; }

  function render() {
    var result = window.PrepaymentFee.calculate({
      prepayAmount: Number(amountInput.value),
      feeRatePercent: Number(rateInput.value),
      feePeriodMonths: Number(periodInput.value) || window.PrepaymentFee.DEFAULT_PERIOD_MONTHS,
      elapsedMonths: Number(elapsedInput.value) || 0
    });

    if (!result) {
      valueNode.textContent = '0원';
      summaryNode.textContent = '상환 금액과 조건을 입력하세요.';
      detailsNode.innerHTML = '';
      return;
    }

    valueNode.textContent = won(result.fee);
    summaryNode.textContent = result.isExempt
      ? '부과기간이 지나 중도상환수수료가 면제되는 조건입니다.'
      : '잔여 부과기간 ' + result.remainingMonths + '개월 기준 예상 금액입니다.';

    var rows = [
      ['잔여 부과기간', result.remainingMonths + '개월'],
      ['실효 요율', pct(result.effectiveRatePercent)],
      // 잔여기간을 빼먹은 계산과 나란히 보여준다. 이 계산기가 존재하는 이유다.
      ['잔여기간 미반영 시', won(result.feeWithoutProration)]
    ];
    if (!result.isExempt) {
      rows.push(['면제까지', result.monthsUntilExempt + '개월 남음']);
    }

    detailsNode.innerHTML = rows
      .map(function (row) { return '<div><dt>' + row[0] + '</dt><dd>' + row[1] + '</dd></div>'; })
      .join('');
  }

  function restore() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('a')) amountInput.value = params.get('a');
    if (params.get('r')) rateInput.value = params.get('r');
    if (params.get('p')) periodInput.value = params.get('p');
    if (params.get('e')) elapsedInput.value = params.get('e');
  }

  if (periodInput.value.trim() === '') {
    periodInput.value = String(window.PrepaymentFee.DEFAULT_PERIOD_MONTHS);
  }
  restore();
  render();
  form.addEventListener('input', render);

  var copyButton = document.getElementById('copy-prepay-link');
  if (copyButton) {
    copyButton.addEventListener('click', function () {
      var params = new URLSearchParams();
      if (amountInput.value.trim()) params.set('a', amountInput.value.trim());
      if (rateInput.value.trim()) params.set('r', rateInput.value.trim());
      if (periodInput.value.trim()) params.set('p', periodInput.value.trim());
      if (elapsedInput.value.trim()) params.set('e', elapsedInput.value.trim());
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
