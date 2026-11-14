(function (global) {
  'use strict';

  var C = (global.CALC_CONSTANTS_2026 || {}).ELECTRICITY || {};

  /**
   * 주택용 전기요금(한전 전기요금표 기준).
   *
   * 틀리기 쉬운 곳:
   *   1) 기본요금은 그달 사용량이 속한 단계의 금액 하나만 붙는다(누적 아님).
   *   2) 전력량요금은 단계별로 나눠 계산하는 누진이다(자동차세와 반대).
   *   3) 하계(7~8월)는 구간 경계가 300/450kWh로 넓어진다. 단가는 같다.
   *   4) 하계·동계에 1,000kWh를 넘는 부분은 슈퍼유저 단가가 붙는다.
   *   5) 부가가치세는 원 미만 사사오입, 전력산업기반기금은 10원 미만 절사.
   *      둘 다 "전기요금계"(기본+전력량+기후환경+연료비조정)에 곱한다.
   */
  function tiersFor(voltage, season) {
    var table = (C.TARIFF || {})[voltage === 'high' ? 'high' : 'low'] || {};
    var limits = season === 'summer' ? C.SUMMER_LIMITS : C.OTHER_LIMITS;
    return { table: table, limits: limits || [200, 400] };
  }

  function calculate(input) {
    var usage = Number(input.usageKwh);
    if (!Number.isFinite(usage) || usage < 0) return null;
    var season = input.season === 'summer' || input.season === 'winter' ? input.season : 'other';
    var voltage = input.voltage === 'high' ? 'high' : 'low';
    var t = tiersFor(voltage, season);
    var base = t.table.BASE || [];
    var energy = t.table.ENERGY || [];
    var l1 = t.limits[0];
    var l2 = t.limits[1];

    var tier = usage <= l1 ? 0 : usage <= l2 ? 1 : 2;
    var baseCharge = base[tier] || 0;

    var superLimit = Number(C.SUPER_USER_LIMIT) || 1000;
    var superApplies = season !== 'other' && usage > superLimit;
    var steps = [
      { label: '1단계', kwh: Math.min(usage, l1), rate: energy[0] || 0 },
      { label: '2단계', kwh: Math.max(0, Math.min(usage, l2) - l1), rate: energy[1] || 0 },
      { label: '3단계', kwh: Math.max(0, Math.min(usage, superApplies ? superLimit : usage) - l2), rate: energy[2] || 0 }
    ];
    if (superApplies) steps.push({ label: '슈퍼유저', kwh: usage - superLimit, rate: t.table.SUPER_USER || 0 });
    var energyRaw = 0;
    steps.forEach(function (step) { step.amount = step.kwh * step.rate; energyRaw += step.amount; });
    var energyCharge = Math.floor(energyRaw + 1e-6);

    var climateCharge = Math.floor(usage * (Number(C.CLIMATE_PER_KWH) || 0) + 1e-6);
    var fuelCharge = Math.floor(usage * (Number(C.FUEL_ADJUST_PER_KWH) || 0) + 1e-6);
    var electricity = baseCharge + energyCharge + climateCharge + fuelCharge;
    var vat = Math.round(electricity * (Number(C.VAT_RATE) || 0.1));
    var fund = Math.floor(electricity * (Number(C.FUND_RATE) || 0) / 10 + 1e-6) * 10;
    var total = Math.floor((electricity + vat + fund) / 10) * 10;

    return {
      usageKwh: usage, season: season, voltage: voltage, tier: tier + 1,
      baseCharge: baseCharge, energyCharge: energyCharge, steps: steps,
      climateCharge: climateCharge, fuelCharge: fuelCharge,
      electricity: electricity, vat: vat, fund: fund, total: total,
      superUser: superApplies
    };
  }

  /** 가전 소비전력(W)·하루 사용 시간·사용 일수 → 월 사용량(kWh). */
  function applianceKwh(watts, hoursPerDay, days) {
    var w = Number(watts); var h = Number(hoursPerDay); var d = Number(days);
    if (!(w > 0) || !(h > 0) || !(d > 0)) return 0;
    // 하루는 24시간, 한 달은 31일을 넘을 수 없다. 넘게 넣으면 상한으로 계산한다.
    h = Math.min(h, 24); d = Math.min(d, 31);
    return w * h * d / 1000;
  }

  global.ElectricityBill = { calculate: calculate, applianceKwh: applianceKwh };
})(typeof window !== 'undefined' ? window : globalThis);
