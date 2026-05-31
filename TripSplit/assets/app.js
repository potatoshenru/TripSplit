/* TripSplit merged app bundle. Source modules merged to keep the package under 20 files. */
const GAS_DEPLOYMENT_ID = 'AKfycbzMyU5EqIvFc-kZUxNsC6YaINNkQTVB1o1AF-BFLUHWjnICqFhU4NwNBHEsf0SJEAM0hA';
const GAS_WEB_APP_URL = `https://script.google.com/macros/s/${GAS_DEPLOYMENT_ID}/exec`;

const GAS_WEB_APP_URLS = [GAS_WEB_APP_URL];

console.log('TripSplit GAS endpoint:', GAS_WEB_APP_URL);

//const GAS_WEB_APP_URLS = [normalizeGasUrl(GAS_WEB_APP_URL)].filter(Boolean);

function buildGasUrl(baseUrl, query) {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}${query.toString()}`;
}

const TRIP_SELECTION_MODE_KEY = 'tripsplit_trip_selection_mode';
const storedTripId = localStorage.getItem('tripsplit_current_trip_id');
const storedTripSelectionMode = localStorage.getItem(TRIP_SELECTION_MODE_KEY);
let currentTripId = storedTripId || 'trip_default';
let shouldSelectLatestTripOnLoad = storedTripSelectionMode !== 'manual';

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
let expenseParticipants = [];
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

function getStoredTripModifiedTimes() {
    try {
        return JSON.parse(localStorage.getItem('tripsplit_trip_modified_at') || '{}') || {};
    } catch (_) {
        return {};
    }
}

function getStoredTripModifiedAt(tripId) {
    return getStoredTripModifiedTimes()[tripId] || '';
}

function markTripModified(tripId) {
    if (!tripId) return;
    const modifiedTimes = getStoredTripModifiedTimes();
    modifiedTimes[tripId] = new Date().toISOString();
    localStorage.setItem('tripsplit_trip_modified_at', JSON.stringify(modifiedTimes));
}

function currentTrip() {
    return trips.find(trip => trip.id === currentTripId) || trips[0];
}

function setStatus(message, type = 'info') {
    const notice = $('#sync-status');
    if (!notice) return;
    const dotColor = type === 'error' ? 'var(--red)' : type === 'success' ? 'var(--green)' : 'var(--orange)';
    notice.classList.toggle('is-floating', type !== 'success');
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

function normalizeExpenses(rows, receiptRows = [], participantRows = []) {
    return rows.map(row => {
        const category = categories.find(item => item.id === row.category_id || item.name === row.category_name);
        const expenseId = row.expense_id || row.id || '';
        const relatedReceipts = receiptRows.filter(item => (item.expense_id || '') === expenseId);
        const relatedParticipants = participantRows.filter(item => (item.expense_id || '') === expenseId);

        return {
            id: expenseId,
            title: row.title || row.expense_title || '未命名支出',
            icon: category ? category.icon : '🧾',
            categoryId: row.category_id || (category ? category.id : ''),
            paymentMethodId: row.payment_method_id || '',
            payer: row.payer_member_name || row.payer || '',
            category: row.category_name || (category ? category.name : ''),
            payment: row.payment_method_name || row.payment || '',
            date: row.expense_date || row.date || row.created_at || '',
            currency: row.original_currency || row.currency || 'TWD',
            amount: Number(row.amount_original || row.amount || 0),
            rate: Number(row.exchange_rate_to_twd || row.rate || 1),
            twd: Number(row.amount_twd || 0),
            split: row.split_type || '平均分',
            note: row.note || '',
            createdAt: row.created_at || '',
            updatedAt: row.updated_at || '',
            participants: relatedParticipants.map(item => item.member_name).filter(Boolean),
            splitDetails: relatedParticipants.map(item => ({
                member_name: item.member_name,
                share_amount_twd: Number(item.share_amount_twd || 0),
                share_percentage: Number(item.share_percentage || 0)
            })),
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

function normalizeExpenseParticipants(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map(row => ({
        participant_id: row.participant_id || row.id || '',
        expense_id: row.expense_id || '',
        member_name: row.member_name || '',
        share_amount_twd: row.share_amount_twd || '',
        share_percentage: row.share_percentage || ''
    })).filter(item => item.expense_id && item.member_name);
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
async function loadTrips() {
    try {
        const data = await jsonp('getTrips', {});
        const rows = Array.isArray(data) ? data : data.trips || [];
        if (rows.length) {
            trips = rows.map(normalizeTrip).filter(trip => trip.id && trip.name);
        }
    } catch (error) {
        console.warn(error);
    }

    if (shouldSelectLatestTripOnLoad) {
        currentTripId = getLatestTripId() || currentTripId;
        localStorage.setItem('tripsplit_current_trip_id', currentTripId);
        localStorage.setItem(TRIP_SELECTION_MODE_KEY, 'auto');
        shouldSelectLatestTripOnLoad = false;
    }

    if (!trips.some(trip => trip.id === currentTripId)) currentTripId = trips[0].id;
    renderTripSelect();
    loadArchivedTrips();
}

function normalizeTrip(row) {
    const id = row.trip_id || row.id;
    return {
        id,
        name: row.trip_name || row.name,
        baseCurrency: row.base_currency || 'TWD',
        updatedAt: row.updated_at || row.updatedAt || row.modified_at || row.modifiedAt || row.last_modified || row.lastModified || row.created_at || row.createdAt || getStoredTripModifiedAt(id) || ''
    };
}

function getTripSortTime(trip) {
    const updatedTime = Date.parse(trip.updatedAt || '');
    if (Number.isFinite(updatedTime)) return updatedTime;

    const idTimestamp = Number(String(trip.id || '').replace(/^trip_/, ''));
    return Number.isFinite(idTimestamp) ? idTimestamp : 0;
}

function getLatestTripId() {
    if (!trips.length) return '';

    return [...trips].sort((a, b) => {
        const timeDiff = getTripSortTime(b) - getTripSortTime(a);
        if (timeDiff) return timeDiff;
        return trips.indexOf(b) - trips.indexOf(a);
    })[0].id;
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
    expenseParticipants = normalizeExpenseParticipants(data.expenseParticipants || data.expense_participants || []);
    expenses = normalizeExpenses(data.expenses || [], expenseReceipts, expenseParticipants);

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

        markTripModified(payload.trip_id || currentTripId);
        await loadCurrentTripData();
        setStatus('資料已同步到 Google Sheet。', 'success');

    } catch (error) {
        console.error(error);
        setStatus(`同步失敗：${error.message || error}`, 'error');
        throw error;
    }
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
    $('#rate-preview').value = `${currency} ${rate}`;
    $('#amount-twd').value = amount ? `NT$ ${money.format(Math.round(amount * rate))}` : '輸入金額後自動換算';
}

function getSelectedParticipants() {
    return Array.from(document.querySelectorAll('#participant-options input:checked')).map(input => input.value);
}

function distributeIntegerPercent(count) {
    if (!count) return [];
    const base = Math.floor(100 / count);
    let remainder = 100 - (base * count);

    return Array.from({ length: count }, () => {
        const value = base + (remainder > 0 ? 1 : 0);
        remainder -= 1;
        return value;
    });
}

function distributeAmount(totalAmount, count) {
    if (!count) return [];
    const roundedTotal = Math.round(Number(totalAmount || 0) * 100) / 100;
    const base = Math.floor((roundedTotal / count) * 100) / 100;
    let remaining = roundedTotal;

    return Array.from({ length: count }, (_, index) => {
        const value = index === count - 1 ? remaining : base;
        remaining = Math.round((remaining - value) * 100) / 100;
        return Math.round(value * 100) / 100;
    });
}

function formatAmountValue(value) {
    const number = Number(value || 0);
    return Number.isInteger(number) ? String(number) : number.toFixed(2);
}

function updateSplitSummary() {
    const summary = $('#split-summary');
    if (!summary) return;

    const inputs = Array.from(document.querySelectorAll('#split-config .split-input'));
    const kind = inputs[0]?.dataset.kind || '';
    const total = inputs.reduce((sum, input) => sum + Number(input.value || 0), 0);

    if (kind === 'percent') {
        const diff = Math.round((100 - total) * 100) / 100;
        summary.textContent = `目前合計 ${formatAmountValue(total)}%，${diff === 0 ? '剛好 100%' : diff > 0 ? `還差 ${formatAmountValue(diff)}%` : `多出 ${formatAmountValue(Math.abs(diff))}%`}。`;
        return;
    }

    if (kind === 'amount') {
        const target = Number($('#amount-original').value || 0);
        const diff = Math.round((target - total) * 100) / 100;
        summary.textContent = `目前合計 ${formatAmountValue(total)}，${diff === 0 ? '剛好等於原始金額' : diff > 0 ? `還差 ${formatAmountValue(diff)}` : `多出 ${formatAmountValue(Math.abs(diff))}`}。`;
    }
}

function renderSplitConfig() {
    const splitType = document.querySelector('input[name="split_type"]:checked')?.value || '平均分';
    const selected = getSelectedParticipants();
    const container = $('#split-config');
    if (!container) return;

    if (!selected.length || splitType === '平均分') {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }

    const isPercent = splitType === '百分比分';
    const kind = isPercent ? 'percent' : 'amount';
    const defaultValues = isPercent
        ? distributeIntegerPercent(selected.length)
        : distributeAmount(Number($('#amount-original').value || 0), selected.length);

    container.style.display = 'grid';
    container.innerHTML = `
    <label>${isPercent ? '請輸入每位比例（%）' : '請輸入每位金額（原始幣別）'}</label>
    <div class="split-input-grid">
      ${selected.map((name, index) => `
        <div class="split-input-row">
          <span>${name} 分攤</span>
          <input
            type="number"
            class="split-input"
            data-member="${name}"
            data-kind="${kind}"
            min="0"
            step="${isPercent ? '1' : '0.01'}"
            value="${isPercent ? defaultValues[index] : formatAmountValue(defaultValues[index])}"
            placeholder="${isPercent ? '例如 25' : '例如 1200'}"
          />
        </div>
      `).join('')}
    </div>
    <p class="field-hint" id="split-summary"></p>
  `;
    updateSplitSummary();
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
    if ($('#receipt-camera-files')) $('#receipt-camera-files').value = '';
}

async function getReceiptPayloads() {
    return Promise.all(selectedReceiptFiles.slice(0, MAX_RECEIPT_FILES).map(fileToBase64));
}

let expenseSearchTerm = '';
let expenseFilters = {
    quickDate: '',
    category: '',
    payer: '',
    payment: '',
    from: '',
    to: ''
};
let pendingExpenseResetCurrency = '';
let activeEditingExpenseId = '';

function safeSetText(selector, value) {
    const node = $(selector);
    if (node) node.textContent = value;
}

function safeSetHtml(selector, value) {
    const node = $(selector);
    if (node) node.innerHTML = value;
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
    if (typeof renderExpenseChart === 'function') renderExpenseChart();
    if (typeof renderBudgetChart === 'function') renderBudgetChart();
    if ($('#expense-currency') && $('#amount-original')) updateExchangePreview();
}

function isCurrentTripArchived() {
    const currentTrip_ = currentTrip();
    return archivedTrips && archivedTrips.some(trip => trip.id === currentTrip_.id);
}

function updateFormDisabledState() {
    const isArchived = isCurrentTripArchived();
    const forms = ['#member-form', '#category-form', '#payment-form', '#expense-create-form'];

    forms.forEach(formSelector => {
        const form = $(formSelector);
        if (!form) return;
        const inputs = form.querySelectorAll('input, select, textarea, button[type="submit"]');
        inputs.forEach(input => { input.disabled = isArchived; });
    });

    const archiveBtn = $('#archive-trip-btn');
    if (archiveBtn) {
        archiveBtn.disabled = isArchived;
        archiveBtn.title = isArchived ? '此旅遊已封存' : '封存目前旅遊';
    }

    if (isArchived) setStatus('已封存的旅遊不能修改。若要編輯，請先解除封存。', 'info');
}

function renderTripSelect() {
    const select = $('#trip-select');
    if (!select) return;

    const sortedTrips = [...trips].sort((a, b) => {
        const aTimestamp = getTripSortTime(a);
        const bTimestamp = getTripSortTime(b);
        if (aTimestamp && bTimestamp) return aTimestamp - bTimestamp;
        if (aTimestamp && !bTimestamp) return 1;
        if (!aTimestamp && bTimestamp) return -1;
        return trips.indexOf(a) - trips.indexOf(b);
    });

    select.innerHTML = sortedTrips.map(trip => `<option value="${trip.id}" ${trip.id === currentTripId ? 'selected' : ''}>${trip.name}</option>`).join('');
    syncIconSelect(select);
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
        <div><strong>${trip.name}</strong><small>${trip.id}</small></div>
      </div>
      <button class="icon-btn" type="button" data-unarchive-trip="${trip.id}" title="解除封存">↩</button>
    </div>
  `).join('');
}

