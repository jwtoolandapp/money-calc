(function (global) {
  'use strict';

  /**
   * 퍼센트 계산기 — 세 가지 일상 패턴.
   *
   *   part    : 기준값의 N%는 얼마인가        (예: 50,000원의 15% = 7,500)
   *   ratio   : A는 B의 몇 %인가              (예: 15,000은 300,000의 5%)
   *   change  : A에서 B로 몇 % 변했나         (예: 8,000 → 10,000 = +25%)
   *
   * 할인 계산은 part에서 "할인율"을 넣으면 자연스럽게 나온다.
   * 30,000원의 20% 할인 = part(30000, 20) → 할인액 6,000, 최종가 24,000.
   */

  function finite(value) {
    var v = Number(value);
    return Number.isFinite(v) ? v : null;
  }

  function partOf(base, rate) {
    var b = finite(base);
    var r = finite(rate);
    if (b === null || r === null) return null;
    var part = (b * r) / 100;
    return { base: b, rate: r, part: part, remainder: b - part };
  }

  function ratioOf(part, whole) {
    var p = finite(part);
    var w = finite(whole);
    if (p === null || w === null || w === 0) return null;
    return { part: p, whole: w, rate: (p / w) * 100 };
  }

  function changeRate(from, to) {
    var a = finite(from);
    var b = finite(to);
    if (a === null || b === null || a === 0) return null;
    var rate = ((b - a) / a) * 100;
    return { from: a, to: b, diff: b - a, rate: rate, increased: rate > 0 };
  }

  function calculate(input) {
    if (!input || !input.mode) return null;
    if (input.mode === 'part') return partOf(input.base, input.rate);
    if (input.mode === 'ratio') return ratioOf(input.part, input.whole);
    if (input.mode === 'change') return changeRate(input.from, input.to);
    return null;
  }

  global.PercentCalc = {
    calculate: calculate,
    partOf: partOf,
    ratioOf: ratioOf,
    changeRate: changeRate,
  };
})(typeof window !== 'undefined' ? window : globalThis);
