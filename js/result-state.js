(function (global) {
  'use strict';

  // 계산 함수가 null(음수·숫자가 아닌 값 등 잘못된 입력)을 돌려줬을 때 쓰는 공통 처리.
  // 예전에는 `if (!result) return;` 으로 빠져나가 직전 입력의 결과가 화면에 그대로 남았다.
  var INVALID_MESSAGE = '입력값을 확인하세요. 0 이상의 숫자를 입력해야 계산됩니다.';

  function showInvalid(valueNode, summaryNode, detailsNode, message) {
    if (valueNode) valueNode.textContent = '-';
    if (summaryNode) summaryNode.textContent = message || INVALID_MESSAGE;
    if (detailsNode) detailsNode.innerHTML = '';
  }

  global.MoneyCalcResultState = Object.freeze({ showInvalid: showInvalid, INVALID_MESSAGE: INVALID_MESSAGE });
})(typeof window !== 'undefined' ? window : globalThis);