function renderTripHeaders() {
    const trip = currentTrip();
    safeSetText('#hero-title', `${trip.name}｜快速記一筆花費。`);
    safeSetText('#summary-trip-title', `${trip.name}｜目前統計`);
    safeSetText('#summary-trip-id', trip.id);
    safeSetText('#expense-list-subtitle', `目前載入 ${trip.name} 的支出紀錄。`);
    safeSetText('#summary-member-count', `${members.length} 人`);
}

function renderRates() {
    const container = $('#rate-list');
    if (!container) return;
    container.innerHTML = Object.entries(exchangeRates).map(([currency, rate]) => `
    <div class="list-row"><div class="list-info"><span class="mini-icon">${currencySymbol(currency)}</span><div><strong>${currency} → TWD</strong><small>1 ${currency} = ${rate} TWD</small></div></div></div>
  `).join('');
}

function currencySymbol(currency) {
    return { JPY: '¥', USD: '$', KRW: '₩', EUR: '€', THB: '฿', TWD: 'NT' }[currency] || currency;
}

function renderMembers() {
    const memberList = $('#member-list');
    if (memberList) {
        memberList.innerHTML = members.map((item, index) => `
      <div class="list-row"><div class="list-info"><span class="avatar ${index === 1 ? 'green' : index === 2 ? 'orange' : index === 3 ? 'purple' : ''}">${item.avatar}</span><div><strong>${item.name}</strong><small>${item.note}</small></div></div><button class="icon-btn" type="button" data-remove="member" data-id="${item.id}" title="刪除成員">×</button></div>
    `).join('') || '<p class="field-hint">這個旅遊尚無成員。</p>';
    }

    const paidBy = $('#paid-by');
    if (paidBy) {
        const previousValue = paidBy.value;
        paidBy.innerHTML = members.map(item => `<option value="${item.name}">${item.name}</option>`).join('');
        if (previousValue && members.some(item => item.name === previousValue)) paidBy.value = previousValue;
        syncIconSelect(paidBy);
    }

    const participantOptions = $('#participant-options');
    if (participantOptions) {
        participantOptions.innerHTML = members.map(item => `<label class="check-chip"><input type="checkbox" value="${item.name}" checked /> ${item.name}</label>`).join('');
        renderSplitConfig();
    }
}

function renderList(data, listId, type) {
    const container = $(listId);
    if (!container) return;
    container.innerHTML = data.map(item => `
    <div class="list-row"><div class="list-info"><span class="mini-icon">${item.icon}</span><div><strong>${item.name}</strong><small>${item.note}</small></div></div><button class="icon-btn" type="button" data-remove="${type}" data-id="${item.id}" title="刪除">×</button></div>
  `).join('') || '<p class="field-hint">這個旅遊尚無資料。</p>';
}

function firstDisplayChar(value, fallback = '?') {
    const chars = Array.from(String(value || '').trim());
    return (chars[0] || fallback).toUpperCase();
}

function findExpenseCategoryIcon(categoryName) {
    const name = String(categoryName || '');
    const category = categories.find(item => String(item.name || '') === name);
    if (category?.icon) return category.icon;
    const expense = expenses.find(item => String(item.category || '') === name && item.icon);
    return expense?.icon || firstDisplayChar(name, '#');
}

function findExpensePaymentIcon(paymentName) {
    const name = String(paymentName || '');
    const payment = paymentMethods.find(item => String(item.name || '') === name);
    return payment?.icon || firstDisplayChar(name, '$');
}

