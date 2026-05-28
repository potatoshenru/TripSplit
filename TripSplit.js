const GAS_DEPLOYMENT_ID = 'AKfycbwl5D6QM-Yu-nwJVoaOz2rg48JjEa-y0Pzh0HWTTBw6S37zt46Vu3XZ-4-wEfcfP60L-g';
const GAS_WEB_APP_URL = `https://script.google.com/macros/s/${GAS_DEPLOYMENT_ID}/exec`;

const GAS_WEB_APP_URLS = [GAS_WEB_APP_URL];

console.log('TripSplit GAS endpoint:', GAS_WEB_APP_URL);

//const GAS_WEB_APP_URLS = [normalizeGasUrl(GAS_WEB_APP_URL)].filter(Boolean);

function buildGasUrl(baseUrl, query) {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}${query.toString()}`;
}

let currentTripId = localStorage.getItem('tripsplit_current_trip_id') || 'trip_default';

let trips = [
  { id: 'trip_default', name: '東京五日遊', baseCurrency: 'TWD' },
  { id: 'trip_osaka', name: '大阪七日遊', baseCurrency: 'TWD' }
];
let archivedTrips = [];
let members = [];
let categories = [];
let paymentMethods = [];
let expenses = [];
let expenseReceipts = [];
let selectedReceiptFiles = [];
let exchangeRates = { JPY: 0.2185, USD: 32.1, KRW: 0.0235, EUR: 34.8, THB: 0.88, TWD: 1 };

const MAX_RECEIPT_FILES = 4;

const fallbackDataByTrip = {
  trip_default: {
    members: [
      { id: 'mem_1', name: 'Dustin', note: '發起人', avatar: 'D' },
      { id: 'mem_2', name: 'Amy', note: '旅伴', avatar: 'A' },
      { id: 'mem_3', name: 'Ben', note: '旅伴', avatar: 'B' },
      { id: 'mem_4', name: 'Cindy', note: '旅伴', avatar: 'C' }
    ],
    categories: [
      { id: 'cat_1', name: '餐飲', icon: '🍜', note: '預設分類' },
      { id: 'cat_2', name: '早餐', icon: '🍳', note: '自訂分類' },
      { id: 'cat_3', name: '門票', icon: '🎟', note: '自訂分類' },
      { id: 'cat_4', name: '交通', icon: '🚆', note: '預設分類' }
    ],
    paymentMethods: [
      { id: 'pay_1', name: '現金', icon: '💵', note: '預設方式' },
      { id: 'pay_2', name: 'Visa', icon: '💳', note: '信用卡' },
      { id: 'pay_3', name: 'LINE Pay', icon: '📱', note: '行動支付' }
    ],
    expenses: [
      { title: '築地早餐', icon: '🍳', payer: 'Dustin', category: '早餐', payment: 'Visa', currency: 'JPY', amount: 12000, rate: 0.2185, twd: 2622, split: '平均分' }
    ]
  },
  trip_osaka: {
    members: [{ id: 'mem_o1', name: 'Dustin', note: '發起人', avatar: 'D' }],
    categories: [{ id: 'cat_o1', name: '餐飲', icon: '🍜', note: '預設分類' }],
    paymentMethods: [{ id: 'pay_o1', name: '現金', icon: '💵', note: '預設方式' }],
    expenses: []
  }
};

const money = new Intl.NumberFormat('zh-TW');
const $ = (selector) => document.querySelector(selector);
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function currentTrip() {
  return trips.find(trip => trip.id === currentTripId) || trips[0];
}

function setStatus(message, type = 'info') {
  const notice = $('#sync-status');
  if (!notice) return;
  const dotColor = type === 'error' ? 'var(--red)' : type === 'success' ? 'var(--green)' : 'var(--orange)';
  notice.innerHTML = `<span class="status-dot" style="background:${dotColor}"></span>${message}`;
}

async function postToGas(action, payload = {}, options = {}) {
  const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(3000, options.timeoutMs) : 12000;

  let lastError = null;
  for (let index = 0; index < GAS_POST_URLS.length; index += 1) {
    const endpoint = GAS_POST_URLS[index];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      await fetch(endpoint, {
        method: 'POST',
        mode: 'no-cors',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, payload }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      return { ok: true };
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      console.warn(`POST 到 GAS 失敗，切換 URL：${endpoint}`, error);
    }
  }

  throw lastError || new Error('GAS POST 失敗，無可用 URL。');
}

async function jsonp(action, payload = {}, options = {}) {
    const maxRetries = Number.isFinite(options.maxRetries) ? Math.max(0, options.maxRetries) : 1;
    const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(3000, options.timeoutMs) : 15000;

    const runOnEndpoint = (baseUrl, endpointIndex) => new Promise((resolve, reject) => {
        let attempt = 0;

        const send = () => {
            attempt += 1;

            const callbackName =
                `tripsplitCallback_${Date.now()}_${Math.floor(Math.random() * 100000)}_${endpointIndex}_${attempt}`;

            const script = document.createElement('script');
            let settled = false;

            const cleanup = () => {
                clearTimeout(timeout);
                delete window[callbackName];
                script.remove();
            };

            const retryOrReject = (error) => {
                cleanup();

                if (attempt <= maxRetries) {
                    setTimeout(send, 300 * attempt);
                    return;
                }

                reject(error);
            };

            const timeout = setTimeout(() => {
                if (settled) return;
                settled = true;
                retryOrReject(new Error('GAS JSONP 讀取逾時'));
            }, timeoutMs);

            window[callbackName] = (response) => {
                if (settled) return;
                settled = true;
                cleanup();

                if (!response || response.ok === false) {
                    reject(new Error(response && response.error ? response.error : 'GAS 回傳錯誤'));
                    return;
                }

                resolve(response.data);
            };

            const query = new URLSearchParams({
                action,
                payload: JSON.stringify(payload || {}),
                callback: callbackName,
                _: String(Date.now())
            });

            script.src = buildGasUrl(baseUrl, query);

            script.onerror = () => {
                if (settled) return;
                settled = true;
                const error = new Error(`無法載入 GAS JSONP：${baseUrl}`);
                error.code = 'GAS_JSONP_LOAD';
                retryOrReject(error);
            };

            (document.head || document.body || document.documentElement).appendChild(script);
        };

        send();
    });

    let lastError = null;

    for (let endpointIndex = 0; endpointIndex < GAS_WEB_APP_URLS.length; endpointIndex += 1) {
        const endpoint = GAS_WEB_APP_URLS[endpointIndex];

        try {
            return await runOnEndpoint(endpoint, endpointIndex);
        } catch (error) {
            lastError = error;
            console.warn('JSONP 失敗：', error);
        }
    }

    throw lastError || new Error('無可用的 GAS JSONP URL');
}

async function loadTrips() {
  try {
    const data = await jsonp('getTrips', {});
    const rows = Array.isArray(data) ? data : data.trips || [];
    if (rows.length) {
      trips = rows.map(row => ({
        id: row.trip_id || row.id,
        name: row.trip_name || row.name,
        baseCurrency: row.base_currency || 'TWD'
      })).filter(trip => trip.id && trip.name);
    }
  } catch (error) {
    console.warn(error);
  }

  if (!trips.some(trip => trip.id === currentTripId)) currentTripId = trips[0].id;
  renderTripSelect();
  loadArchivedTrips();
}

async function loadArchivedTrips() {
  try {
    const data = await jsonp('getArchivedTrips', {});
    const rows = Array.isArray(data) ? data : data.archivedTrips || [];
    if (rows.length) {
      archivedTrips = rows.map(row => ({
        id: row.trip_id || row.id,
        name: row.trip_name || row.name,
        baseCurrency: row.base_currency || 'TWD'
      })).filter(trip => trip.id && trip.name);
    } else {
      archivedTrips = [];
    }
  } catch (error) {
    console.warn(error);
    archivedTrips = [];
  }

  renderArchivedTrips();
}

async function loadCurrentTripData() {
  setStatus(`正在讀取「${currentTrip().name}」資料...`);
  try {
    const data = await jsonp('getInitialData', { trip_id: currentTripId });
    applyLoadedData(data);
    setStatus(`已切換到「${currentTrip().name}」。`, 'success');
  } catch (error) {
    console.warn(error);
    applyFallbackData();
    const blockedByClient = error && error.code === 'GAS_JSONP_LOAD';
    if (blockedByClient) {
      setStatus(`已切換到「${currentTrip().name}」；GAS 請求被瀏覽器或外掛阻擋，已改用本機預覽資料。`, 'error');
    } else {
      setStatus(`已切換到「${currentTrip().name}」；目前使用本機預覽資料。`, 'info');
    }
  }
  renderAll();
  updateFormDisabledState();
}

function applyLoadedData(data) {
  members = normalizeMembers(data.members || []);
  categories = normalizeCategories(data.categories || []);
  paymentMethods = normalizePaymentMethods(data.paymentMethods || data.payment_methods || []);
  exchangeRates = normalizeRates(data.exchangeRates || data.exchange_rates || exchangeRates);
  expenseReceipts = normalizeExpenseReceipts(data.expenseReceipts || data.expense_receipts || []);
  expenses = normalizeExpenses(data.expenses || [], expenseReceipts);

  // 只有在 fallback 中有對應 trip 且 GAS 沒回傳資料時才使用 fallback
  if ((!members.length || !categories.length || !paymentMethods.length) && fallbackDataByTrip[currentTripId]) {
    applyFallbackData({ keepExpenses: Boolean(expenses.length) });
  }
}

function applyFallbackData(options = {}) {
  const fallback = fallbackDataByTrip[currentTripId];
  if (!fallback) return;
  if (!members.length) members = fallback.members;
  if (!categories.length) categories = fallback.categories;
  if (!paymentMethods.length) paymentMethods = fallback.paymentMethods;
  if (!options.keepExpenses && !expenses.length) expenses = fallback.expenses;
}

function normalizeMembers(rows) {
  return rows.filter(row => String(row.is_active).toLowerCase() !== 'false').map(row => ({
    id: row.member_id || row.id,
    name: row.member_name || row.name,
    note: row.email_or_note || row.note || '旅伴',
    avatar: row.avatar_text || String(row.member_name || row.name || '?').slice(0, 1).toUpperCase()
  })).filter(item => item.id && item.name);
}

function normalizeCategories(rows) {
  return rows.filter(row => String(row.is_active).toLowerCase() !== 'false').map(row => ({
    id: row.category_id || row.id,
    name: row.category_name || row.name,
    icon: row.icon || '🏷',
    note: row.note || '自訂分類'
  })).filter(item => item.id && item.name);
}

function normalizePaymentMethods(rows) {
  return rows.filter(row => String(row.is_active).toLowerCase() !== 'false').map(row => ({
    id: row.payment_method_id || row.id,
    name: row.payment_method_name || row.name,
    icon: row.icon || '💳',
    note: row.note || '付款方式'
  })).filter(item => item.id && item.name);
}

function normalizeRates(rowsOrObject) {
  if (!Array.isArray(rowsOrObject)) return rowsOrObject;
  const rates = { TWD: 1 };
  rowsOrObject.forEach(row => {
    const currency = row.base_currency || row.currency;
    const rate = Number(row.rate_to_twd || row.rate);
    if (currency && rate) rates[currency] = rate;
  });
  return { ...exchangeRates, ...rates };
}

function normalizeExpenses(rows, receiptRows = []) {
  return rows.map(row => {
    const category = categories.find(item => item.id === row.category_id || item.name === row.category_name);
    const expenseId = row.expense_id || row.id || '';
    const relatedReceipts = receiptRows.filter(item => (item.expense_id || '') === expenseId);

    return {
      id: expenseId,
      title: row.title || row.expense_title || '未命名支出',
      icon: category ? category.icon : '🧾',
      payer: row.payer_member_name || row.payer || '',
      category: row.category_name || (category ? category.name : ''),
      payment: row.payment_method_name || row.payment || '',
      currency: row.original_currency || row.currency || 'TWD',
      amount: Number(row.amount_original || row.amount || 0),
      rate: Number(row.exchange_rate_to_twd || row.rate || 1),
      twd: Number(row.amount_twd || 0),
      split: row.split_type || '平均分',
      receiptUrls: dedupeReceiptUrls([...extractReceiptUrls(row), ...extractReceiptUrlsFromRows(relatedReceipts)]),
      synced: true
    };
  });
}

function normalizeExpenseReceipts(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(row => ({
    receipt_id: row.receipt_id || row.id || '',
    expense_id: row.expense_id || '',
    drive_url: row.drive_url || row.receipt_url || row.image_url || '',
    drive_file_id: row.drive_file_id || ''
  })).filter(item => item.expense_id);
}

function extractReceiptUrlsFromRows(rows) {
  const urls = [];
  rows.forEach(row => {
    urls.push(...extractReceiptUrls(row));
    if (row.drive_file_id && !row.drive_url && !row.receipt_url && !row.image_url) {
      urls.push(`https://drive.google.com/file/d/${row.drive_file_id}/view`);
    }
  });
  return dedupeReceiptUrls(urls);
}

