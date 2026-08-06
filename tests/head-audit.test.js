'use strict';

// Guards the <head> tags that are easy to lose when a page is rewritten:
// the AdSense loader, canonical, the icon set, and the Naver verification tag.
// Run with: node tests/head-audit.test.js

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE_ORIGIN = 'https://money.jwapplab.com';
const ADSENSE_SRC =
  'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7773099210940024';
const SKIP_DIRS = new Set(['tests', 'node_modules', 'design-preview', 'content']);

const htmlFiles = [];
(function walk(directory) {
  fs.readdirSync(directory, { withFileTypes: true }).forEach(function (entry) {
    if (entry.name.startsWith('.') || entry.name.startsWith('_') || SKIP_DIRS.has(entry.name)) return;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (entry.name.endsWith('.html')) htmlFiles.push(fullPath);
  });
})(ROOT);

// sitemap.xml is the single source of truth for public URLs. Canonicals are
// checked against it rather than derived from filenames, because Cloudflare
// Pages serves clean URLs (/about, not /about.html) and the two must agree.
const sitemapUrls = new Set(
  Array.from(
    fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g),
    function (m) { return m[1].trim(); }
  )
);

// 404.html is intentionally noindex: no canonical, and serving ads on an error
// page is against AdSense policy.
const NOINDEX_PAGES = new Set(['404.html']);

const failures = [];

htmlFiles.forEach(function (file) {
  const text = fs.readFileSync(file, 'utf8');
  const relative = path.relative(ROOT, file);

  const noindex = NOINDEX_PAGES.has(relative.split(path.sep).join('/'));
  const adsense = Array.from(text.matchAll(/<script\b[^>]*src=["']([^"']*adsbygoogle\.js[^"']*)["']/gi));
  const canonical = text.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);

  if (noindex) {
    if (adsense.length) failures.push(relative + ': noindex page must not load AdSense');
    if (canonical) failures.push(relative + ': noindex page must not declare a canonical');
    if (!/content=["'][^"']*noindex/i.test(text)) failures.push(relative + ': expected a noindex robots meta');
  } else {
    if (adsense.length !== 1) {
      failures.push(relative + ': expected exactly 1 AdSense script tag, found ' + adsense.length);
    } else if (!adsense[0][1].startsWith(ADSENSE_SRC)) {
      failures.push(relative + ': AdSense script has the wrong publisher id — ' + adsense[0][1]);
    }

    if (!canonical) {
      failures.push(relative + ': missing <link rel="canonical">');
    } else if (!canonical[1].startsWith(SITE_ORIGIN)) {
      failures.push(relative + ': canonical points off-site — ' + canonical[1]);
    } else if (!sitemapUrls.has(canonical[1])) {
      failures.push(relative + ': canonical ' + canonical[1] + ' is not listed in sitemap.xml');
    }

    if (!text.includes('mailto:contact@jwapplab.com')) {
      failures.push(relative + ': missing contact@jwapplab.com link');
    }

    if (!/adsense|광고/i.test(text) && relative === 'privacy.html') {
      failures.push(relative + ': privacy policy must disclose AdSense cookie use');
    }
  }

  [
    ['<link rel="icon" href="/favicon.ico"', 'favicon.ico link'],
    ['/assets/icons/favicon.svg', 'favicon.svg link'],
    ['/assets/icons/apple-touch-icon.png', 'apple-touch-icon link'],
    ['name="theme-color"', 'theme-color meta'],
  ].forEach(function (pair) {
    if (!text.includes(pair[0])) failures.push(relative + ': missing ' + pair[1]);
  });
  if (!noindex && !text.includes('rel="manifest"')) {
    failures.push(relative + ': missing web manifest link');
  }

  // Naver verifies ownership by fetching the site root, so the tag only has to
  // live on the home page — but it must never be dropped from there.
  if (relative === 'index.html' && !text.includes('naver-site-verification')) {
    failures.push(relative + ': missing Naver site verification meta');
  }
});

// Referenced icon assets must actually exist on disk.
['favicon.ico', 'site.webmanifest', 'assets/icons/favicon.svg', 'assets/icons/apple-touch-icon.png',
 'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'ads.txt'].forEach(function (asset) {
  if (!fs.existsSync(path.join(ROOT, asset))) failures.push('missing asset: ' + asset);
});

if (!htmlFiles.length) failures.push('no HTML pages found');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('PASS head audit · ' + htmlFiles.length + ' pages · AdSense, canonical, icons, manifest, Naver tag, assets on disk');
