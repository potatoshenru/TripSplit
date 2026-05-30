/**
 * TripSplit GAS backend
 * 功能：
 * 1. 將旅遊記帳資料存到 Google Sheet
 * 2. 分類可新增 / 讀取
 * 3. 付款方式可新增 / 讀取
 * 4. 支出可新增 / 讀取
 * 5. 收據可上傳到 Google Drive，並把連結存回 Sheet
 *
 * 使用方式：
 * 1. 建立一個 Google Sheet
 * 2. 到「擴充功能」→「Apps Script」
 * 3. 貼上此檔案作為 Code.gs
 * 4. 修改 SPREADSHEET_ID 與 RECEIPT_FOLDER_ID
 * 5. 執行 setupSheets()
 * 6. 部署成 Web App
 */

const SPREADSHEET_ID = '1Ay8Hq0IdggCA_zGQn8lWVHpLpeqQiaSpLPs6kx5wsD0';
const RECEIPT_FOLDER_ID = '1Mig5ad5Ie5dD5odk7-0eZKQCeBuq3B8i';

const SHEET_NAMES = {
  trips: 'trips',
  members: 'members',
  categories: 'categories',
  paymentMethods: 'payment_methods',
  exchangeRates: 'exchange_rates',
  expenses: 'expenses',
  receipts: 'expense_receipts',
  participants: 'expense_participants'
};

function getHandlers_() {
  return {
    setup: setupSheets,
    getTrips: getTrips,
    getArchivedTrips: getArchivedTrips,
    addTrip: addTrip,
    archiveTrip: archiveTrip,
    unarchiveTrip: unarchiveTrip,
    getInitialData: getInitialData,
    addCategory: addCategory,
    deleteCategory: deleteCategory,
    addPaymentMethod: addPaymentMethod,
    deletePaymentMethod: deletePaymentMethod,
    addMember: addMember,
    deleteMember: deleteMember,
    addExpense: addExpense,
    getExpenses: getExpenses,
    syncExchangeRates: syncExchangeRates,
    ping: function () {
      return {
        message: 'TripSplit GAS API is running.',
        time: new Date()
      };
    }
  };
}

function runAction_(action, payload) {
  const handlers = getHandlers_();

  if (!action || !handlers[action]) {
    throw new Error('Unknown action: ' + action);
  }

  return handlers[action](payload || {});
}

function doGet(e) {
  const params = (e && e.parameter) || {};
  const callback = params.callback || '';
  const action = params.action || '';

  if (!action && !callback) {
    return HtmlService
      .createHtmlOutput('<!doctype html><html><head><meta charset="utf-8"><title>TripSplit GAS API</title></head><body>TripSplit GAS API is running.</body></html>')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  try {
    const payload = params.payload ? safeJsonParse_(params.payload, {}) : {};

    return gasOutput_({
      ok: true,
      data: runAction_(action, payload)
    }, callback);

  } catch (error) {
    return gasOutput_({
      ok: false,
      error: error.message || String(error)
    }, callback);
  }
}

function doPost(e) {
  try {
    const body = parseRequestBody(e);
    const action = body.action || '';
    const payload = body.payload || {};

    return jsonResponse({
      ok: true,
      data: runAction_(action, payload)
    });

  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error.message || String(error)
    });
  }
}

function ss() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function sheet(name) {
  const spreadsheet = ss();
  let target = spreadsheet.getSheetByName(name);
  if (!target) {
    target = spreadsheet.insertSheet(name);
  }
  return target;
}