function findExpensePayerIcon(payerName) {
    const name = String(payerName || '');
    const member = members.find(item => String(item.name || '') === name);
    return member?.avatar || firstDisplayChar(name);
}

function getExpenseFilterIconSelectConfig(select, getIcon, options = {}) {
    const firstOptionLabel = select.options[0]?.textContent || '';
    return {
        items: Array.from(select.options).map(option => {
            const value = option.value;
            return {
                value,
                label: option.textContent,
                icon: value ? getIcon(value) : '全',
                avatar: Boolean(options.avatar && value)
            };
        }),
        placeholder: firstOptionLabel,
        emptyLabel: firstOptionLabel
    };
}

function getIconSelectConfig(select) {
    if (!select) return null;
    if (select.id === 'trip-select') {
        return {
            items: Array.from(select.options).map(option => ({ value: option.value, label: option.textContent, icon: '旅' })),
            placeholder: '請選擇旅遊',
            emptyLabel: '尚無旅遊'
        };
    }
    if (select.id === 'expense-currency') {
        return {
            items: Array.from(select.options).map(option => ({
                value: option.value,
                label: option.textContent,
                icon: currencySymbol(option.value)
            })),
            placeholder: '請選擇幣別',
            emptyLabel: '尚無幣別'
        };
    }
    if (select.id === 'paid-by') {
        return {
            items: members.map(item => ({ value: item.name, label: item.name, icon: item.avatar || String(item.name || '?').slice(0, 1).toUpperCase(), avatar: true })),
            placeholder: '請選擇付款人',
            emptyLabel: '尚無成員'
        };
    }
    if (select.id === 'category-id') {
        return {
            items: categories.map(item => ({ value: item.id, label: item.name, icon: item.icon })),
            placeholder: '請選擇分類',
            emptyLabel: '尚無分類'
        };
    }
    if (select.id === 'payment-method-id') {
        return {
            items: paymentMethods.map(item => ({ value: item.id, label: item.name, icon: item.icon })),
            placeholder: '請選擇付款方式',
            emptyLabel: '尚無付款方式'
        };
    }
    if (select.id === 'expense-filter-category') {
        return getExpenseFilterIconSelectConfig(select, findExpenseCategoryIcon);
    }
    if (select.id === 'expense-filter-payer') {
        return getExpenseFilterIconSelectConfig(select, findExpensePayerIcon, { avatar: true });
    }
    if (select.id === 'expense-filter-payment') {
        return getExpenseFilterIconSelectConfig(select, findExpensePaymentIcon);
    }
    return null;
}

function syncIconSelect(select) {
    const config = getIconSelectConfig(select);
    if (!config) return;

    select.classList.add('native-icon-select');
    let wrapper = select.nextElementSibling;
    if (!wrapper || !wrapper.classList.contains('icon-select')) {
        wrapper = document.createElement('div');
        wrapper.className = 'icon-select';
        wrapper.innerHTML = `
      <button class="icon-select-trigger" type="button" aria-haspopup="listbox" aria-expanded="false">
        <span class="icon-select-value"></span>
        <span class="icon-select-arrow" aria-hidden="true">⌄</span>
      </button>
      <div class="icon-select-menu" role="listbox"></div>
    `;
        select.insertAdjacentElement('afterend', wrapper);
    }

    const selectedItem = config.items.find(item => String(item.value) === select.value);
    const valueNode = wrapper.querySelector('.icon-select-value');
    const menu = wrapper.querySelector('.icon-select-menu');
    const trigger = wrapper.querySelector('.icon-select-trigger');
    const valueHtml = selectedItem
        ? `<span class="icon-select-icon${selectedItem.avatar ? ' avatar-style' : ''}">${escapeHtml(selectedItem.icon)}</span><span>${escapeHtml(selectedItem.label)}</span>`
        : `<span class="icon-select-placeholder">${escapeHtml(config.placeholder)}</span>`;

    valueNode.innerHTML = valueHtml;
    trigger.setAttribute('aria-label', selectedItem ? `${config.placeholder}：${selectedItem.label}` : config.placeholder);
    menu.innerHTML = config.items.length
        ? config.items.map(item => `
      <button class="icon-select-option${String(item.value) === select.value ? ' selected' : ''}" type="button" role="option" aria-selected="${String(item.value) === select.value}" data-select-target="${select.id}" data-value="${escapeHtml(item.value)}">
        <span class="icon-select-icon${item.avatar ? ' avatar-style' : ''}">${escapeHtml(item.icon)}</span>
        <span>${escapeHtml(item.label)}</span>
      </button>
    `).join('')
        : `<div class="icon-select-empty">${escapeHtml(config.emptyLabel)}</div>`;
}

function closeIconSelects(exceptWrapper = null) {
    document.querySelectorAll('.icon-select.open').forEach(wrapper => {
        if (wrapper === exceptWrapper) return;
        wrapper.classList.remove('open');
        wrapper.querySelector('.icon-select-trigger')?.setAttribute('aria-expanded', 'false');
    });
}

function syncAllIconSelects() {
    document.querySelectorAll('select').forEach(syncIconSelect);
}

function getPreferredExpenseCurrency(fallback = 'JPY') {
    const lastExpense = expenses.length ? expenses[expenses.length - 1] : null;
    return String(lastExpense?.currency || localStorage.getItem('tripsplit_last_currency') || fallback).toUpperCase();
}

function applyPreferredExpenseCurrency(preferredCurrency = getPreferredExpenseCurrency()) {
    const currencySelect = $('#expense-currency');
    if (!currencySelect) return '';

    const currency = Array.from(currencySelect.options).some(option => option.value === preferredCurrency)
        ? preferredCurrency
        : 'JPY';
    currencySelect.value = currency;
    localStorage.setItem('tripsplit_last_currency', currency);
    updateExchangePreview();
    syncIconSelect(currencySelect);
    return currency;
}

function renderSelects() {
    const categorySelect = $('#category-id');
    const paymentSelect = $('#payment-method-id');
    if (categorySelect) categorySelect.innerHTML = '<option value="">請選擇分類</option>' + categories.map(item => `<option value="${item.id}">${item.name}</option>`).join('');
    if (paymentSelect) paymentSelect.innerHTML = '<option value="">請選擇付款方式</option>' + paymentMethods.map(item => `<option value="${item.id}">${item.name}</option>`).join('');

    applyPreferredExpenseCurrency();
    syncAllIconSelects();
}