function dedupeReceiptUrls(urls) {
  const map = new Map();
  (urls || []).forEach((url) => {
    const value = String(url || '').trim();
    if (!value) return;
    const driveId = extractDriveFileId(value);
    const key = driveId ? `drive:${driveId}` : `url:${value}`;
    if (!map.has(key)) map.set(key, value);
  });
  return Array.from(map.values());
}

function extractReceiptUrls(row) {
  const values = [];
  const pushValue = (value) => {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed) return;
    values.push(trimmed);
  };

  pushValue(row.drive_url);
  pushValue(row.receipt_url);
  pushValue(row.image_url);

  if (Array.isArray(row.receipts)) {
    row.receipts.forEach(item => {
      if (!item) return;
      if (typeof item === 'string') {
        pushValue(item);
        return;
      }
      pushValue(item.drive_url);
      pushValue(item.receipt_url);
      pushValue(item.url);
      pushValue(item.view_url);
      pushValue(item.webViewLink);
      pushValue(item.webContentLink);
    });
  }

  const rawList = row.receipt_urls || row.drive_urls || row.image_urls;
  if (Array.isArray(rawList)) {
    rawList.forEach(pushValue);
  } else if (typeof rawList === 'string') {
    const maybeJson = rawList.trim();
    if (maybeJson.startsWith('[') && maybeJson.endsWith(']')) {
      try {
        const parsed = JSON.parse(maybeJson);
        if (Array.isArray(parsed)) parsed.forEach(pushValue);
      } catch (_) {
        maybeJson.split(',').map(item => item.trim()).forEach(pushValue);
      }
    } else {
      maybeJson.split(',').map(item => item.trim()).forEach(pushValue);
    }
  }

  return [...new Set(values)];
}

