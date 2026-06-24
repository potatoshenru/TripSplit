/* TripSplit module split from assets/app.js. Keep classic script order in HTML. */
function buildGasUrl(baseUrl, query) {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}${query.toString()}`;
}

const money = new Intl.NumberFormat('zh-TW');
const $ = (selector) => document.querySelector(selector);
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getPreviewTripIdFromUrl() {
    return new URLSearchParams(window.location.search).get('trip_id') || '';
}

function buildArchivedTripPreviewUrl(tripId) {
    const baseUrl = new URL('TripSplit.html', window.location.href);
    baseUrl.search = '';
    baseUrl.hash = '';
    return `${baseUrl.href}?preview=1&trip_id=${encodeURIComponent(String(tripId || ''))}#expenses`;
}

async function copyTextToClipboard(text) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('Clipboard copy failed');
}

function formatTwd(value) {
    return `NT$ ${money.format(Math.round(Math.abs(Number(value || 0))))}`;
}

function formatSignedTwd(value) {
    const amount = Math.round(Number(value || 0));
    return `${amount < 0 ? '-' : ''}NT$ ${money.format(Math.abs(amount))}`;
}

function getResultAmount(item) {
    const amount = Number(item?.amount || 0);
    return Number.isFinite(amount) ? amount : 0;
}

function formatCurrencyAmount(amount, currency) {
    const normalizedCurrency = String(currency || 'TWD').toUpperCase();
    const rounded = Math.round(Number(amount || 0));
    if (normalizedCurrency === 'TWD') return `NT$${money.format(rounded)}`;
    return `${normalizedCurrency} ${money.format(rounded)}`;
}

function convertToTwd(amount, exchangeRate) {
    const value = Number(amount || 0);
    const rate = Number(exchangeRate || 0);
    if (!Number.isFinite(value) || !Number.isFinite(rate) || rate <= 0) return 0;
    return Math.round(value * rate);
}

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


function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