function setupSheets() {
  const schemas = {
    [SHEET_NAMES.trips]: [
      'trip_id', 'trip_name', 'base_currency', 'created_by', 'created_at', 'updated_at', 'is_archived'
    ],
    [SHEET_NAMES.members]: [
      'member_id', 'trip_id', 'member_name', 'email_or_note', 'avatar_text', 'created_at', 'is_active'
    ],
    [SHEET_NAMES.categories]: [
      'category_id', 'trip_id', 'category_name', 'icon', 'note', 'created_at', 'is_active'
    ],
    [SHEET_NAMES.paymentMethods]: [
      'payment_method_id', 'trip_id', 'payment_method_name', 'icon', 'note', 'created_at', 'is_active'
    ],
    [SHEET_NAMES.exchangeRates]: [
      'rate_id', 'base_currency', 'target_currency', 'rate_to_twd', 'provider', 'fetched_at'
    ],
    [SHEET_NAMES.expenses]: [
      'expense_id', 'trip_id', 'title', 'payer_member_name', 'category_id', 'category_name',
      'payment_method_id', 'payment_method_name', 'expense_date', 'amount_original',
      'original_currency', 'exchange_rate_to_twd', 'amount_twd', 'split_type', 'note', 'created_at'
    ],
    [SHEET_NAMES.receipts]: [
      'receipt_id', 'expense_id', 'file_name', 'mime_type', 'drive_file_id', 'drive_url', 'created_at'
    ],
    [SHEET_NAMES.participants]: [
      'participant_id', 'expense_id', 'member_name', 'share_amount_twd', 'share_percentage', 'created_at'
    ]
  };

  Object.keys(schemas).forEach((name) => {
    const target = sheet(name);
    target.clear();
    target.getRange(1, 1, 1, schemas[name].length).setValues([schemas[name]]);
    target.setFrozenRows(1);
    target.autoResizeColumns(1, schemas[name].length);
  });

  seedDefaultData();

  return {
    message: 'Sheets created successfully.',
    sheets: Object.keys(schemas)
  };
}

function seedDefaultData() {
  const now = new Date();
  const tripId = 'trip_default';

  appendObject(SHEET_NAMES.trips, {
    trip_id: tripId,
    trip_name: '東京五日遊',
    base_currency: 'TWD',
    created_by: 'Dustin',
    created_at: now,
    updated_at: now,
    is_archived: false
  });

  [
    ['mem_1', 'Dustin', '發起人', 'D'],
    ['mem_2', 'Amy', '旅伴', 'A'],
    ['mem_3', 'Ben', '旅伴', 'B'],
    ['mem_4', 'Cindy', '旅伴', 'C']
  ].forEach(([memberId, name, note, avatar]) => {
    appendObject(SHEET_NAMES.members, {
      member_id: memberId,
      trip_id: tripId,
      member_name: name,
      email_or_note: note,
      avatar_text: avatar,
      created_at: now,
      is_active: true
    });
  });

  [
    ['cat_1', '餐飲', '🍜', '預設分類'],
    ['cat_2', '早餐', '🍳', '自訂分類'],
    ['cat_3', '門票', '🎟', '自訂分類'],
    ['cat_4', '交通', '🚆', '預設分類'],
    ['cat_5', '住宿', '🏨', '預設分類'],
    ['cat_6', '購物', '🛍', '預設分類']
  ].forEach(([categoryId, name, icon, note]) => {
    appendObject(SHEET_NAMES.categories, {
      category_id: categoryId,
      trip_id: tripId,
      category_name: name,
      icon,
      note,
      created_at: now,
      is_active: true
    });
  });

  [
    ['pay_1', '現金', '💵', '預設方式'],
    ['pay_2', 'Visa', '💳', '信用卡'],
    ['pay_3', 'LINE Pay', '📱', '行動支付'],
    ['pay_4', 'Suica', '🚇', '交通卡']
  ].forEach(([paymentMethodId, name, icon, note]) => {
    appendObject(SHEET_NAMES.paymentMethods, {
      payment_method_id: paymentMethodId,
      trip_id: tripId,
      payment_method_name: name,
      icon,
      note,
      created_at: now,
      is_active: true
    });
  });

  const rates = {
    JPY: 0.2185,
    USD: 32.1,
    KRW: 0.0235,
    EUR: 34.8,
    THB: 0.88,
    TWD: 1
  };

  Object.keys(rates).forEach((currency) => {
    appendObject(SHEET_NAMES.exchangeRates, {
      rate_id: createId('rate'),
      base_currency: currency,
      target_currency: 'TWD',
      rate_to_twd: rates[currency],
      provider: 'seed',
      fetched_at: now
    });
  });
}

