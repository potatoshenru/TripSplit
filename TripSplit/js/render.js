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
  // 排序旅遊：最後修改或建立的帳本放在最下面
  const sortedTrips = [...trips].sort((a, b) => {
    const aTimestamp = getTripSortTime(a);
    const bTimestamp = getTripSortTime(b);

    // 時間都存在：舊的在前，新的在後
    if (aTimestamp && bTimestamp) {
      return aTimestamp - bTimestamp;
    }

    // 只有一個有時間：有時間的排在後面
    if (aTimestamp && !bTimestamp) return 1;
    if (!aTimestamp && bTimestamp) return -1;

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
