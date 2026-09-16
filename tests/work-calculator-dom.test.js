'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');

class FakeElement {
  constructor(options) { Object.assign(this, { value:'', checked:false, hidden:false, textContent:'', innerHTML:'', attributes:{}, listeners:{} }, options || {}); }
  addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
  dispatch(type) { (this.listeners[type] || []).forEach((handler) => handler({ target:this, type })); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
}

function boot(options) {
  const elements = {};
  Object.entries(options.elements).forEach(([id, values]) => { elements[id] = new FakeElement(values); });
  const form = elements[options.formId];
  form.querySelectorAll = (selector) => options.groups[selector] || [];
  let replacedUrl = '';
  const context = {
    console, URLSearchParams,
    location:{ origin:'https://money.jwapplab.com', pathname:'/' + options.slug + '/', search:options.search || '' },
    history:{ replaceState(_a,_b,url) { replacedUrl = url; } },
    navigator:{ clipboard:{ writeText() { return Promise.resolve(); } } },
    setTimeout(fn) { fn(); },
    document:{ getElementById(id) { return elements[id] || null; } },
  };
  context.window = context;
  vm.createContext(context);
  ['js/constants-2026.js', options.logic, options.controller].forEach((file) => vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename:file }));
  return { elements, form, context, getReplacedUrl:() => replacedUrl };
}

function annual(search) {
  const conditions = [new FakeElement({ value:'underOneYear' }), new FakeElement({ value:'overOneYear80OrMore', checked:true }), new FakeElement({ value:'overOneYearUnder80' })];
  return boot({ slug:'annual-leave-pay', search, formId:'annual-leave-form', logic:'js/annual-leave-pay.js', controller:'js/annual-leave-pay-page.js',
    groups:{ 'input[name="al-condition"]':conditions }, elements:{
      'annual-leave-form':{}, 'al-wage':{value:'2090000'}, 'al-years':{value:'1'}, 'al-used':{value:'0'}, 'al-months':{value:'0'},
      'al-monthly-hours':{value:'209'}, 'al-daily-hours':{value:'8'}, 'al-months-field':{}, 'al-months-label':{}, 'al-years-field':{},
      'al-value':{}, 'al-summary':{}, 'al-details':{}, 'al-input-error':{hidden:true}, 'copy-al-link':{}
    }
  });
}

const annualPage = annual('');
annualPage.context.document.getElementById('annual-leave-form').querySelectorAll('input[name="al-condition"]')[1].checked = false;
annualPage.context.document.getElementById('annual-leave-form').querySelectorAll('input[name="al-condition"]')[2].checked = true;
annualPage.elements['al-months'].value = '7'; annualPage.form.dispatch('change');
assert.match(annualPage.elements['al-summary'].textContent, /발생 7일/);
annualPage.elements['al-used'].value = '9'; annualPage.form.dispatch('input');
assert.equal(annualPage.elements['al-input-error'].hidden, false); assert.match(annualPage.elements['al-input-error'].textContent, /2일 많습니다/);
annualPage.elements['copy-al-link'].dispatch('click');
const annualUrl = new URL(annualPage.getReplacedUrl());
const annualRestored = annual(annualUrl.search);
assert.equal(annualRestored.elements['al-months'].value, '7'); assert.match(annualRestored.elements['al-summary'].textContent, /발생 7일/);

