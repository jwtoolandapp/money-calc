const assert = require('node:assert/strict');
const { freshness } = require('../js/rate-freshness.js');
const now = Date.parse('2026-10-12T00:00:00Z');
assert.equal(freshness('2026-08-10', now), 'stale');
assert.equal(freshness('2026-09-28', now), 'delayed');
assert.equal(freshness('2026-09-27', now), 'stale');
assert.equal(freshness('2026-10-13', now), 'unknown');
for (const date of ['', 'invalid', '2026-02-30']) assert.equal(freshness(date, now), 'unknown');
console.log('rate freshness: 7 cases passed');
