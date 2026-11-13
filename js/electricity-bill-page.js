(function () {
  'use strict';
  var form = document.getElementById('electricity-form');
  if (!form || !window.ElectricityBill) return;

  var MAX_APPLIANCES = 6;
  var usageInput = document.getElementById('electricity-usage');
  var seasonInput = document.getElementById('electricity-season');
  var voltageInput = document.getElementById('electricity-voltage');
  var listNode = document.getElementById('appliance-list');
  var addButton = document.getElementById('add-appliance');
  var valueNode = document.getElementById('electricity-value');
  var summaryNode = document.getElementById('electricity-summary');
  var detailsNode = document.getElementById('electricity-details');
  var detailsTitle = document.getElementById('electricity-details-title');
  var calloutNode = document.getElementById('electricity-callout');
  var shareNode = document.getElementById('electricity-share');

  function won(value) { return Math.round(value).toLocaleString('ko-KR') + '원'; }
  function kwh(value) { return (Math.round(value * 10) / 10).toLocaleString('ko-KR') + 'kWh'; }
  var SEASON = { other: '봄·가을', summer: '여름(7~8월)', winter: '겨울(12~2월)' };

  // 가전 줄: 첫 줄은 HTML에 있고(id에 번호 없음), 나머지는 여기서 만든다.
  function rows() { return Array.prototype.slice.call(listNode.querySelectorAll('[data-appliance-row]')); }
  function rowInputs(row) {
    var inputs = row.querySelectorAll('input');
    return { watts: inputs[0], hours: inputs[1], days: inputs[2] };
  }

  function field(id, label, unit, attrs) {
    return '<div class="field"><label for="' + id + '">' + label + '</label><div class="input-wrap"><input id="' + id +
      '" type="number" min="0" ' + attrs + '><span class="unit">' + unit + '</span></div></div>';
  }

  function renumber() {
    rows().forEach(function (row, index) {
      row.querySelector('h3').textContent = '가전 ' + (index + 1);
    });
    if (addButton) addButton.hidden = rows().length >= MAX_APPLIANCES;
  }

  var serial = 1;
  function addRow(values) {
    if (rows().length >= MAX_APPLIANCES) return null;
    serial += 1;
    var row = document.createElement('div');
    row.className = 'appliance-row';
    row.setAttribute('data-appliance-row', '');
    row.innerHTML = '<div class="appliance-row-head"><h3></h3><button class="text-button" type="button" data-remove-appliance>빼기</button></div>' +
      '<div class="appliance-fields">' +
      field('appliance-watts-' + serial, '소비전력', 'W', 'step="10" inputmode="numeric"') +
      field('appliance-hours-' + serial, '하루 사용 시간', '시간', 'max="24" step="0.5" inputmode="decimal"') +
      field('appliance-days-' + serial, '한 달 사용 일수', '일', 'max="31" step="1" inputmode="numeric"') + '</div>';
    listNode.appendChild(row);
    if (values) {
      var inputs = rowInputs(row);
      inputs.watts.value = values[0]; inputs.hours.value = values[1]; inputs.days.value = values[2];
    }
    renumber();
    return row;
  }

  function render() {
    var usageText = usageInput.value.trim();
    var usage = Number(usageText);
    if (usageText === '' || !Number.isFinite(usage) || usage < 0) {
      valueNode.textContent = '0원';
      summaryNode.textContent = '한 달 사용량(kWh)을 입력하세요. 고지서나 한전ON 앱에서 볼 수 있습니다.';
      detailsNode.innerHTML = '';
      detailsTitle.hidden = true;
      calloutNode.hidden = true;
      shareNode.hidden = true;
      return;
    }
    var appliances = [];
    rows().forEach(function (row, index) {
      var inputs = rowInputs(row);
      var amount = window.ElectricityBill.applianceKwh(inputs.watts.value, inputs.hours.value, inputs.days.value);
      if (amount > 0) appliances.push({ label: '가전 ' + (index + 1), kwh: amount });
    });
    var extra = appliances.reduce(function (sum, item) { return sum + item.kwh; }, 0);
    var season = seasonInput.value;
    var voltage = voltageInput.value;
    var before = window.ElectricityBill.calculate({ usageKwh: usage, season: season, voltage: voltage });
    var result = extra > 0
      ? window.ElectricityBill.calculate({ usageKwh: usage + extra, season: season, voltage: voltage })
      : before;

    valueNode.textContent = won(result.total);
    summaryNode.textContent = SEASON[result.season] + ' · ' + (result.voltage === 'high' ? '고압' : '저압') +
      ' · ' + kwh(result.usageKwh) + ' · 누진 ' + result.tier + '단계' +
      (result.superUser ? ' · 1,000kWh 초과분 슈퍼유저 단가' : '') + ' 기준입니다.';

    var list = [['기본요금 (' + result.tier + '단계)', won(result.baseCharge)]];
    result.steps.forEach(function (step) {
      if (step.kwh > 0) list.push(['전력량요금 ' + step.label + ' · ' + kwh(step.kwh) + ' × ' + step.rate + '원', won(step.amount)]);
    });
    list.push(['기후환경요금', won(result.climateCharge)]);
    list.push(['연료비조정요금', won(result.fuelCharge)]);
    list.push(['부가가치세 (10%)', won(result.vat)]);
    list.push(['전력산업기반기금 (2.7%)', won(result.fund)]);
    list.push(['청구금액 (10원 미만 버림)', won(result.total), true]);
    detailsTitle.hidden = false;
    detailsNode.innerHTML = list
      .map(function (row) { return '<div class="result-row' + (row[2] ? ' is-sum' : '') + '"><dt>' + row[0] + '</dt><dd>' + row[1] + '</dd></div>'; })
      .join('');

    if (!(extra > 0)) {
      calloutNode.hidden = true;
      shareNode.hidden = true;
      return;
    }
    var increase = result.total - before.total;
    calloutNode.hidden = false;
    calloutNode.innerHTML = '<strong>가전' + (appliances.length > 1 ? ' ' + appliances.length + '개' : '') + ' 때문에 +' + won(increase) + '</strong>' +
      '<span>가전 없이 ' + won(before.total) + ' → 가전 포함 ' + won(result.total) + ' · 사용량 +' + kwh(extra) + '</span>';
    if (appliances.length < 2) {
      shareNode.hidden = true;
      return;
    }
    // 누진제라 가전별 요금을 따로 떼어 낼 수 없다. 늘어난 요금을 사용량 비율로 나눠 보여 준다.
    shareNode.hidden = false;
    shareNode.innerHTML = '<h3 class="result-subhead">가전별로 나눠 보면</h3><ul class="appliance-share">' +
      appliances.map(function (item) {
        var ratio = item.kwh / extra;
        return '<li><div class="appliance-share-top"><span>' + item.label + ' · ' + kwh(item.kwh) + '</span><b>약 ' + won(increase * ratio) + '</b></div>' +
          '<div class="appliance-share-bar"><i style="width:' + Math.round(ratio * 100) + '%"></i></div></li>';
      }).join('') +
      '</ul><p class="result-note">누진제는 전체 사용량으로 단가가 정해져, 늘어난 요금을 사용량 비율로 나눈 값입니다.</p>';
  }

  var PARAMS = { kwh: usageInput, season: seasonInput, volt: voltageInput };
  var NUMBER = /^\d{1,6}(\.\d{1,2})?$/;

  // 가전 주소 매개변수: 첫 가전은 w·h·d, 둘째부터 w2·h2·d2 …
  function restore() {
    var params = new URLSearchParams(window.location.search);
    Object.keys(PARAMS).forEach(function (key) {
      var value = params.get(key);
      if (value == null || value === '') return;
      var input = PARAMS[key];
      if (input.tagName === 'SELECT') {
        if (Array.prototype.some.call(input.options, function (option) { return option.value === value; })) input.value = value;
      } else {
        input.value = value.slice(0, 12);
      }
    });
    for (var n = 1; n <= MAX_APPLIANCES; n += 1) {
      var suffix = n === 1 ? '' : String(n);
      var values = ['w', 'h', 'd'].map(function (key) {
        var value = params.get(key + suffix) || '';
        return NUMBER.test(value) ? value : '';
      });
      if (!values[0] && !values[1] && !values[2]) continue;
      if (n === 1) {
        var first = rowInputs(rows()[0]);
        first.watts.value = values[0]; first.hours.value = values[1]; first.days.value = values[2];
      } else {
        addRow(values);
      }
    }
  }

  restore();
  renumber();
  render();
  form.addEventListener('input', render);
  form.addEventListener('change', render);
  form.addEventListener('submit', function (event) { event.preventDefault(); });

  if (addButton) {
    addButton.addEventListener('click', function () {
      var row = addRow();
      if (row) rowInputs(row).watts.focus();
    });
  }
  listNode.addEventListener('click', function (event) {
    var button = event.target.closest ? event.target.closest('[data-remove-appliance]') : null;
    if (!button) return;
    var row = button.closest('[data-appliance-row]');
    if (row) row.parentNode.removeChild(row);
    renumber();
    render();
    if (addButton && !addButton.hidden) addButton.focus();
  });

  var copyButton = document.getElementById('copy-electricity-link');
  if (copyButton) {
    copyButton.addEventListener('click', function () {
      var params = new URLSearchParams();
      Object.keys(PARAMS).forEach(function (key) {
        var value = PARAMS[key].value.trim();
        if (value) params.set(key, value);
      });
      var n = 0;
      rows().forEach(function (row) {
        var inputs = rowInputs(row);
        var values = [inputs.watts.value.trim(), inputs.hours.value.trim(), inputs.days.value.trim()];
        if (!values[0] && !values[1] && !values[2]) return;
        n += 1;
        var suffix = n === 1 ? '' : String(n);
        ['w', 'h', 'd'].forEach(function (key, index) { if (values[index]) params.set(key + suffix, values[index]); });
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