function getInitialData(payload) {
  const tripId = payload.trip_id || 'trip_default';
  const expenses = getExpenses({ trip_id: tripId });

  return {
    trip: findFirst(SHEET_NAMES.trips, { trip_id: tripId }),
    members: findRows(SHEET_NAMES.members, { trip_id: tripId, is_active: true }),
    categories: findRows(SHEET_NAMES.categories, { trip_id: tripId, is_active: true }),
    paymentMethods: findRows(SHEET_NAMES.paymentMethods, { trip_id: tripId, is_active: true }),
    exchangeRates: getLatestRates(),
    expenses: expenses,
    expenseReceipts: getReceiptsByExpenseIds(expenses.map(function(item) { return item.expense_id; }))
  };
}

function addMember(payload) {
  const row = {
    member_id: createId('mem'),
    trip_id: payload.trip_id || 'trip_default',
    member_name: required(payload.member_name, 'member_name'),
    email_or_note: payload.email_or_note || '',
    avatar_text: payload.avatar_text || String(payload.member_name).trim().slice(0, 1).toUpperCase(),
    created_at: new Date(),
    is_active: true
  };

  appendObject(SHEET_NAMES.members, row);
  return row;
}

function deleteMember(payload) {
  return softDeleteById(SHEET_NAMES.members, 'member_id', required(payload.member_id, 'member_id'));
}

function addCategory(payload) {
  const row = {
    category_id: createId('cat'),
    trip_id: payload.trip_id || 'trip_default',
    category_name: required(payload.category_name, 'category_name'),
    icon: payload.icon || '🏷',
    note: payload.note || '自訂分類',
    created_at: new Date(),
    is_active: true
  };

  appendObject(SHEET_NAMES.categories, row);
  return row;
}

function deleteCategory(payload) {
  return softDeleteById(SHEET_NAMES.categories, 'category_id', required(payload.category_id, 'category_id'));
}

function addPaymentMethod(payload) {
  const row = {
    payment_method_id: createId('pay'),
    trip_id: payload.trip_id || 'trip_default',
    payment_method_name: required(payload.payment_method_name, 'payment_method_name'),
    icon: payload.icon || '💳',
    note: payload.note || '自訂付款方式',
    created_at: new Date(),
    is_active: true
  };

  appendObject(SHEET_NAMES.paymentMethods, row);
  return row;
}

function deletePaymentMethod(payload) {
  return softDeleteById(SHEET_NAMES.paymentMethods, 'payment_method_id', required(payload.payment_method_id, 'payment_method_id'));
}

function addExpense(payload) {
  const tripId = payload.trip_id || 'trip_default';
  const currency = required(payload.original_currency, 'original_currency');
  const amountOriginal = Number(required(payload.amount_original, 'amount_original'));
  const rate = Number(payload.exchange_rate_to_twd || getRateToTwd(currency));
  const amountTwd = Math.round(amountOriginal * rate);
  const expenseId = createId('exp');
  const now = new Date();

  const category = findFirst(SHEET_NAMES.categories, {
    category_id: required(payload.category_id, 'category_id')
  });

  const paymentMethod = findFirst(SHEET_NAMES.paymentMethods, {
    payment_method_id: required(payload.payment_method_id, 'payment_method_id')
  });

  const expenseRow = {
    expense_id: expenseId,
    trip_id: tripId,
    title: required(payload.title, 'title'),
    payer_member_name: required(payload.payer_member_name, 'payer_member_name'),
    category_id: payload.category_id,
    category_name: category ? category.category_name : payload.category_name || '',
    payment_method_id: payload.payment_method_id,
    payment_method_name: paymentMethod ? paymentMethod.payment_method_name : payload.payment_method_name || '',
    expense_date: payload.expense_date || '',
    amount_original: amountOriginal,
    original_currency: currency,
    exchange_rate_to_twd: rate,
    amount_twd: amountTwd,
    split_type: payload.split_type || '平均分',
    note: payload.note || '',
    created_at: now
  };

  appendObject(SHEET_NAMES.expenses, expenseRow);

  const participantNames = (payload.participants || []).map(function(participant) {
    return participant && participant.member_name ? participant.member_name : participant;
  }).filter(function(name) {
    return !!name;
  });

  const splitDetails = Array.isArray(payload.split_details) ? payload.split_details : [];
  const splitMap = {};
  splitDetails.forEach(function(detail) {
    if (!detail || !detail.member_name) return;
    splitMap[detail.member_name] = detail;
  });

  const splitType = payload.split_type || '平均分';
  const participantsCount = participantNames.length || 1;

  participantNames.forEach(function(memberName) {
    const detail = splitMap[memberName] || {};
    let shareAmountTwd = '';
    let sharePercentage = '';

    if (splitType === '百分比分') {
      const percent = Number(detail.share_percentage || 0);
      sharePercentage = percent;
      shareAmountTwd = Math.round(amountTwd * (percent / 100));
    } else if (splitType === '自訂金額') {
      const shareAmountOriginal = Number(detail.share_amount_original || 0);
      shareAmountTwd = Math.round(shareAmountOriginal * rate);
      if (amountOriginal > 0) {
        sharePercentage = Number(((shareAmountOriginal / amountOriginal) * 100).toFixed(4));
      }
    } else {
      shareAmountTwd = Math.round(amountTwd / participantsCount);
      sharePercentage = Number((100 / participantsCount).toFixed(4));
    }

    appendObject(SHEET_NAMES.participants, {
      participant_id: createId('part'),
      expense_id: expenseId,
      member_name: memberName,
      share_amount_twd: shareAmountTwd,
      share_percentage: sharePercentage,
      created_at: now
    });
  });

  const uploadedReceipts = uploadReceiptFiles(expenseId, payload.receipts || []);

  return {
    expense: expenseRow,
    receipts: uploadedReceipts
  };
}