function extractDriveFileId(url) {
  const input = String(url || '');
  const fileIdMatch = input.match(/\/file\/d\/([^/?#]+)/);
  if (fileIdMatch && fileIdMatch[1]) return fileIdMatch[1];

  const idMatch = input.match(/[?&]id=([^&#]+)/);
  if (idMatch && idMatch[1]) return idMatch[1];

  return '';
}

function buildDriveImageCandidates(url) {
  const original = String(url || '').trim();
  if (!original) return [];

  const fileId = extractDriveFileId(original);
  if (!fileId) return [original];

  return [
    `https://drive.google.com/uc?export=view&id=${fileId}`,
    `https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`,
    `https://drive.usercontent.google.com/download?id=${fileId}&export=view`,
    original
  ];
}

function toDisplayImageUrl(url) {
  return buildDriveImageCandidates(url)[0] || String(url || '');
}

function buildReceiptLinks(expense) {
  const urls = Array.isArray(expense.receiptUrls) ? expense.receiptUrls : [];
  if (!urls.length) return '';

  return `<div class="expense-links">${urls.map((url, index) => `
    <button class="receipt-link" type="button" data-receipt-url="${encodeURIComponent(url)}">📷 查看照片${urls.length > 1 ? ` ${index + 1}` : ''}</button>
  `).join('')}</div>`;
}

function payloadHasReceipts(payload) {
    return Boolean(
        payload &&
        Array.isArray(payload.receipts) &&
        payload.receipts.some(item => item && item.base64)
    );
}

async function saveThenReload(action, payload, delay = 900) {
    const hasReceipts = payloadHasReceipts(payload);

    setStatus(hasReceipts ? '正在上傳收據並寫入 Google Sheet...' : '正在寫入 Google Sheet...');

    try {
        if (hasReceipts) {
            // 有圖片：不要走 JSONP，避免 URL 過長
            await postToGasBlind(action, payload, { timeoutMs: 45000 });
            await wait(Math.max(delay, 3500));
        } else {
            // 小資料：用 JSONP，可以讀到 GAS 回傳錯誤
            await jsonp(action, payload, { timeoutMs: 15000 });
            await wait(delay);
        }

        await loadCurrentTripData();
        setStatus('資料已同步到 Google Sheet。', 'success');

    } catch (error) {
        console.error(error);
        setStatus(`同步失敗：${error.message || error}`, 'error');
        throw error;
    }
}

function renderAll() {
  renderTripSelect();
  renderArchivedTrips();
  renderTripHeaders();
  renderRates();
  renderMembers();
  renderList(categories, '#category-list', 'category');
  renderList(paymentMethods, '#payment-list', 'payment');
  renderSelects();
  renderExpenses();
  renderBalancesAndSettlements();
  updateExchangePreview();
}

function isCurrentTripArchived() {
  const currentTrip_ = currentTrip();
  return archivedTrips && archivedTrips.some(trip => trip.id === currentTrip_.id);
}

function updateFormDisabledState() {
  const isArchived = isCurrentTripArchived();
  const forms = [
    '#member-form',
    '#category-form',
    '#payment-form',
    '#expense-create-form'
  ];

  forms.forEach(formSelector => {
    const form = $(formSelector);
    if (!form) return;

    const inputs = form.querySelectorAll('input, select, textarea, button[type="submit"]');
    inputs.forEach(input => {
      input.disabled = isArchived;
    });
  });

  const archiveBtn = $('#archive-trip-btn');
  if (archiveBtn) {
    archiveBtn.disabled = isArchived;
    if (isArchived) {
      archiveBtn.title = '此旅遊已封存';
    }
  }

  // 如果已封存，顯示提示信息
  if (isArchived) {
    setStatus(`已封存的旅遊不能修改。若要編輯，請先解除封存。`, 'info');
  }
}

function renderTripSelect() {
  // 排序旅遊：最新的在前面
  const sortedTrips = [...trips].sort((a, b) => {
    // 提取 ID 中的時間戳記部分
    const aTimestamp = parseInt(a.id.replace('trip_', '')) || 0;
    const bTimestamp = parseInt(b.id.replace('trip_', '')) || 0;

    // 時間戳記都存在：按時間戳記倒序（新的在前）
    if (aTimestamp && bTimestamp) {
      return bTimestamp - aTimestamp;
    }

    // 只有一個有時間戳記：有時間戳記的排在前
    if (aTimestamp && !bTimestamp) return -1;
    if (!aTimestamp && bTimestamp) return 1;

    // 都沒有時間戳記：保持原始順序
    return trips.indexOf(a) - trips.indexOf(b);
  });

  $('#trip-select').innerHTML = sortedTrips.map(trip => `<option value="${trip.id}" ${trip.id === currentTripId ? 'selected' : ''}>${trip.name}</option>`).join('');
}

function renderArchivedTrips() {
  const container = $('#archived-trips-list');
  if (!container) return;

  if (!archivedTrips || !archivedTrips.length) {
    container.innerHTML = '<p class="field-hint">目前沒有已封存的旅遊。</p>';
    return;
  }

  container.innerHTML = archivedTrips.map(trip => `
    <div class="list-row">
      <div class="list-info">
        <span class="mini-icon">📦</span>
        <div>
          <strong>${trip.name}</strong>
          <small>${trip.id}</small>
        </div>
      </div>
      <button class="icon-btn" type="button" data-unarchive-trip="${trip.id}" title="解除封存">↩️</button>
    </div>
  `).join('');
}

function renderTripHeaders() {
  const trip = currentTrip();
  $('#hero-title').textContent = `${trip.name}｜旅行花費一頁管理。`;
  $('#summary-trip-title').textContent = `${trip.name}｜目前統計`;
  $('#summary-trip-id').textContent = trip.id;
  $('#expense-list-subtitle').textContent = `未來可從 /api/expenses?trip_id=${trip.id} 載入。`;
  $('#summary-member-count').textContent = `${members.length} 人`;
}

function renderRates() {
  $('#rate-list').innerHTML = Object.entries(exchangeRates).map(([currency, rate]) => `
    <div class="list-row"><div class="list-info"><span class="mini-icon">${currencySymbol(currency)}</span><div><strong>${currency} → TWD</strong><small>1 ${currency} = ${rate} TWD</small></div></div></div>
  `).join('');
}

function currencySymbol(currency) {
  return { JPY: '¥', USD: '$', KRW: '₩', EUR: '€', THB: '฿', TWD: 'NT' }[currency] || currency;
}

function renderMembers() {
  $('#member-list').innerHTML = members.map((item, index) => `
    <div class="list-row"><div class="list-info"><span class="avatar ${index === 1 ? 'green' : index === 2 ? 'orange' : index === 3 ? 'purple' : ''}">${item.avatar}</span><div><strong>${item.name}</strong><small>${item.note}</small></div></div><button class="icon-btn" type="button" data-remove="member" data-id="${item.id}">×</button></div>
  `).join('') || '<p class="field-hint">這個旅遊尚無成員。</p>';

  $('#paid-by').innerHTML = members.map(item => `<option value="${item.name}">${item.name}</option>`).join('');
  $('#participant-options').innerHTML = members.map(item => `<label class="check-chip"><input type="checkbox" value="${item.name}" checked /> ${item.name}</label>`).join('');
  renderSplitConfig();
}

function renderList(data, listId, type) {
  $(listId).innerHTML = data.map(item => `
    <div class="list-row"><div class="list-info"><span class="mini-icon">${item.icon}</span><div><strong>${item.name}</strong><small>${item.note}</small></div></div><button class="icon-btn" type="button" data-remove="${type}" data-id="${item.id}">×</button></div>
  `).join('') || '<p class="field-hint">這個旅遊尚無資料。</p>';
}

function renderSelects() {
  $('#category-id').innerHTML = '<option value="">請選擇分類</option>' + categories.map(item => `<option value="${item.id}">${item.name}</option>`).join('');
  $('#payment-method-id').innerHTML = '<option value="">請選擇付款方式</option>' + paymentMethods.map(item => `<option value="${item.id}">${item.name}</option>`).join('');

  // 恢復上次保存的幣別
  const lastCurrency = localStorage.getItem('tripsplit_last_currency') || 'JPY';
  $('#expense-currency').value = lastCurrency;
  updateExchangePreview();
}

function renderExpenses() {
  $('#expense-list').innerHTML = expenses.map(expense => `
    <article class="expense-item"><div class="expense-icon">${expense.icon}</div><div class="expense-meta"><strong>${expense.title}</strong><span>付款人 ${expense.payer}・${expense.category}・付款方式 ${expense.payment}・${expense.currency} ${money.format(expense.amount)}・系統匯率 ${expense.rate}・${expense.split}</span>${buildReceiptLinks(expense)}</div><div class="expense-amount"><strong>NT$ ${money.format(Math.round(expense.twd))}</strong><small>${expense.synced ? 'Google Sheet 資料' : '本機預覽'}</small></div></article>
  `).join('') || '<p class="field-hint">這個旅遊目前沒有支出。</p>';
  const total = expenses.reduce((sum, item) => sum + Number(item.twd || 0), 0);
  $('#summary-total').textContent = `NT$ ${money.format(Math.round(total))}`;
  $('#summary-count').textContent = `${expenses.length} 筆`;
}

function computeMemberBalances() {
  const names = members.map(member => member.name);
  const balances = {};
  names.forEach(name => {
    balances[name] = 0;
  });

  expenses.forEach(expense => {
    const payer = expense.payer;
    const amountTwd = Number(expense.twd || 0);
    if (!amountTwd || !names.length) return;

    if (balances[payer] === undefined) balances[payer] = 0;
    balances[payer] += amountTwd;

    const share = amountTwd / names.length;
    names.forEach(name => {
      balances[name] = (balances[name] || 0) - share;
    });
  });

  return names.map(name => ({
    name,
    balance: Math.round(balances[name] || 0)
  }));
}

function buildSettlementSuggestions(balanceRows) {
  const creditors = balanceRows
    .filter(item => item.balance > 0)
    .map(item => ({ name: item.name, amount: item.balance }))
    .sort((a, b) => b.amount - a.amount);
  const debtors = balanceRows
    .filter(item => item.balance < 0)
    .map(item => ({ name: item.name, amount: Math.abs(item.balance) }))
    .sort((a, b) => b.amount - a.amount);

  const suggestions = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amount = Math.min(creditor.amount, debtor.amount);

    if (amount > 0) {
      suggestions.push({ from: debtor.name, to: creditor.name, amount: Math.round(amount) });
      creditor.amount -= amount;
      debtor.amount -= amount;
    }

    if (creditor.amount <= 0.5) creditorIndex += 1;
    if (debtor.amount <= 0.5) debtorIndex += 1;
  }

  return suggestions;
}

function renderBalancesAndSettlements() {
  const balanceRows = computeMemberBalances();
  const balanceGrid = $('#balance-grid');
  const settlementList = $('#settlement-list');
  if (!balanceGrid || !settlementList) return;

  const total = expenses.reduce((sum, item) => sum + Number(item.twd || 0), 0);
  const avg = members.length ? Math.round(total / members.length) : 0;

  const memberCards = balanceRows.map(item => {
    const sign = item.balance >= 0 ? '+' : '-';
    const amount = money.format(Math.abs(item.balance));
    const className = item.balance > 0 ? 'positive' : item.balance < 0 ? 'negative' : 'neutral';
    return `<div class="balance-card"><span>${item.name}</span><strong class="${className}">${sign} NT$ ${amount}</strong></div>`;
  }).join('');

  balanceGrid.innerHTML = memberCards
    + `<div class="balance-card"><span>已記錄支出</span><strong class="neutral">${expenses.length} 筆</strong></div>`
    + `<div class="balance-card"><span>平均每人</span><strong class="neutral">NT$ ${money.format(avg)}</strong></div>`;

  const suggestions = buildSettlementSuggestions(balanceRows);
  settlementList.innerHTML = suggestions.length
    ? suggestions.map(item => `<div class="settlement-item"><div class="settlement-route"><span>${item.from}</span><span class="arrow">→</span><span>${item.to}</span></div><strong>NT$ ${money.format(item.amount)}</strong></div>`).join('')
    : '<p class="field-hint">目前已接近平衡，暫無建議轉帳。</p>';
}

function updateExchangePreview() {
  const currency = $('#expense-currency').value;
  const amount = Number($('#amount-original').value || 0);
  const rate = Number(exchangeRates[currency] || 1);
  $('#rate-preview').value = `${currency} → TWD：${rate}`;
  $('#amount-twd').value = amount ? `NT$ ${money.format(Math.round(amount * rate))}` : '輸入金額後自動換算';
}

function getSelectedParticipants() {
  return Array.from(document.querySelectorAll('#participant-options input:checked')).map(input => input.value);
}

function handleReceiptImageError(event) {
  const image = event.target;
  const candidates = JSON.parse(image.dataset.candidates || '[]');
  const currentIndex = Number(image.dataset.candidateIndex || 0);
  const nextIndex = currentIndex + 1;

  if (nextIndex >= candidates.length) {
    image.onerror = null;
    return;
  }

  image.dataset.candidateIndex = String(nextIndex);
  image.src = candidates[nextIndex];
}

function openReceiptModal(rawUrl) {
  const modal = $('#receipt-modal');
  const image = $('#receipt-modal-image');
  const link = $('#receipt-modal-open-link');
  if (!modal || !image || !link) return;

  const originalUrl = String(rawUrl || '').trim();
  if (!originalUrl) return;

  const candidates = buildDriveImageCandidates(originalUrl);
  if (!candidates.length) return;

  image.dataset.candidates = JSON.stringify(candidates);
  image.dataset.candidateIndex = '0';
  image.onerror = handleReceiptImageError;
  image.src = candidates[0];
  image.alt = '收據照片預覽';
  link.href = originalUrl;
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeReceiptModal() {
  const modal = $('#receipt-modal');
  const image = $('#receipt-modal-image');
  const link = $('#receipt-modal-open-link');
  if (!modal || !image || !link) return;

  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
  image.src = '';
  image.onerror = null;
  image.dataset.candidates = '[]';
  image.dataset.candidateIndex = '0';
  link.href = '#';
  document.body.style.overflow = '';
}

function renderSplitConfig() {
  const splitType = document.querySelector('input[name="split_type"]:checked')?.value || '平均分';
  const selected = getSelectedParticipants();
  const container = $('#split-config');
  if (!container) return;

  if (!selected.length) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }

  const isPercent = splitType === '百分比分';
  const isCustomAmount = splitType === '自訂金額';
  const kind = isPercent ? 'percent' : isCustomAmount ? 'amount' : 'equal';
  container.style.display = 'grid';
  container.innerHTML = `
    <label>${isPercent ? '請輸入每位比例（%）' : isCustomAmount ? '請輸入每位金額（原始幣別）' : '平均分（可留空，系統自動平均）'}</label>
    <div class="split-input-grid">
      ${selected.map(name => `
        <div class="split-input-row">
          <span>${name} 分攤</span>
          <input
            type="number"
            class="split-input"
            data-member="${name}"
            data-kind="${kind}"
            min="0"
            step="0.01"
            placeholder="${isPercent ? '例如 33.33' : isCustomAmount ? '例如 1200' : '平均分可留空'}"
            ${kind === 'equal' ? 'disabled' : ''}
          />
        </div>
      `).join('')}
    </div>
    <p class="field-hint">${isPercent ? '所有比例加總需為 100%。' : isCustomAmount ? '建議加總等於原始金額。' : '將依已勾選成員平均分攤。'}</p>
  `;
}

function validateSplitInputs(splitType, totalAmount) {
  const selected = getSelectedParticipants();
  if (!selected.length) {
    alert('請至少勾選一位分帳對象。');
    return { ok: false };
  }

  if (splitType === '平均分') {
    return {
      ok: true,
      splitDetails: selected.map(memberName => ({ member_name: memberName, split_mode: 'equal' }))
    };
  }

  const inputs = Array.from(document.querySelectorAll('#split-config .split-input'));
  if (!inputs.length || inputs.length !== selected.length) {
    alert('請先輸入分帳資料。');
    return { ok: false };
  }

  const splitDetails = [];
  for (const input of inputs) {
    const value = Number(input.value);
    if (!(value >= 0)) {
      alert(`請輸入 ${input.dataset.member} 的分帳數值。`);
      input.focus();
      return { ok: false };
    }

    if (splitType === '百分比分') {
      splitDetails.push({
        member_name: input.dataset.member,
        split_mode: 'percent',
        share_percentage: value
      });
      continue;
    }

    splitDetails.push({
      member_name: input.dataset.member,
      split_mode: 'amount',
      share_amount_original: value
    });
  }

  if (splitType === '百分比分') {
    const totalPercent = splitDetails.reduce((sum, item) => sum + Number(item.share_percentage || 0), 0);
    if (Math.abs(totalPercent - 100) > 0.01) {
      alert(`百分比加總需為 100%，目前為 ${totalPercent.toFixed(2)}%。`);
      return { ok: false };
    }
  }

  if (splitType === '自訂金額') {
    const totalSplitAmount = splitDetails.reduce((sum, item) => sum + Number(item.share_amount_original || 0), 0);
    if (Math.abs(totalSplitAmount - totalAmount) > 1) {
      alert(`自訂金額加總建議接近原始金額，現在加總為 ${totalSplitAmount.toFixed(2)}。`);
    }
  }

  return { ok: true, splitDetails };
}

async function fileToBase64(file) {
    const compressedBlob = await compressImageFile(file, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.72
    });

    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            const result = String(reader.result || '');

            resolve({
                fileName: file.name.replace(/\.[^.]+$/, '') + '.jpg',
                mimeType: 'image/jpeg',
                base64: result.includes(',') ? result.split(',')[1] : result
            });
        };

        reader.onerror = reject;
        reader.readAsDataURL(compressedBlob);
    });
}

function compressImageFile(file, options = {}) {
    const maxWidth = options.maxWidth || 1600;
    const maxHeight = options.maxHeight || 1600;
    const quality = options.quality || 0.72;

    return new Promise((resolve, reject) => {
        const image = new Image();
        const objectUrl = URL.createObjectURL(file);

        image.onload = () => {
            URL.revokeObjectURL(objectUrl);

            let width = image.width;
            let height = image.height;

            const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const context = canvas.getContext('2d');
            context.drawImage(image, 0, 0, width, height);

            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        reject(new Error('圖片壓縮失敗'));
                        return;
                    }

                    resolve(blob);
                },
                'image/jpeg',
                quality
            );
        };

        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('圖片讀取失敗'));
        };

        image.src = objectUrl;
    });
}

