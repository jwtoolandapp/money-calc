(function (root) {
  'use strict';
  // Only loaded on this calculator. Existing checklist print behavior is untouched.
  root.CalculationPrint = {
    mount: function (anchor, buildSummary) {
      const doc = root.document;
      const report = doc.createElement('section');
      report.id = 'calculation-print-summary';
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'button button-secondary copy-button';
      button.textContent = '계산 요약 인쇄 / PDF';
      anchor.insertAdjacentElement('afterend', button);
      doc.body.appendChild(report);
      function prepare() {
        const canonical = doc.querySelector('link[rel="canonical"]');
        report.textContent = buildSummary() + '\n\n작성 시각: ' + new Date().toLocaleString('ko-KR') +
          '\n출처: ' + (canonical ? canonical.href : root.location.href.split('?')[0]);
        doc.body.classList.add('printing-calculation');
      }
      button.addEventListener('click', function () { prepare(); root.print(); });
      root.addEventListener('beforeprint', prepare);
      root.addEventListener('afterprint', function () { doc.body.classList.remove('printing-calculation'); });
    }
  };
}(window));