function getExpenses(payload) {
  const tripId = payload.trip_id || 'trip_default';
  return findRows(SHEET_NAMES.expenses, { trip_id: tripId }).reverse();
}

function getReceiptsByExpenseIds(expenseIds) {
  const idSet = {};
  (expenseIds || []).forEach(function(id) {
    if (!id) return;
    idSet[String(id)] = true;
  });

  if (!Object.keys(idSet).length) return [];

  return getObjects(SHEET_NAMES.receipts).filter(function(row) {
    return idSet[String(row.expense_id)];
  });
}

function uploadReceiptFiles(expenseId, receipts) {
  if (!receipts || !receipts.length) {
    return [];
  }

  const folder = DriveApp.getFolderById(RECEIPT_FOLDER_ID);
  const uploaded = [];

  receipts.forEach(function(receipt, index) {
    if (!receipt || !receipt.base64) return;

    const bytes = Utilities.base64Decode(receipt.base64);
    const mimeType = receipt.mimeType || 'image/jpeg';
    const fileName = receipt.fileName || expenseId + '_receipt_' + (index + 1) + '.jpg';
    const blob = Utilities.newBlob(bytes, mimeType, fileName);
    const file = folder.createFile(blob);

    // 讓前端可以打開 / 預覽圖片
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const row = {
      receipt_id: createId('receipt'),
      expense_id: expenseId,
      file_name: fileName,
      mime_type: mimeType,
      drive_file_id: file.getId(),
      drive_url: file.getUrl(),
      created_at: new Date()
    };

    appendObject(SHEET_NAMES.receipts, row);
    uploaded.push(row);
  });

  return uploaded;
}

function syncExchangeRates() {
  const currencies = ['JPY', 'USD', 'KRW', 'EUR', 'THB', 'TWD'];
  const rates = fetchRatesToTwd(currencies);
  const now = new Date();

  currencies.forEach((currency) => {
    appendObject(SHEET_NAMES.exchangeRates, {
      rate_id: createId('rate'),
      base_currency: currency,
      target_currency: 'TWD',
      rate_to_twd: rates[currency],
      provider: 'open.er-api.com',
      fetched_at: now
    });
  });

  return {
    fetched_at: now,
    rates
  };
}

