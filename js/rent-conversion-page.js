(function () {
  'use strict';
  var form = document.getElementById('rent-conversion-form');
  if (!form || !window.RentConversion) return;
  var R = window.RentConversion;

  function $(id) { return document.getElementById(id); }
  var modeInput = $('conversion-mode');
  var depositInput = $('current-deposit');
  var rentInput = $('current-rent');
  var newDepositInput = $('new-deposit');
  var newRentInput = $('new-rent');
  var rateInput = $('conversion-rate');
  var baseInput = $('base-rate');
  var newDepositField = $('new-deposit-field');
  var newRentField = $('new-rent-field');
  var rateField = $('conversion-rate-field');
  var labelNode = $('conversion-label');
  var valueNode = $('conversion-value');
  var summaryNode = $('conversion-summary');
  var calloutNode = $('conversion-callout');
  var detailsNode = $('conversion-details');

  var MAN = 10000;
  function won(value) { return Math.round(value).toLocaleString('ko-KR') + '원'; }
  // 1억 2,000만원처럼 읽기 쉽게
  function money(value) {
    var v = Math.round(value);
    if (v < MAN) return won(v);
    var eok = Math.floor(v / 100000000);
    var man = Math.floor((v % 100000000) / MAN);
    var rest = v % MAN;
    var text = (eok ? eok.toLocaleString('ko-KR') + '억 ' : '') + (man ? man.toLocaleString('ko-KR') + '만' : '');
    text = text.trim();
    return rest ? text + ' ' + rest.toLocaleString('ko-KR') + '원' : text + '원';
  }
  function pct(value) { return (Math.round(value * 100) / 100).toLocaleString('ko-KR') + '%'; }
  function read(input) {
    var text = input.value.trim();
    if (text === '') return null;
    var n = Number(text);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  }

  function empty(label, message) {
    labelNode.textContent = label;
    valueNode.textContent = '0원';
    summaryNode.textContent = message;
    calloutNode.hidden = true;
    detailsNode.innerHTML = '';
  }

  function rows(list) {
    detailsNode.innerHTML = list.map(function (row) {
      return '<div class="result-row' + (row[2] ? ' is-sum' : '') + '"><dt>' + row[0] + '</dt><dd>' + row[1] + '</dd></div>';
    }).join('');
  }

  function callout(strong, text) {
    calloutNode.hidden = false;
    calloutNode.innerHTML = '<strong>' + strong + '</strong><span>' + text + '</span>';
  }

  function syncFields() {
    var mode = modeInput.value;
    newDepositField.hidden = mode === 'to-deposit';
    newRentField.hidden = mode === 'to-monthly';
    rateField.hidden = mode === 'rate';
  }

  function render() {
    syncFields();
    var mode = modeInput.value;
    var deposit = read(depositInput);
    var rent = read(rentInput);
    var newDeposit = read(newDepositInput);
    var newRent = read(newRentInput);
    var base = read(baseInput);
    var cap = R.legalCapRate(base == null || Number.isNaN(base) ? undefined : base);
    var rateText = read(rateInput);
    var rate = rateText == null || Number.isNaN(rateText) || rateText === 0 ? cap : rateText;

    if (mode === 'to-monthly') {
      if (deposit == null || newDeposit == null || Number.isNaN(deposit) || Number.isNaN(newDeposit)) {
        return empty('바꾼 뒤 월세', '지금 보증금과 바꿀 보증금을 만원 단위로 입력하세요.');
      }
      if (newDeposit > deposit) {
        return empty('바꾼 뒤 월세', '바꿀 보증금이 지금 보증금보다 큽니다. 보증금을 올리려면 "월세를 보증금으로"를 고르세요.');
      }
      var diff = (deposit - newDeposit) * MAN;
      var add = R.monthlyFromDeposit(diff, rate);
      var capAdd = R.monthlyFromDeposit(diff, cap);
      var before = (rent || 0) * MAN;
      labelNode.textContent = '바꾼 뒤 월세';
      valueNode.textContent = won(before + add);
      summaryNode.textContent = '보증금 ' + money(deposit * MAN) + ' → ' + money(newDeposit * MAN) + ', 전환율 연 ' + pct(rate) + ' 기준입니다.';
      if (rate > cap + 1e-9) {
        callout('법정 상한을 넘는 전환율입니다', '계약 기간 중이거나 갱신할 때는 연 ' + pct(cap) + '까지만 받을 수 있습니다. 상한으로 계산한 월세는 ' + won(before + capAdd) + '입니다.');
      } else {
        calloutNode.hidden = true;
      }
      rows([
        ['월세로 돌리는 보증금', money(diff)],
        ['늘어나는 월세 (보증금 차액 × ' + pct(rate) + ' ÷ 12)', '+' + won(add)],
        ['지금 월세', won(before)],
        ['바꾼 뒤 월세', won(before + add), true],
        ['법정 상한(연 ' + pct(cap) + ')으로 계산한 월세', won(before + capAdd)],
      ]);
      return;
    }

    if (mode === 'to-deposit') {
      if (deposit == null || rent == null || newRent == null || Number.isNaN(deposit) || Number.isNaN(rent) || Number.isNaN(newRent)) {
        return empty('바꾼 뒤 보증금', '지금 보증금, 지금 월세, 바꿀 월세를 만원 단위로 입력하세요.');
      }
      if (newRent > rent) {
        return empty('바꾼 뒤 보증금', '바꿀 월세가 지금 월세보다 큽니다. 월세를 올리려면 "보증금을 월세로"를 고르세요.');
      }
      var rentDiff = (rent - newRent) * MAN;
      var more = R.depositFromMonthly(rentDiff, rate);
      labelNode.textContent = '바꾼 뒤 보증금';
      valueNode.textContent = money(deposit * MAN + more);
      summaryNode.textContent = '월세 ' + won(rent * MAN) + ' → ' + won(newRent * MAN) + ', 전환율 연 ' + pct(rate) + ' 기준입니다.';
      callout('월세를 보증금으로 올릴 때는 법정 상한이 없습니다', '전환율은 집주인과 합의로 정합니다. 전환율이 낮을수록 더 내야 하는 보증금이 커집니다.');
      rows([
        ['줄이는 월세', won(rentDiff) + ' (연 ' + won(rentDiff * 12) + ')'],
        ['더 내는 보증금 (줄이는 월세 × 12 ÷ ' + pct(rate) + ')', '+' + money(more)],
        ['지금 보증금', money(deposit * MAN)],
        ['바꾼 뒤 보증금', money(deposit * MAN + more), true],
      ]);
      return;
    }

    // 전환율 확인
    if (deposit == null || newDeposit == null || newRent == null || Number.isNaN(deposit) || Number.isNaN(newDeposit) || Number.isNaN(newRent)) {
      return empty('적용된 전환율', '지금 조건과 제안받은 조건(보증금·월세)을 만원 단위로 입력하세요.');
    }
    var dDiff = (deposit - newDeposit) * MAN;
    var mDiff = (newRent - (rent || 0)) * MAN;
    if (!(dDiff > 0) || !(mDiff >= 0)) {
      return empty('적용된 전환율', '제안받은 조건은 보증금이 지금보다 낮고 월세가 지금보다 높거나 같아야 합니다.');
    }
    var implied = R.impliedRate(dDiff, mDiff);
    var capMonthly = R.monthlyFromDeposit(dDiff, cap);
    labelNode.textContent = '적용된 전환율';
    valueNode.textContent = '연 ' + pct(implied);
    summaryNode.textContent = '보증금을 ' + money(dDiff) + ' 낮추고 월세를 ' + won(mDiff) + ' 올리는 조건입니다.';
    if (implied > cap + 1e-9) {
      callout('법정 상한 연 ' + pct(cap) + '를 넘습니다', '상한으로 계산하면 늘어나는 월세는 ' + won(capMonthly) + '까지입니다. 제안보다 매달 ' + won(mDiff - capMonthly) + ' 적습니다. 새로 맺는 계약에는 상한이 적용되지 않습니다.');
    } else {
      callout('법정 상한 연 ' + pct(cap) + ' 안쪽입니다', '상한으로 계산한 월세 증가분은 ' + won(capMonthly) + '입니다.');
    }
    rows([
      ['낮추는 보증금', money(dDiff)],
      ['늘어나는 월세', '+' + won(mDiff) + ' (연 ' + won(mDiff * 12) + ')'],
      ['적용된 전환율 (연 월세 증가분 ÷ 보증금 차액)', '연 ' + pct(implied), true],
      ['법정 상한(연 ' + pct(cap) + ')으로 계산한 월세 증가분', won(capMonthly)],
    ]);
  }

  var PARAMS = { mode: modeInput, dep: depositInput, rent: rentInput, ndep: newDepositInput, nrent: newRentInput, rate: rateInput, base: baseInput };
  var NUMBER = /^\d{1,9}(\.\d{1,3})?$/;

  function restore() {
    var params = new URLSearchParams(window.location.search);
    Object.keys(PARAMS).forEach(function (key) {
      var value = params.get(key);
      if (value == null || value === '') return;
      var input = PARAMS[key];
      if (input.tagName === 'SELECT') {
        if (Array.prototype.some.call(input.options, function (option) { return option.value === value; })) input.value = value;
      } else if (NUMBER.test(value)) {
        input.value = value;
      }
    });
  }

  restore();
  render();
  form.addEventListener('input', render);
  form.addEventListener('change', render);
  form.addEventListener('submit', function (event) { event.preventDefault(); });

  var copyButton = $('copy-conversion-link');
  if (copyButton) {
    copyButton.addEventListener('click', function () {
      var params = new URLSearchParams();
      Object.keys(PARAMS).forEach(function (key) {
        var input = PARAMS[key];
        var field = input.closest('.field');
        if (field && field.hidden) return;
        var value = input.value.trim();
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
