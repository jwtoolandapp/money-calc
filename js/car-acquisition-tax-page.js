(function () {
  'use strict';
  var form = document.getElementById('car-acquisition-tax-form');
  if (!form || !window.CarAcquisitionTax) return;

  var typeSelect = document.getElementById('car-type');
  var priceInput = document.getElementById('car-price');
  var vatCheckbox = document.getElementById('car-price-vat');
  var valueNode = document.getElementById('car-tax-value');
  var summaryNode = document.getElementById('car-tax-summary');
  var detailsNode = document.getElementById('car-tax-details');

  function won(value) {
    return Math.round(value).toLocaleString('ko-KR') + '원';
  }

  function render() {
    var price = Number(priceInput.value);
    if (!Number.isFinite(price) || price <= 0) {
      valueNode.textContent = '0원';
      summaryNode.textContent = '차량 종류와 취득가액을 입력하세요.';
      detailsNode.innerHTML = '';
      return;
    }

    var result = window.CarAcquisitionTax.calculate({
      vehicleTypeId: typeSelect.value,
      price: price,
      priceIncludesVat: vatCheckbox.checked
    });
    if (!result) return;

    valueNode.textContent = won(result.tax);
    summaryNode.textContent = result.vehicleType + ' · 세율 ' +
      (Math.round(result.rate * 1000) / 10) + '% 기준 예상 금액입니다.';

    detailsNode.innerHTML =
      '<div><dt>과세표준</dt><dd>' + won(result.taxBase) + '</dd></div>' +
      '<div><dt>적용 세율</dt><dd>' + (Math.round(result.rate * 1000) / 10) + '%</dd></div>' +
      '<div><dt>취득가액 + 취득세</dt><dd>' + won(result.totalWithTax) + '</dd></div>';
  }

  function restore() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('t')) typeSelect.value = params.get('t');
    if (params.get('p')) priceInput.value = params.get('p');
    if (params.get('vat') === '0') vatCheckbox.checked = false;
  }

  function shareUrl() {
    var params = new URLSearchParams();
    params.set('t', typeSelect.value);
    if (priceInput.value.trim() !== '') params.set('p', priceInput.value.trim());
    if (!vatCheckbox.checked) params.set('vat', '0');
    return window.location.origin + window.location.pathname + '?' + params.toString();
  }

  restore();
  render();
  form.addEventListener('input', render);
  form.addEventListener('change', render);

  var copyButton = document.getElementById('copy-car-tax-link');
  if (copyButton) {
    copyButton.addEventListener('click', function () {
      var url = shareUrl();
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