function renderReceiptPreview() {
  const preview = $('#receipt-preview');
  if (!preview) return;

  preview.innerHTML = '';
  selectedReceiptFiles.forEach((file, index) => {
    const item = document.createElement('div');
    item.className = 'receipt-preview-item';

    const img = document.createElement('img');
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
    img.alt = file.name;
    img.addEventListener('load', () => URL.revokeObjectURL(objectUrl), { once: true });

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'receipt-preview-remove';
    removeButton.dataset.removePreviewIndex = String(index);
    removeButton.setAttribute('aria-label', `移除 ${file.name}`);
    removeButton.textContent = '×';

    item.appendChild(img);
    item.appendChild(removeButton);
    preview.appendChild(item);
  });

  preview.style.display = selectedReceiptFiles.length ? 'flex' : 'none';
}

function appendReceiptFiles(files) {
  const imageFiles = Array.from(files || []).filter(file => file.type.startsWith('image/'));
  if (!imageFiles.length) return;

  const remain = Math.max(0, MAX_RECEIPT_FILES - selectedReceiptFiles.length);
  if (!remain) {
    alert(`最多只能上傳 ${MAX_RECEIPT_FILES} 張收據照片。`);
    return;
  }

  const accepted = imageFiles.slice(0, remain);
  selectedReceiptFiles = selectedReceiptFiles.concat(accepted);

  if (imageFiles.length > remain) {
    alert(`最多只能上傳 ${MAX_RECEIPT_FILES} 張收據照片，已保留前 ${MAX_RECEIPT_FILES} 張。`);
  }

  renderReceiptPreview();
}

