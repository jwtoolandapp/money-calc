const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'loan/index.html'), 'utf8');
const { summary } = require('../js/loan-print.js');
const nodes = new Map();
function element(id = '') {
  return {
    id, value: '', dataset: {}, children: [], listeners: {}, hidden: false,
    classList: { toggle() {} },
    setAttribute(key, value) { this[key] = value; },
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
    dispatch(type) { for (const fn of this.listeners[type] || []) fn({ preventDefault() {} }); },
    matches(selector) { return selector === '[data-number]' && this.type === 'text'; },
    after(node) { nodes.set(node.id, node); },
    appendChild(node) { this.children.push(node); },
    replaceChildren(...children) { this.children = children; },
    querySelector() { return this.result ||= element(); },
  };
}
function get(id) {
  if (!nodes.has(id)) nodes.set(id, element(id));
  return nodes.get(id);
}
// Take actual field names/defaults/options from the page, not a duplicate fixture.
const inputs = [...html.matchAll(/<input\b[^>]*data-number[^>]*>/g)].map(([tag]) => {
  const attr = name => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
  const input = get(attr('id'));
  Object.assign(input, { name: attr('name'), value: attr('value'), type: 'text' });
  input.dataset = { decimals: attr('data-decimals'), preserveRaw: attr('data-preserve-raw') };
  assert.equal(input.dataset.preserveRaw, 'true', input.id);
  return input;
});
assert.equal(inputs.length, 12);
const repayment = get('repayment-form');
const refinance = get('refinance-form');
const method = get('repayment-method');
Object.assign(method, { name: 'method', value: 'annuity', type: 'select-one' });
repayment.elements = [...inputs.filter(x => !x.id.startsWith('ref-')), method];
refinance.elements = inputs.filter(x => x.id.startsWith('ref-'));
const panels = ['repayment', 'refinance'].map(tab => {
  const panel = get(tab + '-panel');
  panel.dataset.panel = tab;
  return panel;
});
const ready = [];
const document = {
  readyState: 'loading',
  addEventListener(type, fn) { if (type === 'DOMContentLoaded') ready.push(fn); },
  getElementById: get,
  querySelectorAll(selector) { return selector === '[data-number]' ? inputs : selector === '[data-panel]' ? panels : []; },
  createElement() { return element(); },
  createDocumentFragment() { return element(); },
};
const window = { location: { href: 'https://example.test/loan/', search: '' }, history: { replaceState() {} } };
const context = vm.createContext({ window, document, URL, URLSearchParams });
for (const file of ['constants-2026.js', 'common.js', 'loan.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context);
}
ready.forEach(fn => fn());
const common = window.MoneyCalc;
const calc = window.MoneyCalcCalculators.loan;
const constants = window.CALC_CONSTANTS_2026.LOAN;
function inputEvent(input, value, form) {
  input.value = value;
  input.dispatch('input'); // Target listener before the bubbling form listener.
  form.dispatch('input');
}
function printRaw(tab) {
  const keys = tab === 'repayment'
    ? ['principal', 'annualRate', 'termMonths', 'graceMonths']
    : ['principal', 'existingAnnualRate', 'existingRemainingMonths', 'prepaymentFeeRate',
      'monthsUntilWaiver', 'newAnnualRate', 'newTermMonths', 'setupCost'];
  const fields = tab === 'repayment' ? repayment.elements.slice(0, 4) : refinance.elements;
  return Object.assign(Object.fromEntries(keys.map((key, i) => [key, fields[i].value])), { method: method.value });
}
for (const [id, form, tab] of [
  ['term-months', repayment, 'repayment'],
  ['ref-old-months', refinance, 'refinance'],
  ['ref-new-months', refinance, 'refinance'],
]) {
  const input = get(id);
  for (const text of ['-1', '1.5', '1e3', '', '0', 'NaN', 'Infinity', String(constants.MAX_TERM_MONTHS + 1)]) {
    inputEvent(input, text, form);
    input.dispatch('blur');
    assert.equal(input.value, text, `${id} input/blur must preserve ${text}`);
    assert.equal(get(tab + '-panel').querySelector().hidden, true);
    assert.equal(get(tab + '-input-error').hidden, false);
    if (tab === 'repayment') {
      assert.equal(get('schedule-details').hidden, true);
      assert.equal(get('schedule-count').textContent, '0');
    }
    assert.match(summary(tab, printRaw(tab), calc, constants), /계산 불가/);
    const saved = common.formToParams(form);
    input.value = '36';
    common.restoreForm(form, saved);
    form.dispatch('change');
    assert.equal(input.value, text, `${id} share/restore must preserve ${text}`);
    assert.equal(get(tab + '-panel').querySelector().hidden, true);
  }
  inputEvent(input, '36', form);
  assert.equal(get(tab + '-panel').querySelector().hidden, false);
  assert.equal(get(tab + '-input-error').hidden, true);
  assert.doesNotMatch(summary(tab, printRaw(tab), calc, constants), /계산 불가/);
}
inputEvent(get('annual-rate'), '0', repayment);
assert.equal(get('repayment-total-interest').textContent, '0원');
assert.equal(get('schedule-details').hidden, false);
for (const text of ['-4', '1e3', '4.12345', '300,000', '']) {
  for (const input of inputs) {
    common.restoreForm({ elements: [input] }, new URLSearchParams([[input.name, text]]));
    input.dispatch('input');
    input.dispatch('blur');
    assert.equal(input.value, text);
    assert.equal(common.formToParams({ elements: [input] }).get(input.name), text);
  }
}
// Non-opt-in calculators keep their previous setup/input/blur/restore formatting.
for (const preserveRaw of [undefined, 'false']) {
  const legacy = element();
  Object.assign(legacy, { name: 'amount', type: 'text', value: '1234' });
  legacy.dataset = { decimals: '0', preserveRaw };
  common.setupNumericInputs({ querySelectorAll() { return [legacy]; } });
  assert.equal(legacy.value, '1,234');
  for (const [raw, expected] of [['-1', '1'], ['1.5', '1'], ['1e3', '13'], ['12345', '12,345']]) {
    legacy.value = raw;
    legacy.dispatch('input');
    assert.equal(legacy.value, expected);
    legacy.value = raw;
    legacy.dispatch('blur');
    assert.equal(legacy.value, expected);
    common.restoreForm({ elements: [legacy] }, new URLSearchParams({ amount: raw }));
    assert.equal(legacy.value, expected);
  }
  assert.equal(common.formToParams({ elements: [legacy] }).get('amount'), '12345');
}
console.log('loan raw input: real common setup/input/blur/restore, screen/print rejection, recovery, no clamp, legacy compatibility passed');
