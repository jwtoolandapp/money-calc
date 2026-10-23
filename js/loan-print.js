(function (root) {
  'use strict';
  const methods = { annuity: '원리금균등', 'equal-principal': '원금균등', bullet: '만기일시' };
  const fields = {
    repayment: [
      ['principal', '대출 원금', '원'], ['annualRate', '연 이자율', '%'],
      ['termMonths', '전체 대출 기간', '개월'], ['graceMonths', '거치기간', '개월']
    ],
    refinance: [
      ['principal', '현재 남은 원금', '원'], ['existingAnnualRate', '기존 연 이자율', '%'],
      ['existingRemainingMonths', '기존 대출 잔여기간', '개월'],
      ['prepaymentFeeRate', '중도상환수수료율', '%'], ['monthsUntilWaiver', '수수료 면제까지 남은 기간', '개월'],
      ['newAnnualRate', '새 연 이자율', '%'], ['newTermMonths', '새 대출 기간', '개월'],
      ['setupCost', '인지대·설정비 등', '원']
    ]
  };
  function summary(tab, raw, calc, constants) {
    const lines = [tab === 'refinance' ? '대환 비교 계산 요약' : '대출 상환 계산 요약'];
    const checked = calc.validateFormInput(tab, raw);
    const input = checked.input;
    let valid = checked.valid;
    fields[tab].forEach(([key, label, unit]) => {
      let text = String(raw[key] == null ? '' : raw[key]).trim();
      // Format presentation only. Do not normalize the form or disguise invalid input.
      if (unit === '원' && !checked.invalid.includes(key)) {
        const parts = text.replace(/,/g, '').split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        text = parts.join('.');
      }
      lines.push(label + ': ' + (text || '(미입력)') + ' ' + unit);
    });
    if (tab === 'repayment') {
      input.method = raw.method;
      lines.push('상환 방식: ' + (methods[raw.method] || '(확인 필요)'));
      if (!methods[raw.method]) valid = false;
    } else {
      lines.push('계산 가정: 기존·새 대출 모두 원리금균등 상환, 남은 원금 동일.');
    }
    const won = value => value.toLocaleString('ko-KR', { maximumFractionDigits: 0 }) + '원';
    if (valid) {
      const result = tab === 'repayment' ? calc.buildRepaymentSchedule(input) : calc.calculateRefinance(input);
      const amounts = tab === 'repayment' ?
        [['상환 원금', result.totalPrincipal], ['총 이자', result.totalInterest], ['총 납입액', result.totalPayment],
          ['첫 회 납입액', result.firstPayment], ['마지막 회 납입액', result.lastPayment]] :
        [['기존 대출 남은 이자', result.existingInterest], ['새 대출 예상 이자', result.newInterest],
          ['중도상환수수료', result.prepaymentFee], ['새 대출 설정비', result.setupCost], ['대환 후 총비용', result.newTotalCost]];
      if (amounts.every(([, value]) => Number.isFinite(value))) {
        if (tab === 'repayment') {
          lines.push('계산에 적용된 거치기간: ' + result.graceMonths + '개월',
            (raw.method === 'bullet' ? '평소 월 이자: ' :
              (result.graceMonths > 0 ? '거치 후 ' : '') +
              (raw.method === 'equal-principal' ? '첫 납입액: ' : '월 납입액: ')) + won(result.monthlyPayment));
        } else {
          lines.push('수수료 계산에 적용된 잔여기간: ' + result.remainingFeeMonths + '개월 / 전체 ' +
            constants.PREPAYMENT_FEE_TOTAL_MONTHS + '개월',
            '대환 차액: ' + won(Math.abs(result.savings)) + (result.isSaving ? ' 이득' : ' 손해'));
        }
        amounts.forEach(([label, value]) => lines.push(label + ': ' + won(value)));
      } else valid = false;
    }
    if (!valid) lines.push(calc.inputErrorMessage(checked.invalid) + ' 결과를 표시하지 않습니다.');
    lines.push('계산 기준: 사용자가 입력한 금리로 월 단위 계산. 은행별 일수·반올림·약정 조건에 따라 실제 금액이 달라집니다.',
      '공시 금리 참고표는 이 계산에 자동 적용되지 않습니다.',
      '본 계산기는 참고용이며 실제 금액·점수와 다를 수 있습니다. 법적·재무적 판단의 근거로 사용할 수 없습니다.');
    return lines.join('\n');
  }
  if (typeof module === 'object' && module.exports) module.exports = { summary };
  if (!root.document) return;
  function initialize() {
    const doc = root.document;
    root.CalculationPrint.mount(doc.querySelector('.tabs'), function () {
      const tab = doc.getElementById('refinance-panel').hidden ? 'repayment' : 'refinance';
      const ids = tab === 'repayment' ?
        ['principal', 'annual-rate', 'term-months', 'grace-months'] :
        ['ref-balance', 'ref-old-rate', 'ref-old-months', 'ref-fee-rate', 'ref-waiver-months', 'ref-new-rate', 'ref-new-months', 'ref-setup-cost'];
      const raw = {};
      fields[tab].forEach(([key], index) => { raw[key] = doc.getElementById(ids[index]).value; });
      raw.method = doc.getElementById('repayment-method').value;
      return summary(tab, raw, root.MoneyCalcCalculators.loan, root.CALC_CONSTANTS_2026.LOAN);
    });
  }
  if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
}(typeof window === 'undefined' ? globalThis : window));