function removeReceiptFileAt(index) {
  if (!(index >= 0) || index >= selectedReceiptFiles.length) return;
  selectedReceiptFiles.splice(index, 1);
  renderReceiptPreview();
}

function clearReceiptFiles() {
  selectedReceiptFiles = [];
  renderReceiptPreview();
  if ($('#receipt-files')) $('#receipt-files').value = '';
}

async function getReceiptPayloads() {
    return Promise.all(selectedReceiptFiles.slice(0, MAX_RECEIPT_FILES).map(fileToBase64));
}

$('#trip-switch-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  currentTripId = $('#trip-select').value;
  localStorage.setItem('tripsplit_current_trip_id', currentTripId);
  await loadCurrentTripData();
});

$('#trip-select').addEventListener('change', async () => {
  currentTripId = $('#trip-select').value;
  localStorage.setItem('tripsplit_current_trip_id', currentTripId);
  await loadCurrentTripData();
});

$('#trip-create-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = $('#new-trip-name');
  const name = input.value.trim();
  if (!name) return;
  const newTripId = `trip_${Date.now()}`;
  input.value = '';
  trips.push({ id: newTripId, name, baseCurrency: 'TWD' });
  currentTripId = newTripId;
  localStorage.setItem('tripsplit_current_trip_id', currentTripId);
  renderAll();
  try {
    await jsonp('addTrip', { trip_id: newTripId, trip_name: name, base_currency: 'TWD', created_by: 'Dustin' });
    await loadTrips();
  } catch (error) {
    console.warn(error);
  }
  await loadCurrentTripData();
});

