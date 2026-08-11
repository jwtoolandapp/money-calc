(function () {
  'use strict';
  var form = document.getElementById('foreign-stock-tax-form');
  if (!form || !window.ForeignStockTax) return;

  var gainsInput = document.getElementById('fst-gains');
  var lossesInput = document.getElementById('fst-losses');
  var feesInput = document.getElementById('fst-fees');
  var valueNode = document.getElementById('fst-value');
  var summaryNode = document.getElementById('fst-summary');
  var detailsNode = document.getElementById('fst-details');

  function won(value) { return Math.round(value).toLocaleString('ko-KR') + '원'; }

  function render() {
    if (gainsInput.value.trim() === '') {
      valueNode.textContent = '0원';
      summaryNode.textContent = '이익과 손실을 입력하세요.';
      detailsNode.innerHTML = '';
      return;
    }

    var result = window.ForeignStockTax.calculate({
      gains: Number(gainsInput.value),
      losses: Number(lossesInput.value) || 0,
      fees: Number(feesInput.value) || 0
    });
    if (!result) return;

    valueNode.textContent = won(result.totalTax);
    if (result.netGain <= 0) {
      summaryNode.textContent = '손익 통산 결과 순이익이 없어 낼 세금이 없습니다.';
    } else if (result.isBelowDeduction) {
      summaryNode.textContent = '순이익이 기본공제 ' + won(result.deduction) +
        ' 이하라 낼 세금이 없습니다. 공제 여유 ' + won(result.roomLeft) + '.';
    } else {
      summaryNode.textContent = '순이익 ' + won(result.netGain) + '에서 기본공제를 뺀 ' +
        won(result.taxBase) + '에 22%가 적용됩니다.';
    }

    var rows = [
      ['손익 통산 순이익', won(result.netGain)],
      ['기본공제', won(result.deduction)],
      ['과세표준', won(result.taxBase)],
      ['양도소득세 (20%)', won(result.incomeTax)],
      ['지방소득세 (2%)', won(result.localTax)]
    ];
    // 세액에서 공제를 빼는 흔한 오류와 나란히 보여준다.
    if (result.taxBase > 0) {
      rows.push(['세액에서 공제 빼면', won(result.wrongWayTax) + ' (잘못된 계산)']);
    }

    detailsNode.innerHTML = rows
      .map(function (row) { return '<div><dt>' + row[0] + '</dt><dd>' + row[1] + '</dd></div>'; })
      .join('');
  }

  function restore() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('g')) gainsInput.value = params.get('g');
    if (params.get('l')) lossesInput.value = params.get('l');
    if (params.get('f')) feesInput.value = params.get('f');
  }

  restore();
  render();
  form.addEventListener('input', render);

  var copyButton = document.getElementById('copy-fst-link');
  if (copyButton) {
    copyButton.addEventListener('click', function () {
      var params = new URLSearchParams();
      if (gainsInput.value.trim()) params.set('g', gainsInput.value.trim());
      if (lossesInput.value.trim()) params.set('l', lossesInput.value.trim());
      if (feesInput.value.trim()) params.set('f', feesInput.value.trim());
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
