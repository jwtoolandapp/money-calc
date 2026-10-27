(function () {
  'use strict';
  function freshness(date, now) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return 'unknown';
    var day = Date.parse(date + 'T00:00:00Z');
    if (!Number.isFinite(day) || new Date(day).toISOString().slice(0, 10) !== date) return 'unknown';
    // Compare calendar dates in Korea, including the UTC evening before a KST fetch date.
    var today = Date.parse(new Date(now + 9 * 3600000).toISOString().slice(0, 10) + 'T00:00:00Z');
    var age = Math.floor((today - day) / 86400000);
    if (age < 0) return 'unknown';
    // Warn after 8 days, strengthen after 14; younger snapshots are not real-time rates.
    return age > 14 ? 'stale' : age > 8 ? 'delayed' : 'snapshot';
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { freshness: freshness };
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-rates-fetched]').forEach(function (notice) {
    var state = freshness(notice.getAttribute('data-rates-fetched'), Date.now());
    notice.setAttribute('data-rates-state', state);
    var label = notice.querySelector('[data-rates-status]');
    if (!label) return;
    if (state === 'delayed') label.textContent = '주간 갱신 예상 시점이 지났습니다. 갱신 지연 가능성이 있으므로 아래 금리를 최신 금리로 간주하지 말고 금융감독원과 해당 은행의 공시를 확인하세요.';
    if (state === 'stale') label.textContent = '수집 후 14일이 지난 과거 금리입니다. 최신 갱신을 확인하지 못했으므로 현재 상품 선택의 근거로 사용하지 말고 금융감독원과 해당 은행의 최신 공시를 확인하세요.';
    if (state === 'unknown') label.textContent = '수집일을 확인할 수 없습니다. 현재 금리로 사용하지 말고 금융감독원과 해당 은행의 최신 공시를 확인하세요.';
  });
}());
