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