$('#member-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = $('#member-name');
  const name = input.value.trim();
  if (!name) return;
  input.value = '';
  await saveThenReload('addMember', { trip_id: currentTripId, member_name: name, email_or_note: '旅伴', avatar_text: name.slice(0, 1).toUpperCase() });
});

$('#category-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = $('#new-category-name').value.trim();
  const icon = $('#new-category-icon').value.trim() || '🏷';
  if (!name) return;
  $('#new-category-name').value = '';
  $('#new-category-icon').value = '';
  await saveThenReload('addCategory', { trip_id: currentTripId, category_name: name, icon, note: '自訂分類' });
});

$('#payment-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = $('#new-payment-name').value.trim();
  const icon = $('#new-payment-icon').value.trim() || '💳';
  if (!name) return;
  $('#new-payment-name').value = '';
  $('#new-payment-icon').value = '';
  await saveThenReload('addPaymentMethod', { trip_id: currentTripId, payment_method_name: name, icon, note: '自訂付款方式' });
});

document.addEventListener('click', async (event) => {
  const receiptButton = event.target.closest('[data-receipt-url]');
  if (receiptButton) {
    const decoded = decodeURIComponent(receiptButton.dataset.receiptUrl || '');
    openReceiptModal(decoded);
    return;
  }

  const closeModalButton = event.target.closest('[data-close-receipt-modal]');
  if (closeModalButton) {
    closeReceiptModal();
    return;
  }

  const previewRemoveButton = event.target.closest('[data-remove-preview-index]');
  if (previewRemoveButton) {
    removeReceiptFileAt(Number(previewRemoveButton.dataset.removePreviewIndex));
    return;
  }

  const archiveButton = event.target.closest('#archive-trip-btn');
  if (archiveButton) {
    if (!currentTripId) return;
    const confirmArchive = confirm(`確定要封存「${currentTrip().name}」嗎？\n\n封存後，此旅遊將不再顯示在下拉選單中。`);
    if (!confirmArchive) return;

    await saveThenReload('archiveTrip', { trip_id: currentTripId });

    // 切換到第一個未封存的旅遊
    if (trips.length > 0) {
      currentTripId = trips[0].id;
    } else {
      currentTripId = 'trip_default';
    }
    localStorage.setItem('tripsplit_current_trip_id', currentTripId);
    await loadTrips();
    await loadCurrentTripData();
    return;
  }

  const unarchiveButton = event.target.closest('[data-unarchive-trip]');
  if (unarchiveButton) {
    const tripId = unarchiveButton.dataset.unarchiveTrip;
    const tripName = archivedTrips.find(t => t.id === tripId)?.name || 'Unknown';
    const confirmUnarchive = confirm(`確定要解除封存「${tripName}」嗎？`);
    if (!confirmUnarchive) return;

    await saveThenReload('unarchiveTrip', { trip_id: tripId });
    await loadTrips();
    return;
  }

  const button = event.target.closest('[data-remove]');
  if (!button) return;
  const id = button.dataset.id;
  const type = button.dataset.remove;
  const actionMap = { member: 'deleteMember', category: 'deleteCategory', payment: 'deletePaymentMethod' };
  const payloadMap = { member: { member_id: id }, category: { category_id: id }, payment: { payment_method_id: id } };
  if (!actionMap[type]) return;
  await saveThenReload(actionMap[type], payloadMap[type]);
});

