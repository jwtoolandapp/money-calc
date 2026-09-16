(function () {
  'use strict';
  var form = document.getElementById('si-form');
  if (!form || !window.SocialInsurance) return;

  var wageInput = document.getElementById('si-wage');
  var valueNode = document.getElementById('si-value');
  var summaryNode = document.getElementById('si-summary');
  var detailsNode = document.getElementById('si-details');

  function won(v) { return Math.round(v).toLocaleString('ko-KR') + '원'; }

  function render() {
    if (wageInput.value.trim() === '') {
      valueNode.textContent = '-';
      summaryNode.textContent = '월 보수(세전 월급)를 입력하세요.';
      detailsNode.innerHTML = '';
      return;
    }

    var result = window.SocialInsurance.calculate({ wage: wageInput.value });
    if (!result) return;

    valueNode.textContent = won(result.total);
    summaryNode.textContent = '월 ' + won(result.wage) + ' 기준 근로자 부담 4대보험료 합계입니다.';

    var rows = [
      ['국민연금 (4.75%)', won(result.nationalPension)],
      ['건강보험 (3.595%)', won(result.healthInsurance)],
      ['장기요양보험 (보료의 13.14%)', won(result.longTermCare)],
      ['고용보험 (0.9%)', won(result.employmentInsurance)],
      ['보험료 차감 후 금액', won(result.afterInsurance)]
    ];
    if (result.pensionCapped) {
      rows.splice(1, 0, ['국민연금 기준소득 상한 적용', '보수월액이 상한 6,590,000원을 넘어 상한액으로 계산']);
    } else if (result.pensionFloored) {
      rows.splice(1, 0, ['국민연금 기준소득 하한 적용', '보수월액이 하한 410,000원보다 적어 하한액으로 계산']);
    }

    detailsNode.innerHTML = rows
      .map(function (row) { return '<div><dt>' + row[0] + '</dt><dd>' + row[1] + '</dd></div>'; })
      .join('');
  }

  function restore() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('w')) wageInput.value = params.get('w');
  }

  restore();
  render();
  form.addEventListener('input', render);
  form.addEventListener('change', render);

  var copyButton = document.getElementById('copy-si-link');
  if (copyButton) {
    copyButton.addEventListener('click', function () {
      var params = new URLSearchParams();
      if (wageInput.value.trim()) params.set('w', wageInput.value.trim());
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