function minimum(search) {
  const modes = [new FakeElement({ value:'hourly', checked:true }), new FakeElement({ value:'monthly' })];
  return boot({ slug:'minimum-wage', search, formId:'minimum-wage-form', logic:'js/minimum-wage.js', controller:'js/minimum-wage-page.js', groups:{ 'input[name="mw-mode"]':modes }, elements:{
    'minimum-wage-form':{}, 'mw-amount':{value:'10320'}, 'mw-weekly-scheduled':{value:'40'}, 'mw-weekly-paid':{value:'8'}, 'mw-hours-fields':{},
    'mw-amount-label':{}, 'mw-value':{}, 'mw-summary':{}, 'mw-details':{}, 'copy-mw-link':{}
  }});
}
const minimumPage = minimum('');
assert.equal(minimumPage.elements['mw-amount'].placeholder, '10320'); assert.equal(minimumPage.elements['mw-amount'].step, '1');
const minimumModes = minimumPage.form.querySelectorAll('input[name="mw-mode"]'); minimumModes[0].checked=false; minimumModes[1].checked=true;
minimumPage.elements['mw-amount'].value='2156880'; minimumPage.form.dispatch('change');
assert.equal(minimumPage.elements['mw-amount-label'].textContent, '최저임금 산입 대상 월 임금');
assert.equal(minimumPage.elements['mw-amount'].placeholder, '2156880'); assert.equal(minimumPage.elements['mw-hours-fields'].hidden, false);
assert.match(minimumPage.elements['mw-details'].innerHTML, /209시간/); assert.equal(minimumPage.elements['mw-value'].textContent, '최저임금 충족');
minimumPage.elements['copy-mw-link'].dispatch('click');
const minimumRestored = minimum(new URL(minimumPage.getReplacedUrl()).search);
assert.equal(minimumRestored.elements['mw-amount-label'].textContent, '최저임금 산입 대상 월 임금'); assert.equal(minimumRestored.elements['mw-value'].textContent, '최저임금 충족');

function overtime(search) {
  return boot({ slug:'overtime-pay', search, formId:'overtime-form', logic:'js/overtime-pay.js', controller:'js/overtime-pay-page.js', groups:{}, elements:{
    'overtime-form':{}, 'ot-wage':{value:'2090000'}, 'ot-monthly-hours':{value:'209'}, 'ot-weekday-overtime':{value:'2'}, 'ot-weekday-night':{value:'3'},
    'ot-holiday':{value:'8.5'}, 'ot-holiday-night':{value:'0.5'}, 'ot-small':{}, 'ot-value':{}, 'ot-summary':{}, 'ot-details':{},
    'ot-input-error':{hidden:true}, 'copy-ot-link':{}
  }});
}
const overtimePage = overtime('');
assert.equal(overtimePage.elements['ot-input-error'].hidden, false); assert.equal(overtimePage.elements['ot-weekday-night'].attributes['aria-invalid'], 'true');
overtimePage.elements['ot-weekday-night'].value='1'; overtimePage.form.dispatch('input');
assert.equal(overtimePage.elements['ot-input-error'].hidden, true); assert.notEqual(overtimePage.elements['ot-value'].textContent, '—');
overtimePage.elements['copy-ot-link'].dispatch('click');
const overtimeRestored = overtime(new URL(overtimePage.getReplacedUrl()).search);
assert.equal(overtimeRestored.elements['ot-weekday-night'].value, '1'); assert.equal(overtimeRestored.elements['ot-value'].textContent, overtimePage.elements['ot-value'].textContent);

function vat(search) {
  return boot({ slug:'vat', search, formId:'vat-form', logic:'js/vat.js', controller:'js/vat-page.js', groups:{}, elements:{
    'vat-form':{}, 'vat-amount':{value:'101'}, 'vat-included':{checked:true}, 'vat-value':{}, 'vat-summary':{}, 'vat-details':{}, 'copy-vat-link':{}
  }});
}
const vatPage = vat(''); vatPage.elements['copy-vat-link'].dispatch('click');
const vatRestored = vat(new URL(vatPage.getReplacedUrl()).search);
assert.equal(vatRestored.elements['vat-value'].textContent, vatPage.elements['vat-value'].textContent);
assert.equal(vatRestored.elements['vat-details'].innerHTML, vatPage.elements['vat-details'].innerHTML);

function plain(text) { return text.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim(); }
['annual-leave-pay','minimum-wage','overtime-pay','vat'].forEach((slug) => {
  const html = fs.readFileSync(path.join(ROOT, slug, 'index.html'), 'utf8');
  const json = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const visible = Array.from(html.matchAll(/<article class="faq-item"><h3>([\s\S]*?)<\/h3><p>([\s\S]*?)<\/p><\/article>/g), (m) => [plain(m[1]), plain(m[2])]);
  const structured = json.mainEntity.map((item) => [item.name, item.acceptedAnswer.text]);
  assert.deepEqual(visible, structured, slug + ' FAQ/JSON-LD mismatch');
});

console.log('work calculator DOM/share/FAQ tests: PASS');