function toExpenseDateKey(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const normalized = raw.replace(/\//g, '-');
    const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
    const time = Date.parse(raw);
    return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : '';
}

function getExpenseDateTime(expense) {
    const key = toExpenseDateKey(expense.date);
    const time = Date.parse(key || expense.date || '');
    return Number.isFinite(time) ? time : 0;
}

function formatExpenseDateHeading(dateKey) {
    if (!dateKey) return '未設定消費日期';
    const date = new Date(`${dateKey}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateKey;
    const weekday = new Intl.DateTimeFormat('zh-TW', { weekday: 'short' }).format(date);
    return `${formatRocDate(dateKey)} ${weekday}`;
}

function uniqueExpenseValues(key) {
    return [...new Set(expenses.map(expense => String(expense[key] || '').trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'zh-Hant'));
}

function renderExpenseFilters() {
    const setOptions = (selector, placeholder, values, selectedValue) => {
        const select = $(selector);
        if (!select) return '';
        const currentValue = selectedValue || select.value || '';
        select.innerHTML = `<option value="">${placeholder}</option>` + values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
        select.value = values.includes(currentValue) ? currentValue : '';
        return select.value;
    };

    expenseFilters.category = setOptions('#expense-filter-category', '全部分類', uniqueExpenseValues('category'), expenseFilters.category);
    expenseFilters.payer = setOptions('#expense-filter-payer', '全部付款人', uniqueExpenseValues('payer'), expenseFilters.payer);
    expenseFilters.payment = setOptions('#expense-filter-payment', '全部方式', uniqueExpenseValues('payment'), expenseFilters.payment);
    ['#expense-filter-category', '#expense-filter-payer', '#expense-filter-payment'].forEach(selector => {
        syncIconSelect($(selector));
    });

    const searchInput = $('#expense-search');
    if (searchInput) {
        const label = document.querySelector('label[for="expense-search"]');
        if (label) label.textContent = '快速搜尋';
        searchInput.placeholder = '搜尋日期、名稱、付款人、分類、付款方式...';
    }
}

function getVisibleExpenses() {
    const keyword = expenseSearchTerm.trim().toLowerCase();
    const quickDate = toExpenseDateKey(expenseFilters.quickDate);
    const fromDate = toExpenseDateKey(expenseFilters.from);
    const toDate = toExpenseDateKey(expenseFilters.to);

    return expenses.filter(expense => {
        const dateKey = toExpenseDateKey(expense.date);
        if (quickDate && dateKey !== quickDate) return false;
        if (fromDate && (!dateKey || dateKey < fromDate)) return false;
        if (toDate && (!dateKey || dateKey > toDate)) return false;
        if (expenseFilters.category && String(expense.category || '') !== expenseFilters.category) return false;
        if (expenseFilters.payer && String(expense.payer || '') !== expenseFilters.payer) return false;
        if (expenseFilters.payment && String(expense.payment || '') !== expenseFilters.payment) return false;
        if (!keyword) return true;

        return [
            dateKey,
            expense.title,
            expense.payer,
            expense.category,
            expense.payment,
            expense.currency,
            expense.split,
            String(expense.amount || ''),
            String(expense.twd || '')
        ].some(value => String(value || '').toLowerCase().includes(keyword));
    }).sort((a, b) => {
        const timeDiff = getExpenseDateTime(b) - getExpenseDateTime(a);
        if (timeDiff) return timeDiff;
        return expenses.indexOf(b) - expenses.indexOf(a);
    });
}

function groupExpensesByDate(visibleExpenses) {
    return visibleExpenses.reduce((groups, expense) => {
        const dateKey = toExpenseDateKey(expense.date);
        if (!groups.has(dateKey)) groups.set(dateKey, []);
        groups.get(dateKey).push(expense);
        return groups;
    }, new Map());
}

function renderExpenses() {
    const list = $('#expense-list');
    const total = expenses.reduce((sum, item) => sum + Number(item.twd || 0), 0);
    safeSetText('#summary-total', `NT$ ${money.format(Math.round(total))}`);
    safeSetText('#summary-count', `${expenses.length} 筆`);

    if (!list) return;
    renderExpenseFilters();

    const visibleExpenses = getVisibleExpenses();
    const groupedExpenses = groupExpensesByDate(visibleExpenses);
    const hasActiveFilters = Boolean(expenseSearchTerm || Object.values(expenseFilters).some(Boolean));

    list.innerHTML = Array.from(groupedExpenses.entries()).map(([dateKey, dayExpenses]) => {
        const dayTotal = dayExpenses.reduce((sum, expense) => sum + Number(expense.twd || 0), 0);
        return `
    <section class="expense-day-group">
      <div class="expense-day-header">
        <div>
          <strong>${formatExpenseDateHeading(dateKey)}</strong>
          <span>${dayExpenses.length} 筆支出</span>
        </div>
        <strong>NT$ ${money.format(Math.round(dayTotal))}</strong>
      </div>
      <div class="expense-day-list">
        ${dayExpenses.map(expense => `
        <article class="expense-item">
          <button class="expense-edit-badge" type="button" data-edit-expense="${escapeHtml(expense.id)}" aria-label="編輯 ${escapeHtml(expense.title || '支出')}">編輯</button>
          <div class="expense-icon">${escapeHtml(expense.icon || '')}</div>
          <div class="expense-meta">
            <strong>${escapeHtml(expense.title || '未命名支出')}</strong>
            <span>付款人 ${escapeHtml(expense.payer || '未設定')} · ${escapeHtml(expense.category || '未分類')} · ${escapeHtml(expense.payment || '未設定付款方式')} · ${escapeHtml(expense.currency || 'TWD')} ${money.format(Number(expense.amount || 0))} · 匯率 ${money.format(Number(expense.rate || 1))} · ${escapeHtml(expense.split || '')}</span>
            ${buildReceiptLinks(expense)}
          </div>
          <div class="expense-amount"><strong>NT$ ${money.format(Math.round(expense.twd || 0))}</strong></div>
        </article>
        `).join('')}
      </div>
    </section>`;
    }).join('') || `<p class="field-hint">${hasActiveFilters ? '沒有符合搜尋或篩選的支出。' : '這個旅遊目前沒有支出。'}</p>`;
}

function getExpenseById(expenseId) {
    return expenses.find(item => String(item.id) === String(expenseId)) || null;
}

function findCategoryForExpense(expense) {
    return categories.find(item => String(item.id) === String(expense.categoryId || '') || String(item.name) === String(expense.category || '')) || null;
}

function findPaymentForExpense(expense) {
    return paymentMethods.find(item => String(item.id) === String(expense.paymentMethodId || '') || String(item.name) === String(expense.payment || '')) || null;
}

function renderEditSelects(expense) {
    const paidBy = $('#edit-paid-by');
    const categorySelect = $('#edit-category-id');
    const paymentSelect = $('#edit-payment-method-id');

    if (paidBy) {
        paidBy.innerHTML = members.map(item => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join('');
        paidBy.value = expense.payer || members[0]?.name || '';
    }

    if (categorySelect) {
        categorySelect.innerHTML = categories.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('');
        categorySelect.value = findCategoryForExpense(expense)?.id || categories[0]?.id || '';
    }

    if (paymentSelect) {
        paymentSelect.innerHTML = paymentMethods.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('');
        paymentSelect.value = findPaymentForExpense(expense)?.id || paymentMethods[0]?.id || '';
    }
}

function updateEditExchangePreview() {
    const currency = $('#edit-expense-currency')?.value || 'TWD';
    const amount = Number($('#edit-amount-original')?.value || 0);
    const rate = Number(exchangeRates[currency] || 1);
    if ($('#edit-rate-preview')) $('#edit-rate-preview').value = `${currency} ${rate}`;
    if ($('#edit-amount-twd')) $('#edit-amount-twd').value = amount ? `NT$ ${money.format(Math.round(amount * rate))}` : '請輸入金額';
}

function getEditSelectedParticipants() {
    return Array.from(document.querySelectorAll('#edit-participant-options input:checked')).map(input => input.value);
}

function getEditSplitType() {
    return document.querySelector('input[name="edit_split_type"]:checked')?.value || '平均分';
}

function renderEditParticipants(expense) {
    const container = $('#edit-participant-options');
    if (!container) return;
    const selected = new Set((expense.participants && expense.participants.length ? expense.participants : members.map(item => item.name)).map(String));
    container.innerHTML = members.map(item => `
        <label class="check-chip"><input type="checkbox" value="${escapeHtml(item.name)}" ${selected.has(String(item.name)) ? 'checked' : ''} /> ${escapeHtml(item.name)}</label>
    `).join('');
}

function getEditSplitDefaults(expense, selected, kind) {
    const details = Array.isArray(expense?.splitDetails) ? expense.splitDetails : [];
    const rate = Number(expense?.rate || exchangeRates[$('#edit-expense-currency')?.value || 'TWD'] || 1) || 1;
    return selected.map((name, index) => {
        const detail = details.find(item => String(item.member_name) === String(name));
        if (detail) {
            if (kind === 'percent' && Number(detail.share_percentage)) return Number(detail.share_percentage);
            if (kind === 'amount' && Number(detail.share_amount_twd)) return Math.round((Number(detail.share_amount_twd) / rate) * 100) / 100;
        }
        if (kind === 'percent') return distributeIntegerPercent(selected.length)[index] || 0;
        return distributeAmount(Number($('#edit-amount-original')?.value || 0), selected.length)[index] || 0;
    });
}

function renderEditSplitConfig(expense = getExpenseById(activeEditingExpenseId)) {
    const splitType = getEditSplitType();
    const selected = getEditSelectedParticipants();
    const container = $('#edit-split-config');
    if (!container) return;

    if (!selected.length || splitType === '平均分') {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }

    const isPercent = splitType === '百分比分';
    const kind = isPercent ? 'percent' : 'amount';
    const defaults = getEditSplitDefaults(expense, selected, kind);

    container.style.display = 'grid';
    container.innerHTML = `
        <label>${isPercent ? '請輸入每個人的分攤比例（%）' : '請輸入每個人的分攤金額（原始幣別）'}</label>
        <div class="split-input-grid">
            ${selected.map((name, index) => `
                <div class="split-input-row">
                    <span>${escapeHtml(name)} 分攤</span>
                    <input class="split-input" type="number" data-member="${escapeHtml(name)}" data-kind="${kind}" min="0" step="${isPercent ? '1' : '0.01'}" value="${formatAmountValue(defaults[index])}" />
                </div>
            `).join('')}
        </div>
        <p class="field-hint" id="edit-split-summary"></p>
    `;
    updateEditSplitSummary();
}

function updateEditSplitSummary() {
    const summary = $('#edit-split-summary');
    if (!summary) return;
    const inputs = Array.from(document.querySelectorAll('#edit-split-config .split-input'));
    const kind = inputs[0]?.dataset.kind || '';
    const total = inputs.reduce((sum, input) => sum + Number(input.value || 0), 0);
    if (kind === 'percent') {
        const diff = Math.round((100 - total) * 100) / 100;
        summary.textContent = diff === 0 ? '合計 100%' : `目前合計 ${formatAmountValue(total)}%，差 ${formatAmountValue(Math.abs(diff))}%`;
        return;
    }
    const target = Number($('#edit-amount-original')?.value || 0);
    const diff = Math.round((target - total) * 100) / 100;
    summary.textContent = diff === 0 ? '已符合原始金額' : `目前合計 ${formatAmountValue(total)}，差 ${formatAmountValue(Math.abs(diff))}`;
}

function validateEditSplitInputs(splitType, totalAmount) {
    const selected = getEditSelectedParticipants();
    if (!selected.length) {
        alert('請至少選擇一位分帳對象。');
        return { ok: false };
    }

    if (splitType === '平均分') {
        return { ok: true, splitDetails: selected.map(memberName => ({ member_name: memberName, split_mode: 'equal' })) };
    }

    const inputs = Array.from(document.querySelectorAll('#edit-split-config .split-input'));
    if (!inputs.length || inputs.length !== selected.length) {
        alert('請確認分帳資料。');
        return { ok: false };
    }

    const splitDetails = [];
    for (const input of inputs) {
        const value = Number(input.value);
        if (!(value >= 0)) {
            alert(`請輸入 ${input.dataset.member} 的有效數字。`);
            input.focus();
            return { ok: false };
        }
        if (splitType === '百分比分') splitDetails.push({ member_name: input.dataset.member, split_mode: 'percent', share_percentage: value });
        else splitDetails.push({ member_name: input.dataset.member, split_mode: 'amount', share_amount_original: value });
    }

    const total = splitDetails.reduce((sum, item) => sum + Number(splitType === '百分比分' ? item.share_percentage : item.share_amount_original), 0);
    const target = splitType === '百分比分' ? 100 : Number(totalAmount || 0);
    if (Math.abs(total - target) > 0.01) {
        alert(splitType === '百分比分' ? '分攤比例合計需要等於 100%。' : '分攤金額合計需要等於原始金額。');
        return { ok: false };
    }

    return { ok: true, splitDetails };
}

function openExpenseEditModal(expenseId) {
    const expense = getExpenseById(expenseId);
    const modal = $('#expense-edit-modal');
    if (!expense || !modal) return;

    activeEditingExpenseId = expense.id;
    $('#edit-expense-id').value = expense.id;
    $('#edit-expense-title').value = expense.title || '';
    $('#edit-expense-date').value = toExpenseDateKey(expense.date);
    $('#edit-amount-original').value = Number(expense.amount || 0);
    $('#edit-expense-currency').value = expense.currency || 'TWD';
    $('#edit-note').value = expense.note || '';
    safeSetText('#expense-edit-meta', `建立時間：${expense.createdAt || '未記錄'}　支出 ID：${expense.id}`);
    renderEditSelects(expense);
    renderEditParticipants(expense);
    document.querySelectorAll('input[name="edit_split_type"]').forEach(input => {
        input.checked = input.value === (expense.split || '平均分');
    });
    if (!document.querySelector('input[name="edit_split_type"]:checked')) {
        const equalInput = document.querySelector('input[name="edit_split_type"][value="平均分"]');
        if (equalInput) equalInput.checked = true;
    }
    updateEditExchangePreview();
    renderEditSplitConfig(expense);
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeExpenseEditModal() {
    const modal = $('#expense-edit-modal');
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    activeEditingExpenseId = '';
    if (!$('#receipt-modal')?.classList.contains('show') && !$('#chart-zoom-modal')?.classList.contains('show')) {
        document.body.style.overflow = '';
    }
}

function buildEditExpensePayload() {
    const selectedCategory = categories.find(item => String(item.id) === $('#edit-category-id')?.value);
    const selectedPayment = paymentMethods.find(item => String(item.id) === $('#edit-payment-method-id')?.value);
    const amount = Number($('#edit-amount-original')?.value || 0);
    const currency = $('#edit-expense-currency')?.value || 'TWD';
    const rate = Number(exchangeRates[currency] || 1);
    const split = getEditSplitType();

    if (!activeEditingExpenseId || !$('#edit-expense-title')?.value.trim() || !selectedCategory || !selectedPayment || !amount) return null;
    const splitValidation = validateEditSplitInputs(split, amount);
    if (!splitValidation.ok) return null;

    return {
        trip_id: currentTripId,
        expense_id: activeEditingExpenseId,
        title: $('#edit-expense-title').value.trim(),
        payer_member_name: $('#edit-paid-by').value,
        category_id: selectedCategory.id,
        category_name: selectedCategory.name,
        payment_method_id: selectedPayment.id,
        payment_method_name: selectedPayment.name,
        expense_date: $('#edit-expense-date').value,
        amount_original: amount,
        original_currency: currency,
        exchange_rate_to_twd: rate,
        amount_twd: Math.round(amount * rate),
        split_type: split,
        split_details: splitValidation.splitDetails,
        note: $('#edit-note').value,
        participants: getEditSelectedParticipants()
    };
}

function bindTripSwitch() {
    const form = $('#trip-switch-form');
    const select = $('#trip-select');
    if (!form || !select) return;
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        currentTripId = select.value;
        localStorage.setItem('tripsplit_current_trip_id', currentTripId);
        localStorage.setItem(TRIP_SELECTION_MODE_KEY, 'manual');
        await loadCurrentTripData();
    });
    select.addEventListener('change', async () => {
        currentTripId = select.value;
        localStorage.setItem('tripsplit_current_trip_id', currentTripId);
        localStorage.setItem(TRIP_SELECTION_MODE_KEY, 'manual');
        await loadCurrentTripData();
    });
}

function bindSettingsForms() {
    const tripCreateForm = $('#trip-create-form');
    if (tripCreateForm) {
        tripCreateForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const input = $('#new-trip-name');
            const name = input.value.trim();
            if (!name) return;
            const newTripId = `trip_${Date.now()}`;
            input.value = '';
            trips.push({ id: newTripId, name, baseCurrency: 'TWD', updatedAt: new Date().toISOString() });
            currentTripId = newTripId;
            markTripModified(currentTripId);
            localStorage.setItem('tripsplit_current_trip_id', currentTripId);
            localStorage.setItem(TRIP_SELECTION_MODE_KEY, 'manual');
            renderAll();
            try {
                await jsonp('addTrip', { trip_id: newTripId, trip_name: name, base_currency: 'TWD', created_by: 'Dustin' });
                await loadTrips();
            } catch (error) {
                console.warn(error);
            }
            await loadCurrentTripData();
        });
    }

    const memberForm = $('#member-form');
    if (memberForm) {
        memberForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const input = $('#member-name');
            const name = input.value.trim();
            if (!name) return;
            input.value = '';
            await saveThenReload('addMember', { trip_id: currentTripId, member_name: name, email_or_note: '旅伴', avatar_text: name.slice(0, 1).toUpperCase() });
        });
    }

    const categoryForm = $('#category-form');
    if (categoryForm) {
        categoryForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const name = $('#new-category-name').value.trim();
            const icon = $('#new-category-icon').value.trim() || '🏷';
            if (!name) return;
            $('#new-category-name').value = '';
            $('#new-category-icon').value = '';
            await saveThenReload('addCategory', { trip_id: currentTripId, category_name: name, icon, note: '自訂分類' });
        });
    }

    const paymentForm = $('#payment-form');
    if (paymentForm) {
        paymentForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const name = $('#new-payment-name').value.trim();
            const icon = $('#new-payment-icon').value.trim() || '💳';
            if (!name) return;
            $('#new-payment-name').value = '';
            $('#new-payment-icon').value = '';
            await saveThenReload('addPaymentMethod', { trip_id: currentTripId, payment_method_name: name, icon, note: '自訂付款方式' });
        });
    }
}

function bindGlobalClicks() {
    document.addEventListener('click', async (event) => {
        const iconSelectTrigger = event.target.closest('.icon-select-trigger');
        if (iconSelectTrigger) {
            const wrapper = iconSelectTrigger.closest('.icon-select');
            const willOpen = !wrapper.classList.contains('open');
            closeIconSelects(wrapper);
            wrapper.classList.toggle('open', willOpen);
            iconSelectTrigger.setAttribute('aria-expanded', String(willOpen));
            return;
        }

        const iconSelectOption = event.target.closest('.icon-select-option');
        if (iconSelectOption) {
            const select = document.getElementById(iconSelectOption.dataset.selectTarget);
            if (select) {
                select.value = iconSelectOption.dataset.value || '';
                select.dispatchEvent(new Event('change', { bubbles: true }));
                syncIconSelect(select);
            }
            closeIconSelects();
            return;
        }

        if (!event.target.closest('.icon-select')) closeIconSelects();

        const editExpenseButton = event.target.closest('[data-edit-expense]');
        if (editExpenseButton) {
            openExpenseEditModal(editExpenseButton.dataset.editExpense);
            return;
        }

        const closeExpenseEditButton = event.target.closest('[data-close-expense-edit-modal]');
        if (closeExpenseEditButton) {
            closeExpenseEditModal();
            return;
        }

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

        const closeImportTextButton = event.target.closest('[data-close-import-text-modal]');
        if (closeImportTextButton) {
            closeImportTextModal();
            return;
        }

        const openChartZoomButton = event.target.closest('[data-open-chart-zoom]');
        if (openChartZoomButton && typeof openChartZoomModal === 'function') {
            openChartZoomModal(openChartZoomButton.dataset.openChartZoom || 'expense');
            return;
        }

        const closeChartZoomButton = event.target.closest('[data-close-chart-zoom]');
        if (closeChartZoomButton && typeof closeChartZoomModal === 'function') {
            closeChartZoomModal();
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
            const confirmArchive = confirm(`確定要封存「${currentTrip().name}」嗎？\n\n封存後，此旅遊將不再顯示在主要下拉選單中。`);
            if (!confirmArchive) return;

            await saveThenReload('archiveTrip', { trip_id: currentTripId });
            if (trips.length > 0) currentTripId = trips[0].id;
            else currentTripId = 'trip_default';
            localStorage.setItem('tripsplit_current_trip_id', currentTripId);
            localStorage.setItem(TRIP_SELECTION_MODE_KEY, 'auto');
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
        const payloadMap = { member: { trip_id: currentTripId, member_id: id }, category: { trip_id: currentTripId, category_id: id }, payment: { trip_id: currentTripId, payment_method_id: id } };
        if (!actionMap[type]) return;
        await saveThenReload(actionMap[type], payloadMap[type]);
    });
}

function getDashboardTabFromHash(hash = window.location.hash) {
    const normalizedHash = String(hash || '').toLowerCase();
    if (normalizedHash === '#expenses') return 'records';
    if (['#balances', '#settlements', '#expense-charts'].includes(normalizedHash)) return 'overview';
    return 'quick';
}

function getDashboardTabTarget(tab) {
    if (tab === 'records') return '#expenses';
    if (tab === 'overview') return '#balances';
    return '#expense-form';
}

function setDashboardTab(tab, options = {}) {
    const layout = $('.work-layout');
    const contentStack = $('.content-stack');
    const expenseForm = $('#expense-form');
    const expensesPanel = $('#expenses');
    const sideStack = $('.side-stack');
    if (!layout || !contentStack || !expenseForm || !expensesPanel || !sideStack) return;

    const activeTab = ['quick', 'records', 'overview'].includes(tab) ? tab : 'quick';
    layout.dataset.activeTab = activeTab;
    contentStack.hidden = activeTab === 'overview';
    expenseForm.hidden = activeTab !== 'quick';
    expensesPanel.hidden = activeTab !== 'records';
    sideStack.hidden = activeTab !== 'overview';

    document.querySelectorAll('[data-dashboard-tab]').forEach(button => {
        const isActive = button.dataset.dashboardTab === activeTab;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-selected', String(isActive));
    });

    if (options.updateHash) {
        const hash = getDashboardTabTarget(activeTab);
        if (window.location.hash !== hash) history.pushState(null, '', hash);
    }

    if (activeTab === 'overview') {
        if (typeof renderExpenseChart === 'function') renderExpenseChart();
        if (typeof renderBudgetChart === 'function') renderBudgetChart();
    }

    if (options.scroll) {
        const target = $(getDashboardTabTarget(activeTab));
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function bindDashboardTabs() {
    if (!$('.dashboard-tabs')) return;

    document.querySelectorAll('[data-dashboard-tab]').forEach(button => {
        button.addEventListener('click', () => {
            setDashboardTab(button.dataset.dashboardTab, { updateHash: true, scroll: true });
        });
    });

    document.addEventListener('click', (event) => {
        const link = event.target.closest('a[href^="#"]');
        if (!link) return;
        const tab = getDashboardTabFromHash(link.getAttribute('href'));
        const href = link.getAttribute('href');
        if (!['#expense-form', '#expenses', '#balances', '#settlements', '#expense-charts'].includes(href)) return;
        event.preventDefault();
        setDashboardTab(tab, { updateHash: true, scroll: true });
    });

    window.addEventListener('hashchange', () => {
        setDashboardTab(getDashboardTabFromHash(), { updateHash: false, scroll: false });
    });
    window.addEventListener('popstate', () => {
        setDashboardTab(getDashboardTabFromHash(), { updateHash: false, scroll: false });
    });

    setDashboardTab(getDashboardTabFromHash(), { updateHash: false, scroll: false });
}

function bindExpenseForm() {
    if (typeof renderExpenseChart === 'function') {
        document.querySelectorAll('input[name="chart_type"]').forEach(input => input.addEventListener('change', () => {
            renderExpenseChart();
            if ($('#chart-zoom-modal')?.classList.contains('show') && typeof renderZoomChart === 'function') renderZoomChart();
        }));
    }
    if (typeof renderBudgetChart === 'function') {
        document.querySelectorAll('input[name="chart_type_budget"]').forEach(input => input.addEventListener('change', () => {
            renderBudgetChart();
            if ($('#chart-zoom-modal')?.classList.contains('show') && typeof renderZoomChart === 'function') renderZoomChart();
        }));
    }
    window.addEventListener('resize', () => {
        if (typeof renderExpenseChart === 'function') renderExpenseChart();
        if (typeof renderBudgetChart === 'function') renderBudgetChart();
        if ($('#chart-zoom-modal')?.classList.contains('show') && typeof renderZoomChart === 'function') renderZoomChart();
    });
    if (typeof bindChartInteractions === 'function') bindChartInteractions();

    const amountInput = $('#amount-original');
    if (amountInput) {
        amountInput.addEventListener('input', () => {
            updateExchangePreview();
            const splitType = document.querySelector('input[name="split_type"]:checked')?.value || '平均分';
            if (splitType === '自訂金額') renderSplitConfig();
            else updateSplitSummary();
        });
    }

    $('#expense-currency')?.addEventListener('change', updateExchangePreview);
    $('#participant-options')?.addEventListener('change', (event) => {
        if (event.target.matches('input[type="checkbox"]')) renderSplitConfig();
    });
    document.querySelectorAll('input[name="split_type"]').forEach(input => input.addEventListener('change', renderSplitConfig));
    $('#split-config')?.addEventListener('input', (event) => {
        if (event.target.matches('.split-input')) updateSplitSummary();
    });
    ['#receipt-files', '#receipt-camera-files'].forEach(selector => {
        $(selector)?.addEventListener('change', (event) => {
            appendReceiptFiles(event.target.files || []);
            event.target.value = '';
        });
    });

    const searchInput = $('#expense-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            expenseSearchTerm = searchInput.value || '';
            renderExpenses();
        });
    }

    const filterBindings = [
        ['#expense-date-quick', 'quickDate'],
        ['#expense-filter-category', 'category'],
        ['#expense-filter-payer', 'payer'],
        ['#expense-filter-payment', 'payment'],
        ['#expense-filter-from', 'from'],
        ['#expense-filter-to', 'to']
    ];

    filterBindings.forEach(([selector, key]) => {
        const input = $(selector);
        if (!input) return;
        input.addEventListener('change', () => {
            expenseFilters[key] = input.value || '';
            if (key === 'quickDate') {
                const fromInput = $('#expense-filter-from');
                const toInput = $('#expense-filter-to');
                if (input.value) {
                    expenseFilters.from = '';
                    expenseFilters.to = '';
                    setRocDateValue(fromInput, '');
                    setRocDateValue(toInput, '');
                }
            }
            renderExpenses();
        });
    });

    $('#expense-filter-clear')?.addEventListener('click', () => {
        expenseSearchTerm = '';
        expenseFilters = { quickDate: '', category: '', payer: '', payment: '', from: '', to: '' };
        if (searchInput) searchInput.value = '';
        filterBindings.forEach(([selector]) => {
            const input = $(selector);
            setRocDateValue(input, '');
        });
        renderExpenses();
    });

    const dateInput = $('#expense-date');
    if (dateInput && !dateInput.value) {
        setRocDateValue(dateInput, getLocalTodayIso());
    }

    $('#edit-expense-currency')?.addEventListener('change', () => {
        updateEditExchangePreview();
        renderEditSplitConfig();
    });
    $('#edit-amount-original')?.addEventListener('input', () => {
        updateEditExchangePreview();
        renderEditSplitConfig();
    });
    $('#edit-participant-options')?.addEventListener('change', (event) => {
        if (event.target.matches('input[type="checkbox"]')) renderEditSplitConfig();
    });
    $('#edit-split-config')?.addEventListener('input', (event) => {
        if (event.target.matches('.split-input')) updateEditSplitSummary();
    });
    document.querySelectorAll('input[name="edit_split_type"]').forEach(input => {
        input.addEventListener('change', () => renderEditSplitConfig());
    });
    $('#expense-edit-form')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const payload = buildEditExpensePayload();
        if (!payload) return;
        await saveThenReload('updateExpense', payload, 900);
        closeExpenseEditModal();
    });
    $('#expense-soft-delete-btn')?.addEventListener('click', async () => {
        if (!activeEditingExpenseId) return;
        const expense = getExpenseById(activeEditingExpenseId);
        if (!confirm(`確定要軟刪除「${expense?.title || '這筆支出'}」嗎？\n\n刪除後不會出現在支出紀錄、總額與圖表中。`)) return;
        await saveThenReload('deleteExpense', { trip_id: currentTripId, expense_id: activeEditingExpenseId }, 900);
        closeExpenseEditModal();
    });

    const expenseForm = $('#expense-create-form');
    if (!expenseForm) return;
    expenseForm.addEventListener('reset', () => {
        window.setTimeout(() => {
            const resetCurrency = pendingExpenseResetCurrency;
            pendingExpenseResetCurrency = '';
            clearReceiptFiles();
            applyPreferredExpenseCurrency(resetCurrency || getPreferredExpenseCurrency());
            updateExchangePreview();
            renderSplitConfig();
            syncAllIconSelects();
            setRocDateValue(dateInput, getLocalTodayIso());
        }, 0);
    });
    expenseForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const selectedCategory = categories.find(item => String(item.id) === $('#category-id').value);
        const selectedPayment = paymentMethods.find(item => String(item.id) === $('#payment-method-id').value);
        const amount = Number($('#amount-original').value || 0);
        const currency = $('#expense-currency').value;
        const rate = Number(exchangeRates[currency] || 1);
        const split = document.querySelector('input[name="split_type"]:checked')?.value || '平均分';
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

        localStorage.setItem('tripsplit_last_currency', currency);
        pendingExpenseResetCurrency = currency;
        expenseForm.reset();
        applyPreferredExpenseCurrency(currency);
        clearReceiptFiles();
        setRocDateValue(dateInput, getLocalTodayIso());
        updateExchangePreview();
        renderSplitConfig();
        setDashboardTab('records', { updateHash: true, scroll: true });
    });
}

// ── 匯入文字品項 Modal ───────────────────────────────────────────────────────
let importTextItems = []; // 保持 modal 內資料

let activeImportTextIndex = 0;

function openImportTextModal() {
    const modal = $('#import-text-modal');
    if (!modal) return;
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    ensureImportTextControls();
    renderImportTextResult();
}

function closeImportTextModal() {
    const modal = $('#import-text-modal');
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
}

function parseImportText(raw) {
    return raw.split('\n')
        .map(line => line.trim())
        .filter(line => line.includes('|'))
        .map(line => {
            const parts = line.split('|');
            const date = (parts[0] || '').trim();
            const title = (parts[1] || '').trim();
            const amountRaw = (parts[2] || '').trim().replace(/[^0-9.]/g, '');
            const amount = Number(amountRaw) || 0;
            return { date, title, amount };
        })
        .filter(item => item.title);
}

function ensureImportTextControls() {
    const openButton = $('#open-import-text-btn');
    if (openButton && !openButton.parentElement?.classList.contains('import-text-header-actions')) {
        const actions = document.createElement('div');
        actions.className = 'import-text-header-actions';
        openButton.insertAdjacentElement('beforebegin', actions);
        actions.appendChild(openButton);
        const existingFormNav = $('#import-text-form-nav');
        if (existingFormNav) actions.appendChild(existingFormNav);
    }

    if (openButton && !$('#import-text-count-badge')) {
        openButton.classList.add('import-text-open-btn');
        const badge = document.createElement('span');
        badge.className = 'import-text-count-badge';
        badge.id = 'import-text-count-badge';
        badge.hidden = true;
        badge.textContent = '0';
        openButton.appendChild(badge);
    }

    if (openButton && openButton.parentElement && !$('#import-text-form-nav')) {
        const formNav = document.createElement('div');
        formNav.className = 'import-text-form-nav';
        formNav.id = 'import-text-form-nav';
        formNav.hidden = true;
        formNav.innerHTML = `
            <button class="import-text-nav-btn import-text-form-nav-btn" type="button" id="import-text-form-prev-btn" aria-label="上一筆匯入品項">‹</button>
            <span class="import-text-nav-status" id="import-text-form-nav-status">0 / 0</span>
            <button class="import-text-nav-btn import-text-form-nav-btn" type="button" id="import-text-form-next-btn" aria-label="下一筆匯入品項">›</button>
        `;
        openButton.parentElement.appendChild(formNav);
    }

    const modalTitle = $('#import-text-modal .import-text-header h2');
    if (modalTitle && !$('#import-text-title-badge')) {
        modalTitle.classList.add('import-text-title-with-badge');
        const titleBadge = document.createElement('span');
        titleBadge.className = 'import-text-count-badge import-text-title-badge';
        titleBadge.id = 'import-text-title-badge';
        titleBadge.hidden = true;
        titleBadge.textContent = '0';
        modalTitle.appendChild(titleBadge);
    }

    const section = $('#import-text-result-section');
    const list = $('#import-text-result-list');
    if (section && list && !$('#import-text-nav-status')) {
        const toolbar = document.createElement('div');
        toolbar.className = 'import-text-result-toolbar';
        toolbar.innerHTML = `
            <div class="import-text-section-label">解析結果（點「帶入」填入新增支出表單）</div>
            <div class="import-text-nav-actions" aria-label="切換匯入文字品項">
                <button class="import-text-nav-btn" type="button" id="import-text-prev-btn" aria-label="上一筆">‹</button>
                <span class="import-text-nav-status" id="import-text-nav-status">0 / 0</span>
                <button class="import-text-nav-btn" type="button" id="import-text-next-btn" aria-label="下一筆">›</button>
                <button class="btn btn-primary import-text-current-btn" type="button" id="import-text-current-btn">帶入目前</button>
            </div>
        `;
        const existingLabel = section.querySelector('.import-text-section-label');
        if (existingLabel) existingLabel.replaceWith(toolbar);
        else section.insertBefore(toolbar, list);
    }
}

function updateImportTextCountBadge() {
    ensureImportTextControls();
    const count = importTextItems.length;
    document.querySelectorAll('.import-text-count-badge').forEach(badge => {
        badge.textContent = String(count);
        badge.hidden = count <= 0;
    });
    updateImportTextFormNav();
}

function updateImportTextFormNav() {
    const nav = $('#import-text-form-nav');
    const status = $('#import-text-form-nav-status');
    const prevBtn = $('#import-text-form-prev-btn');
    const nextBtn = $('#import-text-form-next-btn');
    if (!nav) return;

    const count = importTextItems.length;
    nav.hidden = count <= 0;
    if (status) status.textContent = count > 0 ? `${activeImportTextIndex + 1} / ${count}` : '0 / 0';
    [prevBtn, nextBtn].forEach(button => {
        if (button) button.disabled = count <= 0;
    });
}

function clampActiveImportTextIndex() {
    if (!importTextItems.length) {
        activeImportTextIndex = 0;
        return;
    }
    activeImportTextIndex = Math.min(Math.max(activeImportTextIndex, 0), importTextItems.length - 1);
}

function setActiveImportTextIndex(index) {
    if (!importTextItems.length) return;
    activeImportTextIndex = (index + importTextItems.length) % importTextItems.length;
    renderImportTextResult();
    $(`[data-import-idx="${activeImportTextIndex}"]`)?.scrollIntoView({ block: 'nearest' });
}

function importTextItemToForm(index, options = {}) {
    const item = importTextItems[index];
    if (!item) return false;

    const titleInput = $('#expense-title');
    const dateInput = $('#expense-date');
    const amountInput = $('#amount-original');
    if (titleInput) titleInput.value = item.title;
    if (dateInput && item.date) {
        const normalized = item.date.replace(/\//g, '-');
        setRocDateValue(dateInput, normalized);
    }
    if (amountInput) {
        amountInput.value = item.amount;
        updateExchangePreview();
    }

    activeImportTextIndex = index;
    updateImportTextFormNav();
    if (options.closeModal !== false) closeImportTextModal();
    if (options.scroll !== false) setDashboardTab('quick', { updateHash: true, scroll: true });
    return true;
}

function stepImportTextItemOnForm(step) {
    if (!importTextItems.length) return;
    const nextIndex = (activeImportTextIndex + step + importTextItems.length) % importTextItems.length;
    importTextItemToForm(nextIndex, { closeModal: false, scroll: false });
    renderImportTextResult();
}

function renderImportTextResult() {
    ensureImportTextControls();
    updateImportTextCountBadge();
    const section = $('#import-text-result-section');
    const list = $('#import-text-result-list');
    if (!section || !list) return;
    if (!importTextItems.length) { section.style.display = 'none'; return; }
    clampActiveImportTextIndex();
    section.style.display = '';
    const status = $('#import-text-nav-status');
    const prevBtn = $('#import-text-prev-btn');
    const nextBtn = $('#import-text-next-btn');
    const currentBtn = $('#import-text-current-btn');
    if (status) status.textContent = `${activeImportTextIndex + 1} / ${importTextItems.length}`;
    [prevBtn, nextBtn, currentBtn].forEach(button => {
        if (button) button.disabled = importTextItems.length <= 0;
    });
    list.innerHTML = importTextItems.map((item, idx) => `
    <div class="import-text-result-row${idx === activeImportTextIndex ? ' active' : ''}" data-import-idx="${idx}">
      <div class="import-text-result-info">
        <span class="import-text-result-date">${escapeHtml(formatRocDate(parseRocDate(item.date)) || item.date)}</span>
        <span class="import-text-result-title">${escapeHtml(item.title)}</span>
        <span class="import-text-result-amount">${item.amount.toLocaleString()}</span>
      </div>
      <div class="import-text-result-btns">
        <button class="btn btn-primary" type="button" data-import-item="${idx}" style="font-size:.82rem;padding:5px 14px;">帶入</button>
        <button class="btn btn-ghost" type="button" data-remove-import-item="${idx}" style="font-size:.82rem;padding:5px 10px;">✕</button>
      </div>
    </div>
  `).join('');
}

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function bindImportTextModal() {
    ensureImportTextControls();
    updateImportTextCountBadge();

    $('#open-import-text-btn')?.addEventListener('click', openImportTextModal);

    $('#copy-ai-prompt-btn')?.addEventListener('click', () => {
        const text = $('#ai-prompt-text')?.textContent || '';
        navigator.clipboard?.writeText(text).then(() => {
            const btn = $('#copy-ai-prompt-btn');
            if (btn) { btn.textContent = '已複製！'; setTimeout(() => { btn.textContent = '複製'; }, 1800); }
        });
    });

    $('#parse-import-text-btn')?.addEventListener('click', () => {
        const raw = $('#import-text-textarea')?.value || '';
        importTextItems = parseImportText(raw);
        activeImportTextIndex = 0;
        // clear textarea after parsing, per spec: 匯入新的資料要先清除後再進行導入
        const ta = $('#import-text-textarea');
        if (ta) ta.value = '';
        renderImportTextResult();
    });

    $('#clear-import-text-btn')?.addEventListener('click', () => {
        const ta = $('#import-text-textarea');
        if (ta) ta.value = '';
        importTextItems = [];
        activeImportTextIndex = 0;
        renderImportTextResult();
    });

    $('#import-text-prev-btn')?.addEventListener('click', () => {
        setActiveImportTextIndex(activeImportTextIndex - 1);
    });

    $('#import-text-next-btn')?.addEventListener('click', () => {
        setActiveImportTextIndex(activeImportTextIndex + 1);
    });

    $('#import-text-current-btn')?.addEventListener('click', () => {
        importTextItemToForm(activeImportTextIndex);
    });

    $('#import-text-form-prev-btn')?.addEventListener('click', () => {
        stepImportTextItemOnForm(-1);
    });

    $('#import-text-form-next-btn')?.addEventListener('click', () => {
        stepImportTextItemOnForm(1);
    });

    $('#import-text-result-list')?.addEventListener('click', (event) => {
        const importBtn = event.target.closest('[data-import-item]');
        if (importBtn) {
            const idx = Number(importBtn.dataset.importItem);
            importTextItemToForm(idx);
            return;
        }

        const removeBtn = event.target.closest('[data-remove-import-item]');
        if (removeBtn) {
            const idx = Number(removeBtn.dataset.removeImportItem);
            importTextItems.splice(idx, 1);
            if (idx <= activeImportTextIndex) activeImportTextIndex -= 1;
            clampActiveImportTextIndex();
            renderImportTextResult();
            return;
        }

        const row = event.target.closest('[data-import-idx]');
        if (row) {
            setActiveImportTextIndex(Number(row.dataset.importIdx));
        }
    });
}

// ── End 匯入文字品項 Modal ───────────────────────────────────────────────────
function bindKeyboard() {
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        if (activeRocDateInput) {
            closeRocDatePicker();
            return;
        }
        if (document.querySelector('.icon-select.open')) {
            closeIconSelects();
            return;
        }
        if ($('#expense-edit-modal')?.classList.contains('show')) {
            closeExpenseEditModal();
            return;
        }
        if ($('#import-text-modal')?.classList.contains('show')) {
            closeImportTextModal();
            return;
        }
        if ($('#chart-zoom-modal')?.classList.contains('show') && typeof closeChartZoomModal === 'function') {
            closeChartZoomModal();
            return;
        }
        if ($('#receipt-modal')?.classList.contains('show')) closeReceiptModal();
    });
}

function bindAppEvents() {
    enhanceRocDateInputs();
    bindTripSwitch();
    bindSettingsForms();
    bindGlobalClicks();
    bindDashboardTabs();
    bindExpenseForm();
    bindKeyboard();
    bindImportTextModal();
}

(async function init() {
    bindAppEvents();
    renderAll();
    await loadTrips();
    await loadCurrentTripData();
})();
