(function () {
  'use strict';
  var form = document.getElementById('electricity-form');
  if (!form || !window.ElectricityBill) return;

  var usageInput = document.getElementById('electricity-usage');
  var seasonInput = document.getElementById('electricity-season');
  var voltageInput = document.getElementById('electricity-voltage');
  var wattsInput = document.getElementById('appliance-watts');
  var hoursInput = document.getElementById('appliance-hours');
  var daysInput = document.getElementById('appliance-days');
  var valueNode = document.getElementById('electricity-value');
  var summaryNode = document.getElementById('electricity-summary');
  var detailsNode = document.getElementById('electricity-details');

  function won(value) { return Math.round(value).toLocaleString('ko-KR') + '원'; }
  function kwh(value) { return (Math.round(value * 10) / 10).toLocaleString('ko-KR') + 'kWh'; }
  var SEASON = { other: '봄·가을', summer: '여름(7~8월)', winter: '겨울(12~2월)' };

  function render() {
    var usageText = usageInput.value.trim();
    var usage = Number(usageText);
    if (usageText === '' || !Number.isFinite(usage) || usage < 0) {
      valueNode.textContent = '0원';
      summaryNode.textContent = '한 달 사용량(kWh)을 입력하세요. 고지서나 한전ON 앱에서 볼 수 있습니다.';
      detailsNode.innerHTML = '';
      return;
    }
    var extra = window.ElectricityBill.applianceKwh(wattsInput.value, hoursInput.value, daysInput.value);
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

    var rows = [['기본요금 (' + result.tier + '단계)', won(result.baseCharge)]];
    result.steps.forEach(function (step) {
      if (step.kwh > 0) rows.push(['전력량요금 ' + step.label + ' (' + kwh(step.kwh) + ' × ' + step.rate + '원)', won(step.amount)]);
    });
    rows.push(['기후환경요금', won(result.climateCharge)]);
    rows.push(['연료비조정요금', won(result.fuelCharge)]);
    rows.push(['전기요금계', won(result.electricity)]);
    rows.push(['부가가치세 (10%)', won(result.vat)]);
    rows.push(['전력산업기반기금 (2.7%)', won(result.fund)]);
    if (extra > 0) {
      rows.push(['가전을 더 써서 늘어난 사용량', '+' + kwh(extra)]);
      rows.push(['가전을 더 써서 늘어난 요금', '+' + won(result.total - before.total)]);
      rows.push(['가전을 쓰지 않을 때 요금', won(before.total)]);
    }
    detailsNode.innerHTML = rows
      .map(function (row) { return '<div><dt>' + row[0] + '</dt><dd>' + row[1] + '</dd></div>'; })
      .join('');
  }

  var PARAMS = { kwh: usageInput, season: seasonInput, volt: voltageInput, w: wattsInput, h: hoursInput, d: daysInput };

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
  }

  restore();
  render();
  form.addEventListener('input', render);
  form.addEventListener('change', render);
  form.addEventListener('submit', function (event) { event.preventDefault(); });

  var copyButton = document.getElementById('copy-electricity-link');
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
