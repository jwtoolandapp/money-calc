const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const listeners = {}, classes = new Set();
let report, button, count = 0, current = '입력: 4000 mm', printed = 0;
const doc = {
  createElement() { return { addEventListener(event, fn) { this[event] = fn; } }; },
  querySelector() { return { href: 'https://example.test/calculator/' }; },
  body: {
    appendChild(node) { report = node; },
    classList: { add: value => classes.add(value), remove: value => classes.delete(value) }
  }
};
const window = { document: doc, location: { href: 'http://localhost/' },
  addEventListener: (event, fn) => { listeners[event] = fn; },
  print: () => { printed++; } };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/calculation-print.js'), 'utf8'), { window });
window.CalculationPrint.mount({ className: 'button', insertAdjacentElement(where, node) { button = node; } },
  () => { count++; return current; });
assert.equal(button.type, 'button');
button.click();
assert.equal(printed, 1);
assert.match(report.textContent, /4000 mm/);
assert.match(report.textContent, /출처: https:\/\/example.test\/calculator\//);
assert.equal(classes.has('printing-calculation'), true);
listeners.afterprint();
assert.equal(classes.size, 0);
current = '<script>사용자 입력</script> 미입력';
listeners.beforeprint();
assert.match(report.textContent, /<script>사용자 입력<\/script> 미입력/);
assert.equal(report.innerHTML, undefined);
assert.equal(count, 2);
listeners.afterprint();
assert.equal(classes.size, 0);
console.log('print lifecycle: fresh snapshot, Ctrl+P, text safety, afterprint cleanup passed');

