/* TripSplit module split from assets/app.js. Keep classic script order in HTML. */
function safeSetText(selector, value) {
    const node = $(selector);
    if (node) node.textContent = value;
}

function safeSetHtml(selector, value) {
    const node = $(selector);
    if (node) node.innerHTML = value;
}

function applyPreviewModeUi() {
    if (!isPreviewMode) return;

    document.body.classList.add('preview-mode');
    document.body.dataset.previewMode = 'true';

    if (!$('#preview-mode-banner')) {
        const banner = document.createElement('div');
        banner.id = 'preview-mode-banner';
        banner.className = 'preview-mode-banner';
        banner.setAttribute('role', 'status');
        banner.innerHTML = '<strong>唯讀預覽模式</strong><span>此分享連結只能查看支出紀錄與收支總覽，無法新增、編輯、上傳或管理資料。</span>';
        const container = document.querySelector('main .container');
        if (container) container.insertAdjacentElement('afterbegin', banner);
    }

    document.querySelectorAll('[data-dashboard-tab="quick"]').forEach(button => {
        button.hidden = true;
        button.disabled = true;
        button.setAttribute('aria-disabled', 'true');
    });

    document.querySelectorAll('a[href*="settings.html"], a[href="#expense-form"], #open-import-text-btn').forEach(node => {
        node.hidden = true;
        node.setAttribute('aria-hidden', 'true');
    });

    ['#trip-switch-form', '#expense-create-form', '#trip-create-form', '#member-form', '#category-form', '#payment-form', '#expense-edit-form', '#receipt-upload-modal'].forEach(selector => {
        const root = $(selector);
        if (!root) return;
        root.querySelectorAll('input, select, textarea, button').forEach(control => {
            control.disabled = true;
            control.setAttribute('aria-disabled', 'true');
        });
        root.querySelectorAll('.icon-select-trigger, .icon-select-option').forEach(control => {
            control.disabled = true;
            control.setAttribute('aria-disabled', 'true');
        });
    });
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
    applyPreviewModeUi();
}

function isCurrentTripArchived() {
    const currentTrip_ = currentTrip();
    return archivedTrips && archivedTrips.some(trip => trip.id === currentTrip_.id);
}

