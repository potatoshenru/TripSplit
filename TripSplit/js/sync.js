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
