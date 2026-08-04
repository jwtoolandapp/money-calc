(function (global) {
  'use strict';

  const C = global.CALC_CONSTANTS_2026;
  const MoneyCalc = global.MoneyCalc;

  if (!C || !MoneyCalc) return;

  const ZERO = C.MATH.ZERO;
  const ONE = C.MATH.ONE;
  const HUNDRED = C.MATH.HUNDRED;
  const STOCK = C.STOCK_AVERAGE;

  function valueFrom(object, primaryKey, fallbackKey) {
    if (!object) return undefined;
    return object[primaryKey] != null ? object[primaryKey] : object[fallbackKey];
  }

  function nonNegativeNumber(value) {
    return Math.max(ZERO, MoneyCalc.parseNumber(value));
  }

  function hasNumericValue(value) {
    if (value == null) return false;
    return typeof value === 'number' || String(value).replace(/,/g, '').trim() !== '';
  }

  function calculateAverage(options) {
    const input = options || {};
    const initialQuantity = nonNegativeNumber(valueFrom(input, 'initialQuantity', 'q1'));
    const initialPrice = nonNegativeNumber(valueFrom(input, 'initialPrice', 'p1'));
    const purchases = Array.isArray(input.purchases) ? input.purchases : [];
    let totalQuantity = initialQuantity;
    let totalInvestment = initialQuantity * initialPrice;

    purchases.forEach((purchase) => {
      const quantity = nonNegativeNumber(valueFrom(purchase, 'quantity', 'q2'));
      const price = nonNegativeNumber(valueFrom(purchase, 'price', 'p2'));
      totalQuantity += quantity;
      totalInvestment += quantity * price;
    });

    const averagePrice = totalQuantity > ZERO ? totalInvestment / totalQuantity : ZERO;
    const currentPriceInput = valueFrom(input, 'currentPrice', 'current');
    const hasCurrentPrice = hasNumericValue(currentPriceInput);
    const currentPrice = hasCurrentPrice ? nonNegativeNumber(currentPriceInput) : ZERO;
    const currentValue = hasCurrentPrice ? totalQuantity * currentPrice : ZERO;
    const profit = hasCurrentPrice ? currentValue - totalInvestment : ZERO;
    const returnRate = hasCurrentPrice && totalInvestment > ZERO
      ? (profit / totalInvestment) * HUNDRED
      : ZERO;

    return {
      initialQuantity,
      initialPrice,
      totalQuantity,
      totalInvestment,
      averagePrice,
      hasCurrentPrice,
      currentPrice,
      currentValue,
      profit,
      returnRate,
    };
  }

  function isTargetReachable(initialPriceOrOptions, targetAverageValue, purchasePriceValue) {
    const options = typeof initialPriceOrOptions === 'object'
      ? initialPriceOrOptions || {}
      : {
          initialPrice: initialPriceOrOptions,
          targetAverage: targetAverageValue,
          purchasePrice: purchasePriceValue,
        };
    const initialPrice = nonNegativeNumber(valueFrom(options, 'initialPrice', 'p1'));
    const targetAverage = nonNegativeNumber(valueFrom(options, 'targetAverage', 'target'));
    const purchasePrice = nonNegativeNumber(valueFrom(options, 'purchasePrice', 'p2'));

    return purchasePrice < targetAverage
      && targetAverage < initialPrice
      && targetAverage - purchasePrice > STOCK.TARGET_EPSILON;
  }

  function calculateTarget(options) {
    const input = options || {};
    const initialQuantity = nonNegativeNumber(valueFrom(input, 'initialQuantity', 'q1'));
    const initialPrice = nonNegativeNumber(valueFrom(input, 'initialPrice', 'p1'));
    const targetAverage = nonNegativeNumber(valueFrom(input, 'targetAverage', 'target'));
    const purchasePrice = nonNegativeNumber(valueFrom(input, 'purchasePrice', 'p2'));
    const holdingIsValid = initialQuantity > ZERO && initialPrice > ZERO;
    const priceRuleIsValid = isTargetReachable({ initialPrice, targetAverage, purchasePrice });
    const reachable = holdingIsValid && priceRuleIsValid;
    const requiredQuantityRaw = reachable
      ? initialQuantity * (initialPrice - targetAverage) / (targetAverage - purchasePrice)
      : ZERO;
    const requestedDigits = Number.parseInt(input.quantityDigits, C.MATH.DECIMAL_BASE);
    const hasQuantityPrecision = Number.isInteger(requestedDigits) && requestedDigits >= ZERO;
    const quantityScale = hasQuantityPrecision
      ? Math.pow(C.MATH.DECIMAL_BASE, requestedDigits)
      : ONE;
    const requiredQuantity = reachable && hasQuantityPrecision
      ? Math.ceil(requiredQuantityRaw * quantityScale - STOCK.TARGET_EPSILON) / quantityScale
      : requiredQuantityRaw;
    const requiredInvestment = requiredQuantity * purchasePrice;
    const totalQuantity = initialQuantity + requiredQuantity;
    const totalInvestment = initialQuantity * initialPrice + requiredInvestment;
    const averagePrice = totalQuantity > ZERO ? totalInvestment / totalQuantity : ZERO;
    const currentPriceInput = valueFrom(input, 'currentPrice', 'current');
    const hasCurrentPrice = reachable && hasNumericValue(currentPriceInput);
    const currentPrice = hasCurrentPrice ? nonNegativeNumber(currentPriceInput) : ZERO;
    const currentValue = hasCurrentPrice ? totalQuantity * currentPrice : ZERO;
    const profit = hasCurrentPrice ? currentValue - totalInvestment : ZERO;
    const returnRate = hasCurrentPrice && totalInvestment > ZERO
      ? (profit / totalInvestment) * HUNDRED
      : ZERO;

    return {
      reachable,
      reason: holdingIsValid ? (priceRuleIsValid ? '' : 'price-rule') : 'holding',
      initialQuantity,
      initialPrice,
      targetAverage,
      purchasePrice,
      requiredQuantityRaw,
      requiredQuantity,
      wasQuantityRounded: Math.abs(requiredQuantity - requiredQuantityRaw) > STOCK.TARGET_EPSILON,
      requiredInvestment,
      totalQuantity,
      totalInvestment,
      averagePrice,
      hasCurrentPrice,
      currentPrice,
      currentValue,
      profit,
      returnRate,
    };
  }

  global.MoneyCalcCalculators = global.MoneyCalcCalculators || {};
  global.MoneyCalcCalculators.stockAverage = Object.freeze({
    calculateAverage,
    calculateTarget,
    isTargetReachable,
  });

  if (!global.document) return;

  function initStockAverageCalculator() {
    const form = document.getElementById('stock-average-form');
    if (!form) return;

    const modeButtons = Array.from(form.querySelectorAll('[data-mode]'));
    const assetButtons = Array.from(form.querySelectorAll('[data-asset]'));
    const averageFields = document.getElementById('average-mode-fields');
    const targetFields = document.getElementById('target-mode-fields');
    const purchaseRows = document.getElementById('purchase-rows');
    const addPurchaseButton = document.getElementById('add-purchase-row');
    const resultLabel = document.getElementById('result-heading');
    const resultValue = document.getElementById('result-value');
    const resultSummary = document.getElementById('result-summary');
    const resultDetails = document.getElementById('result-details');
    const resultStatus = document.getElementById('result-status');
    const copyButton = document.getElementById('copy-result-link');
    const state = { mode: 'average', asset: 'krw' };
    let purchaseRowSequence = ZERO;
    let latestShareUrl = global.location.href;

    function assetConfig() {
      return STOCK.ASSET_TYPES[state.asset] || STOCK.ASSET_TYPES.krw;
    }

    function quantityUnit() {
      return state.asset === 'coin' ? '개' : '주';
    }

    function rawInputValue(element) {
      return element ? String(element.value).replace(/,/g, '') : '';
    }

    function setInputValueFromParam(element, params, key) {
      if (element && params.has(key)) element.value = params.get(key);
    }

    function createPurchaseRow(quantity, price) {
      purchaseRowSequence += ONE;
      const row = document.createElement('div');
      const quantityId = `purchase-quantity-${purchaseRowSequence}`;
      const priceId = `purchase-price-${purchaseRowSequence}`;
      row.className = 'purchase-row';
      row.dataset.purchaseRow = 'true';
      row.innerHTML = `
        <div class="field">
          <label for="${quantityId}">추가 수량 <span data-row-number></span></label>
          <div class="input-wrap">
            <input id="${quantityId}" name="q2" type="text" inputmode="numeric" data-number data-quantity-input aria-label="추가 매수 수량">
            <span class="unit" data-quantity-unit>주</span>
          </div>
        </div>
        <div class="field">
          <label for="${priceId}">매수 가격 <span data-row-number></span></label>
          <div class="input-wrap">
            <input id="${priceId}" name="p2" type="text" inputmode="numeric" data-number data-price-input aria-label="추가 매수 가격">
            <span class="unit" data-money-unit>원</span>
          </div>
        </div>
        <button class="remove-row" type="button" data-remove-purchase>행 삭제</button>
      `;
      row.querySelector('[name="q2"]').value = quantity == null ? '' : quantity;
      row.querySelector('[name="p2"]').value = price == null ? '' : price;
      purchaseRows.appendChild(row);
      applyAssetPresentation(row);
      MoneyCalc.setupNumericInputs(row);
      updatePurchaseRowLabels();
      return row;
    }

    function updatePurchaseRowLabels() {
      const rows = Array.from(purchaseRows.querySelectorAll('[data-purchase-row]'));
      rows.forEach((row, index) => {
        row.querySelectorAll('[data-row-number]').forEach((label) => {
          label.textContent = `${index + ONE}차`;
        });
        const removeButton = row.querySelector('[data-remove-purchase]');
        removeButton.hidden = rows.length <= STOCK.MIN_PURCHASE_ROWS;
        removeButton.setAttribute('aria-label', `${index + ONE}차 추가 매수행 삭제`);
      });
    }

    function applyAssetPresentation(root) {
      const scope = root || document;
      const config = assetConfig();

      scope.querySelectorAll('[data-price-input]').forEach((input) => {
        input.dataset.decimals = String(config.priceDigits);
        input.inputMode = config.priceDigits > ZERO ? 'decimal' : 'numeric';
        MoneyCalc.formatNumericInput(input);
      });
      scope.querySelectorAll('[data-quantity-input]').forEach((input) => {
        input.dataset.decimals = String(config.quantityDigits);
        input.inputMode = config.quantityDigits > ZERO ? 'decimal' : 'numeric';
        MoneyCalc.formatNumericInput(input);
      });
      scope.querySelectorAll('[data-money-unit]').forEach((unit) => {
        unit.textContent = config.moneyUnit;
      });
      scope.querySelectorAll('[data-quantity-unit]').forEach((unit) => {
        unit.textContent = quantityUnit();
      });
    }

    function applyModePresentation() {
      modeButtons.forEach((button) => {
        button.setAttribute('aria-pressed', button.dataset.mode === state.mode ? 'true' : 'false');
      });
      MoneyCalc.setHidden(averageFields, state.mode !== 'average');
      MoneyCalc.setHidden(targetFields, state.mode !== 'target');
    }

    function applyAssetButtons() {
      assetButtons.forEach((button) => {
        button.setAttribute('aria-pressed', button.dataset.asset === state.asset ? 'true' : 'false');
      });
    }

    function formatMoney(value) {
      const config = assetConfig();
      return `${MoneyCalc.formatNumber(value, config.priceDigits)}${config.moneyUnit}`;
    }

    function formatQuantity(value) {
      return `${MoneyCalc.formatNumber(value, assetConfig().quantityDigits)}${quantityUnit()}`;
    }

    function renderDetailRows(rows) {
      resultDetails.replaceChildren();
      rows.forEach((item) => {
        const wrapper = document.createElement('div');
        const term = document.createElement('dt');
        const description = document.createElement('dd');
        wrapper.className = 'result-row';
        term.textContent = item.label;
        description.textContent = item.value;
        if (item.className) description.classList.add(item.className);
        wrapper.append(term, description);
        resultDetails.appendChild(wrapper);
      });
    }

    function setStatus(message, isError) {
      resultStatus.textContent = message || '';
      resultStatus.classList.toggle('error', Boolean(isError));
      MoneyCalc.setHidden(resultStatus, !message);
    }

    function profitClass(profit) {
      if (profit > ZERO) return 'positive';
      if (profit < ZERO) return 'negative';
      return '';
    }

    function currentPriceValue() {
      return rawInputValue(document.getElementById('current-price'));
    }

    function readPurchases() {
      return Array.from(purchaseRows.querySelectorAll('[data-purchase-row]')).map((row) => ({
        quantity: rawInputValue(row.querySelector('[name="q2"]')),
        price: rawInputValue(row.querySelector('[name="p2"]')),
      }));
    }

    function renderAverageResult() {
      const result = calculateAverage({
        initialQuantity: rawInputValue(document.getElementById('initial-quantity')),
        initialPrice: rawInputValue(document.getElementById('initial-price')),
        purchases: readPurchases(),
        currentPrice: currentPriceValue(),
      });
      const details = [
        { label: '총 보유 수량', value: formatQuantity(result.totalQuantity) },
        { label: '총 투자금', value: formatMoney(result.totalInvestment) },
      ];

      resultLabel.textContent = '새 평균 단가';
      if (result.totalQuantity <= ZERO) {
        resultValue.textContent = '입력 필요';
        resultSummary.textContent = '보유 수량 또는 추가 매수 수량을 입력해 주세요.';
        setStatus('계산하려면 수량을 0보다 크게 입력해 주세요.', true);
      } else {
        resultValue.textContent = formatMoney(result.averagePrice);
        resultSummary.textContent = `총 ${formatQuantity(result.totalQuantity)}를 보유하게 됩니다.`;
        setStatus('', false);
      }

      if (result.hasCurrentPrice) {
        details.push(
          { label: '현재 평가금액', value: formatMoney(result.currentValue) },
          { label: '평가 손익', value: formatMoney(result.profit), className: profitClass(result.profit) },
          { label: '수익률', value: MoneyCalc.formatPercent(result.returnRate, C.MATH.RATE_DISPLAY_DIGITS), className: profitClass(result.profit) }
        );
      }
      renderDetailRows(details);
    }

    function renderTargetResult() {
      const result = calculateTarget({
        initialQuantity: rawInputValue(document.getElementById('initial-quantity')),
        initialPrice: rawInputValue(document.getElementById('initial-price')),
        targetAverage: rawInputValue(document.getElementById('target-average')),
        purchasePrice: rawInputValue(document.getElementById('target-purchase-price')),
        quantityDigits: assetConfig().quantityDigits,
        currentPrice: currentPriceValue(),
      });

      resultLabel.textContent = '목표 평단에 필요한 추가 수량';
      if (!result.reachable) {
        resultValue.textContent = '도달 불가';
        resultSummary.textContent = '입력값으로는 목표 평단을 만들 수 없습니다.';
        renderDetailRows([
          { label: '현재 보유 수량', value: formatQuantity(result.initialQuantity) },
          { label: '현재 평단', value: formatMoney(result.initialPrice) },
          { label: '입력한 목표 평단', value: formatMoney(result.targetAverage) },
        ]);
        setStatus(
          result.reason === 'holding'
            ? '보유 수량과 현재 평단을 0보다 크게 입력해 주세요.'
            : '추가 매수 예정가는 목표 평단보다 낮고, 목표 평단은 현재 평단보다 낮아야 합니다. (예정가 < 목표 평단 < 현재 평단)',
          true
        );
        return;
      }

      const details = [
        { label: '필요 매수 금액', value: formatMoney(result.requiredInvestment) },
        { label: '매수 후 총 수량', value: formatQuantity(result.totalQuantity) },
        { label: '매수 후 총 투자금', value: formatMoney(result.totalInvestment) },
        { label: '예상 평단', value: formatMoney(result.averagePrice) },
      ];
      resultValue.textContent = formatQuantity(result.requiredQuantity);
      resultSummary.textContent = result.wasQuantityRounded
        ? `${formatMoney(result.purchasePrice)}에 실제 매수 가능한 단위로 올림한 계산값입니다.`
        : `${formatMoney(result.purchasePrice)}에 추가 매수할 때의 계산값입니다.`;
      setStatus('', false);

      if (result.hasCurrentPrice) {
        details.push(
          { label: '매수 후 현재 평가금액', value: formatMoney(result.currentValue) },
          { label: '매수 후 평가 손익', value: formatMoney(result.profit), className: profitClass(result.profit) },
          { label: '매수 후 수익률', value: MoneyCalc.formatPercent(result.returnRate, C.MATH.RATE_DISPLAY_DIGITS), className: profitClass(result.profit) }
        );
      }
      renderDetailRows(details);
    }

    function serializeState() {
      const params = new URLSearchParams();
      params.set('mode', state.mode);
      params.set('asset', state.asset);
      params.set('q1', rawInputValue(document.getElementById('initial-quantity')));
      params.set('p1', rawInputValue(document.getElementById('initial-price')));
      readPurchases().forEach((purchase) => {
        params.append('q2', purchase.quantity);
        params.append('p2', purchase.price);
      });
      params.set('target', rawInputValue(document.getElementById('target-average')));
      params.set('targetPrice', rawInputValue(document.getElementById('target-purchase-price')));
      params.set('currentPrice', currentPriceValue());
      return params;
    }

    function calculateAndRender() {
      if (state.mode === 'target') renderTargetResult();
      else renderAverageResult();
      latestShareUrl = MoneyCalc.setQuery(serializeState());
    }

    function restoreFromQuery() {
      const params = MoneyCalc.queryParams();
      if (![...params.keys()].length) return false;

      if (['average', 'target'].includes(params.get('mode'))) state.mode = params.get('mode');
      if (Object.prototype.hasOwnProperty.call(STOCK.ASSET_TYPES, params.get('asset'))) {
        state.asset = params.get('asset');
      }
      setInputValueFromParam(document.getElementById('initial-quantity'), params, 'q1');
      setInputValueFromParam(document.getElementById('initial-price'), params, 'p1');
      setInputValueFromParam(document.getElementById('target-average'), params, 'target');
      setInputValueFromParam(document.getElementById('target-purchase-price'), params, 'targetPrice');
      setInputValueFromParam(document.getElementById('current-price'), params, 'currentPrice');

      const quantities = params.getAll('q2');
      const prices = params.getAll('p2');
      if (quantities.length || prices.length) {
        purchaseRows.replaceChildren();
        const rowCount = Math.max(STOCK.MIN_PURCHASE_ROWS, quantities.length, prices.length);
        for (let index = ZERO; index < rowCount; index += ONE) {
          createPurchaseRow(quantities[index] == null ? '' : quantities[index], prices[index] == null ? '' : prices[index]);
        }
      }
      return true;
    }

    createPurchaseRow('100', '5000');
    restoreFromQuery();
    applyModePresentation();
    applyAssetButtons();
    applyAssetPresentation(document);
    MoneyCalc.setupNumericInputs(document);
    updatePurchaseRowLabels();

    modeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        state.mode = button.dataset.mode;
        applyModePresentation();
        calculateAndRender();
      });
    });

    assetButtons.forEach((button) => {
      button.addEventListener('click', () => {
        state.asset = button.dataset.asset;
        applyAssetButtons();
        applyAssetPresentation(document);
        calculateAndRender();
      });
    });

    addPurchaseButton.addEventListener('click', () => {
      const row = createPurchaseRow('', '');
      const firstInput = row.querySelector('input');
      if (firstInput) firstInput.focus();
      calculateAndRender();
    });

    purchaseRows.addEventListener('click', (event) => {
      const removeButton = event.target.closest('[data-remove-purchase]');
      if (!removeButton) return;
      const rows = purchaseRows.querySelectorAll('[data-purchase-row]');
      if (rows.length <= STOCK.MIN_PURCHASE_ROWS) return;
      removeButton.closest('[data-purchase-row]').remove();
      updatePurchaseRowLabels();
      calculateAndRender();
    });

    form.addEventListener('input', calculateAndRender);
    form.addEventListener('change', calculateAndRender);
    MoneyCalc.bindCopyLink(copyButton, () => latestShareUrl);
    calculateAndRender();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStockAverageCalculator);
  } else {
    initStockAverageCalculator();
  }
})(window);
