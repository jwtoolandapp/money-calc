(function () {
  'use strict';
  var form = document.getElementById('rent-credit-form');
  if (!form || !window.MonthlyRentCredit) return;

  function $(id) { return document.getElementById(id); }
  var salaryInput = $('rent-credit-salary');
  var rentInput = $('rent-credit-rent');
  var monthsInput = $('rent-credit-months');
  var valueNode = $('rent-credit-value');
  var summaryNode = $('rent-credit-summary');
  var calloutNode = $('rent-credit-callout');
  var detailsNode = $('rent-credit-details');

  var MAN = 10000;
  function won(value) { return Math.round(value).toLocaleString('ko-KR') + '원'; }
  function pct(value) { return Math.round(value * 100) + '%'; }
  function read(input) {
    var text = input.value.trim();
    if (text === '') return null;
    var n = Number(text);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  }

  function empty(message) {
    valueNode.textContent = '0원';
    summaryNode.textContent = message;
    calloutNode.hidden = true;
    detailsNode.innerHTML = '';
  }

  function render() {
    var salary = read(salaryInput);
    var rent = read(rentInput);
    var monthsText = read(monthsInput);
    var months = monthsText == null ? 12 : monthsText;
    if (salary == null || rent == null || Number.isNaN(salary) || Number.isNaN(rent) || Number.isNaN(months)) {
      return empty('총급여와 월세를 만원 단위로 입력하세요.');
    }
    var result = window.MonthlyRentCredit.calculate({ grossSalary: salary * MAN, monthlyRent: rent * MAN, months: months });
    if (!result) return empty('입력값을 확인해 주세요.');

    if (!result.eligible) {
      valueNode.textContent = '대상 아님';
      summaryNode.textContent = '총급여가 ' + won(result.salaryLimit) + '을 넘으면 월세 세액공제를 받을 수 없습니다.';
      calloutNode.hidden = false;
      calloutNode.innerHTML = '<strong>월세 현금영수증 소득공제를 확인해 보세요</strong><span>세액공제 대상이 아니어도 월세를 현금영수증으로 신고하면 신용카드 등 소득공제에 포함할 수 있습니다. 두 가지를 함께 받을 수는 없습니다.</span>';
      detailsNode.innerHTML = '';
      return;
    }

    valueNode.textContent = won(result.credit);
    summaryNode.textContent = '1년간 낸 월세 ' + won(result.paid) + ' 중 ' + won(result.applied) + '에 ' + pct(result.rate) + '를 곱한 금액입니다.';
    if (result.overCap > 0) {
      calloutNode.hidden = false;
      calloutNode.innerHTML = '<strong>한도 ' + won(result.cap) + '까지만 공제됩니다</strong><span>낸 월세 중 ' + won(result.overCap) + '은 공제 대상에서 빠집니다.</span>';
    } else {
      calloutNode.hidden = true;
    }
    var rows = [
      ['낸 월세 (' + won(rent * MAN) + ' × ' + result.months + '개월)', won(result.paid)],
      ['공제 대상 금액 (한도 ' + won(result.cap) + ')', won(result.applied)],
      ['공제율 (총급여 ' + (result.rate === 0.17 ? won(result.highRateLimit) + ' 이하' : won(result.highRateLimit) + ' 초과') + ')', pct(result.rate)],
      ['월세 세액공제액', won(result.credit), true],
      ['함께 줄어드는 지방소득세 (10%)', won(result.localTaxSaving)],
      ['세금이 줄어드는 금액 합계', won(result.totalSaving)],
    ];
    detailsNode.innerHTML = rows.map(function (row) {
      return '<div class="result-row' + (row[2] ? ' is-sum' : '') + '"><dt>' + row[0] + '</dt><dd>' + row[1] + '</dd></div>';
    }).join('');
  }

  var PARAMS = { salary: salaryInput, rent: rentInput, months: monthsInput };
  var NUMBER = /^\d{1,7}(\.\d{1,2})?$/;

  function restore() {
    var params = new URLSearchParams(window.location.search);
    Object.keys(PARAMS).forEach(function (key) {
      var value = params.get(key);
      if (value != null && NUMBER.test(value)) PARAMS[key].value = value;
    });
  }

  restore();
  render();
  form.addEventListener('input', render);
  form.addEventListener('change', render);
  form.addEventListener('submit', function (event) { event.preventDefault(); });

  var copyButton = $('copy-rent-credit-link');
  if (copyButton) {
    copyButton.addEventListener('click', function () {
      var params = new URLSearchParams();
      Object.keys(PARAMS).forEach(function (key) {
        var value = PARAMS[key].value.trim();
        if (value) params.set(key, value);
      });
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