function fetchRatesToTwd(currencies) {
  const url = 'https://open.er-api.com/v6/latest/TWD';
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const status = response.getResponseCode();

  if (status < 200 || status >= 300) {
    throw new Error(`Exchange rate API failed. HTTP ${status}`);
  }

  const data = JSON.parse(response.getContentText());
  const apiRates = data.rates || {};
  const result = {};

  currencies.forEach((currency) => {
    if (currency === 'TWD') {
      result[currency] = 1;
      return;
    }

    if (!apiRates[currency]) {
      throw new Error(`Missing rate for ${currency}`);
    }

    // API 回傳的是 1 TWD = N 外幣，所以換成 1 外幣 = X TWD
    result[currency] = Number((1 / Number(apiRates[currency])).toFixed(6));
  });

  return result;
}

function getRateToTwd(currency) {
  if (currency === 'TWD') return 1;

  const rows = findRows(SHEET_NAMES.exchangeRates, {
    base_currency: currency,
    target_currency: 'TWD'
  });

  if (!rows.length) {
    throw new Error(`No exchange rate found for ${currency} to TWD.`);
  }

  rows.sort((a, b) => new Date(b.fetched_at) - new Date(a.fetched_at));
  return Number(rows[0].rate_to_twd);
}

function getLatestRates() {
  const rows = getObjects(SHEET_NAMES.exchangeRates);
  const latest = {};

  rows.forEach((row) => {
    const key = `${row.base_currency}_${row.target_currency}`;
    if (!latest[key] || new Date(row.fetched_at) > new Date(latest[key].fetched_at)) {
      latest[key] = row;
    }
  });

  return Object.values(latest);
}

function appendObject(sheetName, object) {
  const target = sheet(sheetName);
  const headers = getHeaders(target);
  const values = headers.map((header) => object[header] !== undefined ? object[header] : '');
  target.appendRow(values);
  return object;
}

function getObjects(sheetName) {
  const target = sheet(sheetName);
  const values = target.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0];
  return values.slice(1).map((row) => {
    const object = {};
    headers.forEach((header, index) => {
      object[header] = row[index];
    });
    return object;
  });
}

function getHeaders(target) {
  return target.getRange(1, 1, 1, target.getLastColumn()).getValues()[0];
}

function findRows(sheetName, criteria) {
  return getObjects(sheetName).filter((row) => {
    return Object.keys(criteria).every((key) => String(row[key]) === String(criteria[key]));
  });
}

function findFirst(sheetName, criteria) {
  return findRows(sheetName, criteria)[0] || null;
}

function softDeleteById(sheetName, idColumn, id) {
  const target = sheet(sheetName);
  const values = target.getDataRange().getValues();
  const headers = values[0];
  const idIndex = headers.indexOf(idColumn);
  const activeIndex = headers.indexOf('is_active');

  if (idIndex === -1 || activeIndex === -1) {
    throw new Error(`Missing ${idColumn} or is_active column in ${sheetName}.`);
  }

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    if (String(values[rowIndex][idIndex]) === String(id)) {
      target.getRange(rowIndex + 1, activeIndex + 1).setValue(false);
      return { deleted: true, id };
    }
  }

  return { deleted: false, id };
}