$('#amount-original').addEventListener('input', updateExchangePreview);
$('#expense-currency').addEventListener('change', updateExchangePreview);
$('#participant-options').addEventListener('change', (event) => {
  if (event.target.matches('input[type="checkbox"]')) renderSplitConfig();
});
document.querySelectorAll('input[name="split_type"]').forEach(input => {
  input.addEventListener('change', renderSplitConfig);
});
$('#receipt-files').addEventListener('change', (event) => {
  appendReceiptFiles(event.target.files || []);
  event.target.value = '';
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && $('#receipt-modal')?.classList.contains('show')) {
    closeReceiptModal();
  }
});

$('#expense-create-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const selectedCategory = categories.find(item => String(item.id) === $('#category-id').value);
  const selectedPayment = paymentMethods.find(item => String(item.id) === $('#payment-method-id').value);
  const amount = Number($('#amount-original').value || 0);
  const currency = $('#expense-currency').value;
  const rate = Number(exchangeRates[currency] || 1);
  const split = document.querySelector('input[name="split_type"]:checked').value;
  if (!$('#expense-title').value.trim() || !selectedCategory || !selectedPayment || !amount) return;

  const splitValidation = validateSplitInputs(split, amount);
  if (!splitValidation.ok) return;

    setStatus('正在處理收據照片...');
    const receiptPayloads = await getReceiptPayloads();

    await saveThenReload('addExpense', {
        trip_id: currentTripId,
        title: $('#expense-title').value.trim(),
        payer_member_name: $('#paid-by').value,
        category_id: selectedCategory.id,
        category_name: selectedCategory.name,
        payment_method_id: selectedPayment.id,
        payment_method_name: selectedPayment.name,
        expense_date: $('#expense-date').value,
        amount_original: amount,
        original_currency: currency,
        exchange_rate_to_twd: rate,
        amount_twd: Math.round(amount * rate),
        split_type: split,
        split_details: splitValidation.splitDetails,
        note: $('#note').value,
        participants: getSelectedParticipants(),
        receipts: receiptPayloads
    }, receiptPayloads.length ? 4500 : 1000);

  // 保存本次選擇的幣別
  localStorage.setItem('tripsplit_last_currency', currency);

  event.target.reset();
  clearReceiptFiles();
  updateExchangePreview();
  renderSplitConfig();
  document.querySelector('#expenses').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

(async function init() {
  renderAll();
  await loadTrips();
  await loadCurrentTripData();
})();


async function postToGasBlind(action, payload = {}, options = {}) {
    const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(5000, options.timeoutMs) : 30000;
    const endpoint = GAS_WEB_APP_URLS[0];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        await fetch(endpoint, {
            method: 'POST',
            mode: 'no-cors',
            redirect: 'follow',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify({ action, payload }),
            signal: controller.signal
        });

        return { ok: true };

    } finally {
        clearTimeout(timeout);
    }
}