(function (global) {
  'use strict';

  const COPY_RESET_DELAY_MS = 1800;
  let latestShareUrl = global.location ? global.location.href : '';

  function parseNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const normalized = String(value == null ? '' : value).replace(/,/g, '').replace(/[^0-9.+-]/g, '');
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function formatNumber(value, maximumFractionDigits, minimumFractionDigits) {
    const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
    const maxDigits = Number.isInteger(maximumFractionDigits) ? maximumFractionDigits : 0;
    const minDigits = Number.isInteger(minimumFractionDigits) ? minimumFractionDigits : 0;
    return new Intl.NumberFormat('ko-KR', {
      maximumFractionDigits: maxDigits,
      minimumFractionDigits: Math.min(minDigits, maxDigits),
      useGrouping: true,
    }).format(safeValue);
  }

  function formatWon(value) {
    return `${formatNumber(Math.round(parseNumber(value)), 0)}원`;
  }

  function formatPercent(value, digits) {
    return `${formatNumber(parseNumber(value), Number.isInteger(digits) ? digits : 2)}%`;
  }

  function normalizeNumericText(rawValue, decimals, allowNegative) {
    const raw = String(rawValue == null ? '' : rawValue).replace(/,/g, '');
    const negative = allowNegative && raw.trim().startsWith('-');
    const stripped = raw.replace(/[^0-9.]/g, '');
    const parts = stripped.split('.');
    const integerRaw = parts.shift() || '';
    const integer = integerRaw.replace(/^0+(?=\d)/, '') || (stripped.startsWith('.') ? '0' : integerRaw);
    const fraction = parts.join('').slice(0, decimals);
    const grouped = integer ? integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '';
    const hasDecimalPoint = decimals > 0 && raw.includes('.');
    return `${negative ? '-' : ''}${grouped}${hasDecimalPoint ? `.${fraction}` : ''}`;
  }

  function formatNumericInput(input) {
    const decimals = Number.parseInt(input.dataset.decimals || '0', 10);
    const allowNegative = input.dataset.allowNegative === 'true';
    input.value = normalizeNumericText(input.value, Number.isFinite(decimals) ? decimals : 0, allowNegative);
  }

  function setupNumericInputs(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-number]').forEach((input) => {
      if (input.dataset.numberReady === 'true') return;
      input.dataset.numberReady = 'true';
      formatNumericInput(input);
      input.addEventListener('input', () => formatNumericInput(input));
      input.addEventListener('blur', () => formatNumericInput(input));
    });
  }

  function queryParams() {
    return new URLSearchParams(global.location ? global.location.search : '');
  }

  function formToParams(form) {
    const params = new URLSearchParams();
    const elements = Array.from(form.elements || []);
    const checkboxNames = new Set(elements.filter((el) => el.name && el.type === 'checkbox').map((el) => el.name));

    elements.forEach((control) => {
      if (!control.name || control.disabled || ['button', 'submit', 'reset'].includes(control.type)) return;
      if (control.type === 'radio') {
        if (control.checked) params.set(control.name, control.value);
        return;
      }
      if (control.type === 'checkbox') {
        if (checkboxNames.has(control.name)) params.set(control.name, control.checked ? '1' : '0');
        return;
      }
      params.append(control.name, String(control.value).replace(/,/g, ''));
    });
    return params;
  }

  function restoreForm(form, params) {
    const source = params || queryParams();
    if (![...source.keys()].length) return false;

    Array.from(form.elements || []).forEach((control) => {
      if (!control.name || !source.has(control.name)) return;
      const values = source.getAll(control.name);
      if (control.type === 'radio') {
        control.checked = values.includes(control.value);
      } else if (control.type === 'checkbox') {
        control.checked = ['1', 'true', 'yes', control.value].includes(values[0]);
      } else {
        control.value = values[0];
        if (control.matches('[data-number]')) formatNumericInput(control);
      }
    });
    return true;
  }

  function makeUrl(params) {
    const url = new URL(global.location.href);
    url.search = params instanceof URLSearchParams ? params.toString() : String(params || '');
    return url.href;
  }

  function setQuery(params, replaceHistory) {
    latestShareUrl = makeUrl(params);
    if (replaceHistory === false) return latestShareUrl;
    try {
      global.history.replaceState(null, '', latestShareUrl);
    } catch (error) {
      // file:// 환경 일부 브라우저는 history 변경을 제한한다. 복사 URL에는 latestShareUrl을 사용한다.
    }
    return latestShareUrl;
  }

  function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    return copied;
  }

  async function copyText(text) {
    if (navigator.clipboard && global.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return fallbackCopy(text);
  }

  function bindCopyLink(button, getUrl) {
    if (!button || button.dataset.copyReady === 'true') return;
    button.dataset.copyReady = 'true';
    const originalLabel = button.textContent;
    button.addEventListener('click', async () => {
      const url = typeof getUrl === 'function' ? getUrl() : latestShareUrl;
      try {
        const copied = await copyText(url || global.location.href);
        if (!copied) throw new Error('Clipboard copy failed');
        button.textContent = '링크를 복사했어요';
      } catch (error) {
        button.textContent = '주소창 링크를 복사해 주세요';
      }
      global.setTimeout(() => {
        button.textContent = originalLabel;
      }, COPY_RESET_DELAY_MS);
    });
  }

  function daysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  function addMonths(date, months) {
    const source = new Date(date.getTime());
    const targetMonth = source.getMonth() + months;
    const target = new Date(source.getFullYear(), targetMonth, 1);
    target.setDate(Math.min(source.getDate(), daysInMonth(target.getFullYear(), target.getMonth())));
    return target;
  }

  function monthsBetween(start, end) {
    const from = new Date(start);
    const to = new Date(end);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return 0;
    let months = (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth();
    if (to.getDate() < from.getDate()) months -= 1;
    return Math.max(0, months);
  }

  function todayIso() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function setHidden(element, hidden) {
    if (!element) return;
    element.hidden = Boolean(hidden);
    element.setAttribute('aria-hidden', hidden ? 'true' : 'false');
  }

  global.MoneyCalc = Object.freeze({
    parseNumber,
    clamp,
    formatNumber,
    formatWon,
    formatPercent,
    formatNumericInput,
    setupNumericInputs,
    queryParams,
    formToParams,
    restoreForm,
    makeUrl,
    setQuery,
    copyText,
    bindCopyLink,
    addMonths,
    monthsBetween,
    todayIso,
    setHidden,
  });

  document.addEventListener('DOMContentLoaded', () => setupNumericInputs(document));
})(window);