function updateFormDisabledState() {
    const isArchived = isCurrentTripArchived();
    const isReadonly = isPreviewMode || isArchived;
    const forms = ['#member-form', '#category-form', '#payment-form', '#expense-create-form', '#trip-create-form'];

    forms.forEach(formSelector => {
        const form = $(formSelector);
        if (!form) return;
        const inputs = form.querySelectorAll('input, select, textarea, button[type="submit"]');
        inputs.forEach(input => { input.disabled = isReadonly; });
    });

    const archiveBtn = $('#archive-trip-btn');
    if (archiveBtn) {
        archiveBtn.disabled = isReadonly;
        archiveBtn.title = isPreviewMode ? '唯讀預覽模式不能封存帳本' : (isArchived ? '此旅遊已封存' : '封存目前旅遊');
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

    if (isPreviewMode && currentTripId && !sortedTrips.some(trip => trip.id === currentTripId)) {
        sortedTrips.unshift(currentTrip());
    }

    select.innerHTML = sortedTrips.map(trip => `<option value="${trip.id}" ${trip.id === currentTripId ? 'selected' : ''}>${trip.name}</option>`).join('');
    syncIconSelect(select);
}

function renderArchivedTripsLegacy() {
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

function renderArchivedTrips() {
    const container = $('#archived-trips-list');
    if (!container) return;

    if (!archivedTrips || !archivedTrips.length) {
        container.innerHTML = '<p class="field-hint">目前沒有已封存旅遊。</p>';
        return;
    }

    container.innerHTML = archivedTrips.map(trip => {
        const tripId = escapeHtml(trip.id);
        const tripName = escapeHtml(trip.name);
        const unarchiveButton = isPreviewMode ? '' : `<button class="icon-btn" type="button" data-unarchive-trip="${tripId}" title="解除封存">↩</button>`;
        return `
    <div class="list-row archived-trip-row">
      <div class="list-info">
        <span class="mini-icon">📦</span>
        <div><strong>${tripName}</strong><small>${tripId}</small></div>
      </div>
      <div class="archived-trip-actions">
        <button class="btn btn-soft archived-preview-copy" type="button" data-copy-preview-link="${tripId}">🔗 複製連結</button>
        ${unarchiveButton}
      </div>
    </div>
  `;
    }).join('');
}

function renderTripHeaders() {
    const trip = currentTrip();
    safeSetText('#hero-title', `${trip.name}`);
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

function clampExpenseTablePage(totalExpenses) {
    const totalPages = Math.max(1, Math.ceil(totalExpenses / EXPENSE_TABLE_PAGE_SIZE));
    expenseTablePage = Math.min(Math.max(1, expenseTablePage), totalPages);
    return totalPages;
}

function setExpenseViewMode(mode) {
    if (!['card', 'table'].includes(mode)) return;
    const isChangingToTable = expenseViewMode !== 'table' && mode === 'table';
    expenseViewMode = mode;
    openExpenseMenuId = '';
    if (isChangingToTable) {
        expenseTablePage = 1;
        selectedExpenseTableDetailId = '';
    }
    renderExpenses();
}

function setExpenseTablePage(page) {
    const visibleExpenses = getVisibleExpenses();
    const totalPages = clampExpenseTablePage(visibleExpenses.length);
    const nextPage = page === 'prev'
        ? expenseTablePage - 1
        : page === 'next'
            ? expenseTablePage + 1
            : Number(page);

    if (!Number.isFinite(nextPage)) return;
    expenseTablePage = Math.min(Math.max(1, nextPage), totalPages);
    selectedExpenseTableDetailId = '';
    renderExpenses();
}

function openExpenseTableDetail(expenseId) {
    selectedExpenseTableDetailId = String(expenseId || '');
    openExpenseMenuId = '';
    renderExpenses();
}

function closeExpenseTableDetail() {
    selectedExpenseTableDetailId = '';
    renderExpenses();
}

function resetExpenseTableBrowsing() {
    expenseTablePage = 1;
    selectedExpenseTableDetailId = '';
    openExpenseMenuId = '';
}

function buildExpenseViewControls(visibleCount) {
    return `
        <div class="expense-view-controls" aria-label="支出檢視切換">
          <div>
            <strong>檢視模式</strong>
            <span>${visibleCount} 筆符合條件</span>
          </div>
          <div class="expense-view-toggle" role="group" aria-label="切換支出清單檢視">
            <button type="button" data-expense-view-mode="card" aria-pressed="${expenseViewMode === 'card'}" class="${expenseViewMode === 'card' ? 'active' : ''}">卡片檢視</button>
            <button type="button" data-expense-view-mode="table" aria-pressed="${expenseViewMode === 'table'}" class="${expenseViewMode === 'table' ? 'active' : ''}">表格檢視</button>
          </div>
        </div>`;
}


function buildExpenseTableDetailPanel(expense) {
    if (!expense) return '';
    const expenseId = String(expense.id || '');
    const receiptCount = Array.isArray(expense.receiptUrls) ? expense.receiptUrls.length : 0;
    const participantCount = getExpenseParticipantCount(expense);
    const isMenuOpen = openExpenseMenuId === expenseId;

    return `
        <section class="expense-table-detail-panel" aria-label="${escapeHtml(expense.title || '支出')} 完整細項">
          <div class="expense-table-detail-head">
            <div>
              <span class="expense-table-detail-kicker">支出細項</span>
              <h3>${escapeHtml(expense.title || '未命名支出')}</h3>
              <p>${escapeHtml(formatExpenseTableDate(expense))} · ${escapeHtml(expense.category || '未分類')} · ${escapeHtml(expense.payment || '未設定付款方式')}</p>
            </div>
            <div class="expense-table-detail-head-actions">
              <div class="expense-actions">
                <button class="expense-more-btn" type="button" data-expense-menu="${escapeHtml(expenseId)}" aria-expanded="${isMenuOpen}" aria-label="更多 ${escapeHtml(expense.title || '支出')} 操作">⋯</button>
                <div class="expense-action-menu${isMenuOpen ? ' open' : ''}">
                  <button type="button" data-edit-expense="${escapeHtml(expenseId)}">編輯</button>
                  <button type="button" data-open-receipt-upload="${escapeHtml(expenseId)}">上傳照片</button>
                </div>
              </div>
              <button class="expense-table-detail-close" type="button" data-close-expense-table-detail="true" aria-label="關閉支出細項">×</button>
            </div>
          </div>
          <div class="expense-table-detail-stats">
            <div><span>台幣金額</span><strong>NT$ ${money.format(Math.round(expense.twd || 0))}</strong></div>
            <div><span>原始金額</span><strong>${escapeHtml(expense.currency || 'TWD')} ${money.format(Number(expense.amount || 0))}</strong></div>
            <div><span>付款人</span><strong>${escapeHtml(expense.payer || '未設定')}</strong></div>
            <div><span>參與者</span><strong>${participantCount || 0} 人</strong></div>
          </div>
          ${buildExpenseSummary(expense)}
          <div class="expense-table-detail-grid">
            <section>
              <h4>備註</h4>
              ${buildExpenseDetailNote(expense)}
            </section>
            <section>
              <h4>照片</h4>
              ${receiptCount ? buildReceiptLinks(expense) : '<p class="expense-table-detail-empty">沒有照片</p>'}
            </section>
          </div>
          ${buildExpenseDetail(expense)}
          <div class="expense-table-detail-meta">
            <span>匯率 ${money.format(Number(expense.rate || 1))}</span>
            <span>分帳方式 ${escapeHtml(expense.split || '未設定')}</span>
            <span>建立時間 ${escapeHtml(formatExpenseCreatedAt(expense))}</span>
          </div>
        </section>`;
}

function buildExpenseTableView(visibleExpenses) {
    if (!visibleExpenses.length) {
        return `<p class="field-hint">${hasActiveExpenseFilters() ? '沒有符合篩選條件的支出。' : '目前還沒有支出紀錄。'}</p>`;
    }

    const totalPages = clampExpenseTablePage(visibleExpenses.length);
    if (selectedExpenseTableDetailId && !visibleExpenses.some(expense => String(expense.id) === selectedExpenseTableDetailId)) {
        selectedExpenseTableDetailId = '';
    }

    const startIndex = (expenseTablePage - 1) * EXPENSE_TABLE_PAGE_SIZE;
    const pageRows = visibleExpenses.slice(startIndex, startIndex + EXPENSE_TABLE_PAGE_SIZE);
    const selectedExpense = selectedExpenseTableDetailId ? getExpenseById(selectedExpenseTableDetailId) : null;
    const rows = pageRows.map(expense => {
        const expenseId = String(expense.id || '');
        const title = expense.title || '未命名支出';
        const participantCount = getExpenseParticipantCount(expense);
        const receiptCount = Array.isArray(expense.receiptUrls) ? expense.receiptUrls.length : 0;
        const hasNote = Boolean(String(expense.note || '').trim());
        const isSelected = selectedExpenseTableDetailId === expenseId;
        return `
            <tr class="${isSelected ? 'selected' : ''}" tabindex="0" data-open-expense-table-detail="${escapeHtml(expenseId)}" aria-selected="${isSelected}">
              <td data-label="日期">${escapeHtml(formatExpenseTableDate(expense))}</td>
              <td data-label="分類"><span class="expense-table-category">${escapeHtml(expense.icon || '')} ${escapeHtml(expense.category || '未分類')}</span></td>
              <td class="expense-table-title" data-label="項目名稱" title="${escapeHtml(title)}"><span>${escapeHtml(title)}</span></td>
              <td data-label="付款人" title="${escapeHtml(expense.payer || '未設定')}">${escapeHtml(expense.payer || '未設定')}</td>
              <td class="numeric" data-label="原始金額"><span>${escapeHtml(expense.currency || 'TWD')} ${money.format(Number(expense.amount || 0))}</span><small>匯率 ${money.format(Number(expense.rate || 1))}</small></td>
              <td class="numeric strong" data-label="台幣金額">NT$ ${money.format(Math.round(expense.twd || 0))}</td>
              <td class="numeric" data-label="平均分攤">NT$ ${money.format(Math.round(getExpenseAverageShare(expense) || 0))}</td>
              <td data-label="參與者">${participantCount || 0} 人</td>
              <td data-label="照片">${buildExpenseStatusBadge(receiptCount ? `${receiptCount} 張` : '無', receiptCount > 0)}</td>
              <td data-label="備註">${buildExpenseStatusBadge(hasNote ? '有' : '無', hasNote)}</td>
              <td data-label="操作"><button class="expense-table-action" type="button" data-open-expense-table-detail="${escapeHtml(expenseId)}">查看細項</button></td>
            </tr>`;
    }).join('');

    return `
        <div class="expense-table-shell">
          <div class="expense-table-scroll" tabindex="0" aria-label="支出表格，可左右捲動">
            <table class="expense-table">
              <colgroup>
                <col class="expense-table-col-date" />
                <col class="expense-table-col-category" />
                <col class="expense-table-col-title" />
                <col class="expense-table-col-payer" />
                <col class="expense-table-col-original" />
                <col class="expense-table-col-twd" />
                <col class="expense-table-col-share" />
                <col class="expense-table-col-count" />
                <col class="expense-table-col-photo" />
                <col class="expense-table-col-note" />
                <col class="expense-table-col-action" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">日期</th>
                  <th scope="col">分類</th>
                  <th scope="col">項目名稱</th>
                  <th scope="col">付款人</th>
                  <th scope="col" class="numeric">原始金額</th>
                  <th scope="col" class="numeric">台幣金額</th>
                  <th scope="col" class="numeric">平均分攤</th>
                  <th scope="col">參與者</th>
                  <th scope="col">照片</th>
                  <th scope="col">備註</th>
                  <th scope="col">操作</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          ${buildExpenseTablePagination(totalPages, visibleExpenses.length)}
          ${buildExpenseTableDetailPanel(selectedExpense)}
        </div>`;
}

function buildExpenseCardView(visibleExpenses) {
    const groupedExpenses = groupExpensesByDate(visibleExpenses);
    return Array.from(groupedExpenses.entries()).map(([dateKey, dayExpenses]) => {
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
        ${dayExpenses.map(expense => {
            const expenseId = String(expense.id || '');
            const isExpanded = expandedExpenseIds.has(expenseId);
            const isMenuOpen = openExpenseMenuId === expenseId;
            return `
        <article class="expense-item${isExpanded ? ' is-expanded' : ''}" data-expense-card="${escapeHtml(expenseId)}">
          <div class="expense-icon">${escapeHtml(expense.icon || '')}</div>
          <div class="expense-meta">
            <strong>${escapeHtml(expense.title || '未命名支出')}</strong>
            ${buildExpenseSummary(expense)}
            ${buildReceiptLinks(expense)}
          </div>
          <div class="expense-amount"><strong>NT$ ${money.format(Math.round(expense.twd || 0))}</strong></div>
          <div class="expense-actions">
            <button class="expense-more-btn" type="button" data-expense-menu="${escapeHtml(expenseId)}" aria-expanded="${isMenuOpen}" aria-label="更多 ${escapeHtml(expense.title || '支出')} 操作">⋯</button>
            <div class="expense-action-menu${isMenuOpen ? ' open' : ''}">
              <button type="button" data-edit-expense="${escapeHtml(expenseId)}">編輯</button>
              <button type="button" data-open-receipt-upload="${escapeHtml(expenseId)}">上傳照片</button>
              <button class="danger" type="button" data-delete-expense="${escapeHtml(expenseId)}">刪除</button>
            </div>
          </div>
          ${buildExpenseNote(expense)}
          <button class="expense-detail-toggle" type="button" data-toggle-expense-detail="${escapeHtml(expenseId)}" aria-expanded="${isExpanded}" aria-label="${isExpanded ? '收合' : '展開'} ${escapeHtml(expense.title || '支出')} 明細">明細 <span aria-hidden="true">${isExpanded ? '▲' : '▼'}</span></button>
          ${isExpanded ? buildExpenseDetail(expense) : ''}
        </article>
        `;
        }).join('')}
      </div>
    </section>`;
    }).join('') || `<p class="field-hint">${hasActiveExpenseFilters() ? '沒有符合篩選條件的支出。' : '目前還沒有支出紀錄。'}</p>`;
}

function renderExpensesLegacy() {
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
          <div class="expense-icon">${escapeHtml(expense.icon || '')}</div>
          <div class="expense-meta">
            <strong>${escapeHtml(expense.title || '未命名支出')}</strong>
            <span>付款人 ${escapeHtml(expense.payer || '未設定')} · ${escapeHtml(expense.category || '未分類')} · ${escapeHtml(expense.payment || '未設定付款方式')} · ${escapeHtml(expense.currency || 'TWD')} ${money.format(Number(expense.amount || 0))} · 匯率 ${money.format(Number(expense.rate || 1))} · ${escapeHtml(expense.split || '')}</span>
            ${buildReceiptLinks(expense)}
          </div>
          <div class="expense-amount"><strong>NT$ ${money.format(Math.round(expense.twd || 0))}</strong></div>
          <div class="expense-actions">
            <button class="expense-edit-badge" type="button" data-edit-expense="${escapeHtml(expense.id)}" aria-label="編輯 ${escapeHtml(expense.title || '支出')}">編輯</button>
            <button class="expense-delete-badge" type="button" data-delete-expense="${escapeHtml(expense.id)}" aria-label="刪除 ${escapeHtml(expense.title || '支出')}">🗑</button>
          </div>
          ${buildExpenseNote(expense)}
        </article>
        `).join('')}
      </div>
    </section>`;
    }).join('') || `<p class="field-hint">${hasActiveFilters ? '沒有符合搜尋或篩選的支出。' : '這個旅遊目前沒有支出。'}</p>`;
}

function renderExpenses() {
    const list = $('#expense-list');
    const total = expenses.reduce((sum, item) => sum + Number(item.twd || 0), 0);
    safeSetText('#summary-total', `NT$ ${money.format(Math.round(total))}`);
    safeSetText('#summary-count', `${expenses.length} 筆`);

    if (!list) return;
    renderExpenseFilters();

    const visibleExpenses = getVisibleExpenses();
    const body = expenseViewMode === 'table'
        ? buildExpenseTableView(visibleExpenses)
        : buildExpenseCardView(visibleExpenses);

    list.innerHTML = `${buildExpenseViewControls(visibleExpenses.length)}${body}`;
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
                    <input class="split-input" type="number" data-member="${escapeHtml(name)}" data-kind="${kind}" ${isPercent ? 'min="0"' : ''} step="${isPercent ? '1' : '0.01'}" value="${formatAmountValue(defaults[index])}" />
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

function validateEditSplitInputs(splitType, totalAmount, payer) {
    const selected = getEditSelectedParticipants();
    if (!selected.length) {
        alert('請至少選擇一位分帳對象。');
        return { ok: false };
    }

    if (!validateRefundPayerParticipant(selected, payer, totalAmount)) {
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
        const invalidValue = !Number.isFinite(value)
            || (splitType === '百分比分' && value < 0)
            || (splitType === '自訂金額' && Number(totalAmount || 0) >= 0 && value < 0)
            || (splitType === '自訂金額' && Number(totalAmount || 0) < 0 && value > 0);
        if (invalidValue) {
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
    if (isPreviewMode) {
        guardReadonlyAction();
        return;
    }

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
    const splitValidation = validateEditSplitInputs(split, amount, $('#edit-paid-by')?.value || '');
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