function required(value, name) {
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing required field: ${name}`);
  }
  return value;
}

function createId(prefix) {
  return `${prefix}_${Utilities.getUuid()}`;
}

/**
 * 建議建立一個時間觸發器，每天自動同步一次匯率。
 * 第一次可手動執行 createDailyRateTrigger()。
 */
function createDailyRateTrigger() {
  ScriptApp.newTrigger('syncExchangeRates')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  return 'Daily exchange rate trigger created.';
}

function getTrips() {
  return getObjects(SHEET_NAMES.trips).filter(function(trip) {
    return String(trip.is_archived).toLowerCase() !== 'true';
  });
}

function getArchivedTrips() {
  return getObjects(SHEET_NAMES.trips).filter(function(trip) {
    return String(trip.is_archived).toLowerCase() === 'true';
  });
}

function archiveTrip(payload) {
  const tripId = required(payload.trip_id, 'trip_id');
  const target = sheet(SHEET_NAMES.trips);
  const values = target.getDataRange().getValues();
  const headers = values[0];
  const idIndex = headers.indexOf('trip_id');
  const archivedIndex = headers.indexOf('is_archived');

  if (idIndex === -1 || archivedIndex === -1) {
    throw new Error('Missing trip_id or is_archived column in ' + SHEET_NAMES.trips);
  }

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    if (String(values[rowIndex][idIndex]) === String(tripId)) {
      target.getRange(rowIndex + 1, archivedIndex + 1).setValue(true);
      return { archived: true, trip_id: tripId };
    }
  }

  return { archived: false, trip_id: tripId };
}

function unarchiveTrip(payload) {
  const tripId = required(payload.trip_id, 'trip_id');
  const target = sheet(SHEET_NAMES.trips);
  const values = target.getDataRange().getValues();
  const headers = values[0];
  const idIndex = headers.indexOf('trip_id');
  const archivedIndex = headers.indexOf('is_archived');

  if (idIndex === -1 || archivedIndex === -1) {
    throw new Error('Missing trip_id or is_archived column in ' + SHEET_NAMES.trips);
  }

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    if (String(values[rowIndex][idIndex]) === String(tripId)) {
      target.getRange(rowIndex + 1, archivedIndex + 1).setValue(false);
      return { unarchived: true, trip_id: tripId };
    }
  }

  return { unarchived: false, trip_id: tripId };
}

function addTrip(payload) {
  const tripId = payload.trip_id || createId('trip');
  const now = new Date();

  const existing = findFirst(SHEET_NAMES.trips, {
    trip_id: tripId
  });

  if (existing) {
    return existing;
  }

  const row = {
    trip_id: tripId,
    trip_name: required(payload.trip_name, 'trip_name'),
    base_currency: payload.base_currency || 'TWD',
    created_by: payload.created_by || '',
    created_at: now,
    updated_at: now,
    is_archived: false
  };

  appendObject(SHEET_NAMES.trips, row);

  // 為新旅遊建立預設成員、分類、付款方式
  const members = payload.members || [
    ['Dustin', '發起人', 'D'],
    ['Amy', '旅伴', 'A'],
    ['Ben', '旅伴', 'B'],
    ['Cindy', '旅伴', 'C']
  ];
  members.forEach(function(member) {
    const name = Array.isArray(member) ? member[0] : member;
    const note = Array.isArray(member) ? member[1] : '旅伴';
    const avatar = Array.isArray(member) ? member[2] : name.slice(0, 1).toUpperCase();
    appendObject(SHEET_NAMES.members, {
      member_id: createId('mem'),
      trip_id: tripId,
      member_name: name,
      email_or_note: note,
      avatar_text: avatar,
      created_at: now,
      is_active: true
    });
  });

  [
    ['餐飲', '🍜', '預設分類'],
    ['早餐', '🍳', '自訂分類'],
    ['門票', '🎟', '自訂分類'],
    ['交通', '🚆', '預設分類'],
    ['住宿', '🏨', '預設分類'],
    ['購物', '🛍', '預設分類']
  ].forEach(function(cat) {
    appendObject(SHEET_NAMES.categories, {
      category_id: createId('cat'),
      trip_id: tripId,
      category_name: cat[0],
      icon: cat[1],
      note: cat[2],
      created_at: now,
      is_active: true
    });
  });

  [
    ['現金', '💵', '預設方式'],
    ['Visa', '💳', '信用卡'],
    ['LINE Pay', '📱', '行動支付'],
    ['Suica', '🚇', '交通卡']
  ].forEach(function(pay) {
    appendObject(SHEET_NAMES.paymentMethods, {
      payment_method_id: createId('pay'),
      trip_id: tripId,
      payment_method_name: pay[0],
      icon: pay[1],
      note: pay[2],
      created_at: now,
      is_active: true
    });
  });

  return row;
}

function safeJsonParse_(text, fallback) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return fallback;
  }
}

function parseRequestBody(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }

  return safeJsonParse_(e.postData.contents, {});
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function gasOutput_(result, callback) {
  const json = JSON.stringify(result);

  if (callback) {
    const safeCallback = String(callback).trim();

    if (!/^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(safeCallback)) {
      return ContentService
        .createTextOutput(JSON.stringify({
          ok: false,
          error: 'Invalid callback name'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(safeCallback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}