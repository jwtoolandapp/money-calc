(function () {
  'use strict';
  var form = document.getElementById('freelance-form');
  if (!form || !window.FreelanceTax) return;

  var grossInput = document.getElementById('ft-gross');
  var netInput = document.getElementById('ft-net');
  var valueNode = document.getElementById('ft-value');
  var summaryNode = document.getElementById('ft-summary');
  var detailsNode = document.getElementById('ft-details');

  function won(v) { return Math.round(v).toLocaleString('ko-KR') + '원'; }

  function render() {
    var hasGross = grossInput.value.trim() !== '';
    var hasNet = netInput.value.trim() !== '';
    var result = null;
    var rows = [];

    // 두 칸이 다 차 있으면 세전 지급액을 우선한다.
    if (hasGross) {
      result = window.FreelanceTax.calculate({ mode: 'gross', gross: grossInput.value });
      if (!result) return;
      valueNode.textContent = won(result.net);
      summaryNode.textContent = '세전 ' + won(result.gross) + '에서 3.3%(소득세 3% + 지방소득세 0.3%)를 뗀 실수령액입니다.';
      rows = [
        ['세전 지급액', won(result.gross)],
        ['소득세 (3%)', won(result.incomeTax)],
        ['지방소득세 (0.3%)', won(result.localTax)],
        ['원천징수 합계 (3.3%)', won(result.withheld)],
        ['실수령액', won(result.net)]
      ];
    } else if (hasNet) {
      result = window.FreelanceTax.calculate({ mode: 'net', net: netInput.value });
      if (!result) return;
      valueNode.textContent = won(result.gross);
      summaryNode.textContent = '실수령 ' + won(result.net) + '을 받으려면 세전 ' + won(result.gross) + '을 청구해야 합니다.';
      rows = [
        ['필요한 세전 지급액', won(result.gross)],
        ['원천징수 합계 (3.3%)', won(result.withheld)],
        ['실수령액', won(result.net)]
      ];
    } else {
      valueNode.textContent = '-';
      summaryNode.textContent = '세전 지급액 또는 원하는 실수령액을 입력하세요.';
      detailsNode.innerHTML = '';
      return;
    }

    detailsNode.innerHTML = rows
      .map(function (row) { return '<div><dt>' + row[0] + '</dt><dd>' + row[1] + '</dd></div>'; })
      .join('');
  }

  function restore() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('g')) grossInput.value = params.get('g');
    if (params.get('n')) netInput.value = params.get('n');
  }

  restore();
  render();
  form.addEventListener('input', render);
  form.addEventListener('change', render);

  var copyButton = document.getElementById('copy-ft-link');
  if (copyButton) {
    copyButton.addEventListener('click', function () {
      var params = new URLSearchParams();
      if (grossInput.value.trim()) params.set('g', grossInput.value.trim());
      if (netInput.value.trim()) params.set('n', netInput.value.trim());
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
