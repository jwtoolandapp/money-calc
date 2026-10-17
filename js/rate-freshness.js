(function () {
  'use strict';
  function freshness(date, now) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return 'unknown';
    var day = Date.parse(date + 'T00:00:00Z');
    if (!Number.isFinite(day) || new Date(day).toISOString().slice(0, 10) !== date) return 'unknown';
    var age = Math.floor((now - day) / 86400000);
    if (age < 0) return 'unknown';
    // A display warning after two weekly cycles; not a claim that younger data is current.
    return age > 14 ? 'stale' : 'snapshot';
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { freshness: freshness };
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-rates-fetched]').forEach(function (notice) {
    var state = freshness(notice.getAttribute('data-rates-fetched'), Date.now());
    notice.setAttribute('data-rates-state', state);
    var label = notice.querySelector('[data-rates-status]');
    if (!label) return;
    if (state === 'stale') label.textContent = '수집 후 14일이 지난 과거 금리입니다. 최신 갱신을 확인하지 못했으므로 현재 상품 선택의 근거로 사용하지 말고 금융감독원과 해당 은행의 최신 공시를 확인하세요.';
    if (state === 'unknown') label.textContent = '수집일을 확인할 수 없습니다. 현재 금리로 사용하지 말고 금융감독원과 해당 은행의 최신 공시를 확인하세요.';
  });
}());
