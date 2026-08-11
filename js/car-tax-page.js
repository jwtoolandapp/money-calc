(function () {
  'use strict';
  var form = document.getElementById('car-tax-form');
  if (!form || !window.CarTax) return;

  var ccInput = document.getElementById('car-tax-cc');
  var ageInput = document.getElementById('car-tax-age');
  var commercialInput = document.getElementById('car-tax-commercial');
  var valueNode = document.getElementById('car-tax-value');
  var summaryNode = document.getElementById('car-tax-summary');
  var detailsNode = document.getElementById('car-tax-details');

  function won(value) { return Math.round(value).toLocaleString('ko-KR') + '원'; }

  function render() {
    var result = window.CarTax.calculate({
      displacementCc: Number(ccInput.value),
      ageYears: Number(ageInput.value) || 0,
      isCommercial: commercialInput.checked
    });

    if (!result) {
      valueNode.textContent = '0원';
      summaryNode.textContent = '배기량과 차령을 입력하세요.';
      detailsNode.innerHTML = '';
      return;
    }

    valueNode.textContent = won(result.totalAnnual);
    summaryNode.textContent = (result.isCommercial ? '영업용' : '비영업용') +
      ' · cc당 ' + Math.round(result.perCc) + '원' +
      (result.discountRate > 0 ? ' · 차령 경감 ' + Math.round(result.discountRate * 100) + '%' : '') +
      ' 기준입니다.';

    var rows = [
      ['자동차세', won(result.annualTax)],
      ['지방교육세 (30%)', won(result.educationTax)],
      ['반기별 납부액', won(result.halfYearTotal)]
    ];
    if (result.discountRate > 0) {
      rows.push(['경감 전 자동차세', won(result.baseAnnual)]);
    }
    if (result.cappedAge === 12 && Number(ageInput.value) > 12) {
      rows.push(['차령 상한', '12년 (초과분은 동일)']);
    }

    detailsNode.innerHTML = rows
      .map(function (row) { return '<div><dt>' + row[0] + '</dt><dd>' + row[1] + '</dd></div>'; })
      .join('');
  }

  function restore() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('cc')) ccInput.value = params.get('cc');
    if (params.get('age')) ageInput.value = params.get('age');
    if (params.get('biz') === '1') commercialInput.checked = true;
  }

  restore();
  render();
  form.addEventListener('input', render);
  form.addEventListener('change', render);

  var copyButton = document.getElementById('copy-car-tax-link2');
  if (copyButton) {
    copyButton.addEventListener('click', function () {
      var params = new URLSearchParams();
      if (ccInput.value.trim()) params.set('cc', ccInput.value.trim());
      if (ageInput.value.trim()) params.set('age', ageInput.value.trim());
      if (commercialInput.checked) params.set('biz', '1');
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
