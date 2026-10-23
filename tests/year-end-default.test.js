'use strict';

// 연말정산 첫 화면은 기납부세액 자동 추정을 켠 상태로 시작한다.
// 꺼진 채 시작하면 기납부세액 0원으로 계산돼 대부분의 직장인에게 과도한 추가 납부액이 표시된다.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'year-end-tax', 'index.html'), 'utf8');

const input = html.match(/<input id="auto-withheld"[^>]*>/);
assert.ok(input, 'auto-withheld 입력이 있어야 합니다');
assert.match(input[0], /\schecked(\s|>|$)/, '자동 추정은 기본으로 켜져 있어야 합니다');
assert.match(html, /실제 소득세 누계액을 알면 체크를 끄고 직접 입력하세요/, '실제 금액 입력 방법을 안내해야 합니다');

console.log('year-end default auto-withheld tests: PASS');
