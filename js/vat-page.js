(function () {
  'use strict';
  var form = document.getElementById('vat-form');
  if (!form || !window.Vat) return;

  var amountInput = document.getElementById('vat-amount');
  var includedInput = document.getElementById('vat-included');
  var valueNode = document.getElementById('vat-value');
  var summaryNode = document.getElementById('vat-summary');
  var detailsNode = document.getElementById('vat-details');

  function won(value) { return Math.round(value).toLocaleString('ko-KR') + '원'; }

  function render() {
    if (amountInput.value.trim() === '') {
      valueNode.textContent = '0원';
      summaryNode.textContent = '금액을 입력하세요.';
      detailsNode.innerHTML = '';
      return;
    }

    var result = window.Vat.calculate({
      amount: Number(amountInput.value),
      includesVat: includedInput.checked
    });
    if (!result) return;

    valueNode.textContent = won(result.vat);
    summaryNode.textContent = result.includesVat
      ? '입력한 금액을 부가세 포함으로 보고 1.1로 나눠 계산했습니다.'
      : '입력한 금액을 공급가액으로 보고 10%를 더했습니다.';

    var rows = [
      ['공급가액 (부가세 별도)', won(result.supplyPrice)],
      ['부가세 (10%)', won(result.vat)],
      ['합계 (공급대가)', won(result.total)]
    ];
    if (result.wrongWayVat !== null) {
      // 포함 금액에 그냥 10%를 곱하는 실수. 두 값을 나란히 놓아야 차이가 보인다.
      rows.push(['포함 금액에 10%를 곱하면', won(result.wrongWayVat) + ' (잘못된 계산)']);
    }

    detailsNode.innerHTML = rows
      .map(function (row) { return '<div><dt>' + row[0] + '</dt><dd>' + row[1] + '</dd></div>'; })
      .join('');
  }

  function restore() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('a')) amountInput.value = params.get('a');
    if (params.get('i') === '1') includedInput.checked = true;
  }

  restore();
  render();
  form.addEventListener('input', render);
  form.addEventListener('change', render);

  var copyButton = document.getElementById('copy-vat-link');
  if (copyButton) {
    copyButton.addEventListener('click', function () {
      var params = new URLSearchParams();
      if (amountInput.value.trim()) params.set('a', amountInput.value.trim());
      if (includedInput.checked) params.set('i', '1');
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
