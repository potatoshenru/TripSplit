/* TripSplit module split from assets/app.js. Keep classic script order in HTML. */
let importTextItems = []; // 保持 modal 內資料

let activeImportTextIndex = 0;
/** @type {Set<number>} */
let selectedImportTextIndexes = new Set();
/** @type {Set<string>} */
let importedImportTextIds = new Set();

function hashImportTextValue(value) {
    let hash = 0;
    const text = String(value || '');
    for (let index = 0; index < text.length; index += 1) {
        hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
    }
    return Math.abs(hash).toString(36);
}

function getImportTextResultKey(item, index = 0) {
    if (!item) return '';
    if (!item.resultId) {
        const source = [item.date, item.title, getResultAmount(item), index].join('|');
        item.resultId = `import_text_${index}_${hashImportTextValue(source)}`;
    }
    return item.resultId;
}

function getImportTextCurrency() {
    return String($('#expense-currency')?.value || localStorage.getItem('tripsplit_last_currency') || 'TWD').toUpperCase();
}

function getImportTextExchangeRate(currency = getImportTextCurrency()) {
    return Number(exchangeRates[String(currency || 'TWD').toUpperCase()] || 0);
}

function getSelectedImportTextResultIds() {
    return getSelectedImportTextIndexes()
        .map(index => getImportTextResultKey(importTextItems[index], index))
        .filter(Boolean);
}

function calculateParsedResultsSummary(results, importedResultIds, selectedResultIds) {
    const importedIds = importedResultIds instanceof Set ? importedResultIds : new Set(importedResultIds || []);
    const selectedIds = selectedResultIds instanceof Set ? selectedResultIds : new Set(selectedResultIds || []);
    return (results || []).reduce((summary, item, index) => {
        const key = getImportTextResultKey(item, index);
        const amount = getResultAmount(item);
        const isImported = importedIds.has(key);
        const isSelected = selectedIds.has(key);
        summary.totalCount += 1;
        summary.totalAmount += amount;
        if (isImported) {
            summary.importedCount += 1;
            summary.importedAmount += amount;
        } else {
            summary.pendingCount += 1;
            summary.pendingAmount += amount;
        }
        if (isSelected) {
            summary.selectedCount += 1;
            summary.selectedAmount += amount;
        }
        return summary;
    }, {
        totalCount: 0,
        importedCount: 0,
        pendingCount: 0,
        selectedCount: 0,
        totalAmount: 0,
        importedAmount: 0,
        pendingAmount: 0,
        selectedAmount: 0
    });
}

function formatImportTextSummaryAmount(amount, currency, rate) {
    const base = formatCurrencyAmount(amount, currency);
    if (String(currency || '').toUpperCase() === 'TWD' || !(Number(rate) > 0)) return base;
    return `${base}｜約 NT$${money.format(convertToTwd(amount, rate))}`;
}

function markImportTextIndexesImported(indexes) {
    indexes.forEach(index => {
        const key = getImportTextResultKey(importTextItems[index], index);
        if (key) importedImportTextIds.add(key);
    });
}

function resetImportTextState() {
    activeImportTextIndex = 0;
    selectedImportTextIndexes = new Set();
    importedImportTextIds = new Set();
}

function openImportTextModal() {
    if (isPreviewMode) {
        guardReadonlyAction();
        return;
    }

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

function getImportTextIsoDate(value) {
    const parsedRoc = parseRocDate(value);
    if (parsedRoc) return parsedRoc;

    const normalized = String(value || '').trim().replace(/[/.]/g, '-');
    const parsedIso = parseIsoDate(normalized);
    return parsedIso ? toIsoDate(parsedIso.year, parsedIso.month, parsedIso.day) : '';
}

function getSelectedImportTextIndexes() {
    return Array.from(selectedImportTextIndexes)
        .filter(index => importTextItems[index])
        .sort((a, b) => a - b);
}

function getImportTextItemQuantity(item) {
    const match = String(item?.title || '').match(/[*＊]\s*(\d+(?:\.\d+)?)\s*$/);
    if (!match) return 1;

    const quantity = Number(match[1]);
    return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function formatImportTextQuantity(quantity) {
    const rounded = Math.round(Number(quantity || 0) * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/\.?0+$/, '');
}

function removeImportTextItem(index) {
    const removedKey = getImportTextResultKey(importTextItems[index], index);
    if (removedKey) importedImportTextIds.delete(removedKey);
    importTextItems.splice(index, 1);
    selectedImportTextIndexes = new Set(
        Array.from(selectedImportTextIndexes)
            .filter(selectedIndex => selectedIndex !== index)
            .map(selectedIndex => selectedIndex > index ? selectedIndex - 1 : selectedIndex)
    );
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
                <button class="btn btn-soft import-text-merge-btn" type="button" id="import-text-merge-btn">合併導入</button>
                <button class="btn btn-primary import-text-current-btn" type="button" id="import-text-current-btn">帶入目前</button>
            </div>
        `;
        const existingLabel = section.querySelector('.import-text-section-label');
        if (existingLabel) existingLabel.replaceWith(toolbar);
        else section.insertBefore(toolbar, list);
    }

    if (section && list && !$('#import-text-summary')) {
        const summary = document.createElement('div');
        summary.className = 'import-text-summary';
        summary.id = 'import-text-summary';
        summary.hidden = true;
        section.insertBefore(summary, list);
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

function updateImportTextSummary() {
    const summaryNode = $('#import-text-summary');
    if (!summaryNode) return;
    if (!importTextItems.length) {
        summaryNode.hidden = true;
        summaryNode.innerHTML = '';
        return;
    }

    const currency = getImportTextCurrency();
    const rate = getImportTextExchangeRate(currency);
    const selectedResultIds = new Set(getSelectedImportTextResultIds());
    const summary = calculateParsedResultsSummary(importTextItems, importedImportTextIds, selectedResultIds);
    const formAmountValue = $('#amount-original')?.value;
    const hasFormAmount = formAmountValue !== undefined && formAmountValue !== null && String(formAmountValue).trim() !== '';
    const formAmount = Number(formAmountValue || 0);
    const diff = Math.round((formAmount - summary.importedAmount) * 100) / 100;
    const matchText = !hasFormAmount ? '' : Math.abs(diff) < 0.0001
        ? '<div class="import-text-summary-match ok">✅ 目前表單金額與已帶入合計一致</div>'
        : `<div class="import-text-summary-match warn">⚠️ 目前表單金額與已帶入合計差 ${escapeHtml(formatCurrencyAmount(Math.abs(diff), currency))}</div>`;
    const selectedText = summary.selectedCount > 0
        ? `<div class="import-text-summary-selected">已勾選 ${summary.selectedCount} 筆｜合計 ${escapeHtml(formatCurrencyAmount(summary.selectedAmount, currency))}</div>`
        : '';

    summaryNode.hidden = false;
    summaryNode.innerHTML = `
        <div class="import-text-summary-counts">
            <span>解析結果 ${summary.totalCount} 筆</span>
            <span>已帶入 ${summary.importedCount} 筆</span>
            <span>尚未帶入 ${summary.pendingCount} 筆</span>
        </div>
        ${selectedText}
        <div class="import-text-summary-amounts">
            <span>已帶入合計：${escapeHtml(formatImportTextSummaryAmount(summary.importedAmount, currency, rate))}</span>
            <span>尚未帶入：${escapeHtml(formatCurrencyAmount(summary.pendingAmount, currency))}</span>
            <span>解析總額：${escapeHtml(formatImportTextSummaryAmount(summary.totalAmount, currency, rate))}</span>
        </div>
        ${matchText}
    `;
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
    if (isPreviewMode) {
        guardReadonlyAction();
        return false;
    }

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
    markImportTextIndexesImported([index]);
    updateImportTextFormNav();
    renderImportTextResult();
    if (options.closeModal !== false) closeImportTextModal();
    if (options.scroll !== false) setDashboardTab('quick', { updateHash: true, scroll: true });
    return true;
}

function importSelectedTextItemsToForm(options = {}) {
    if (isPreviewMode) {
        guardReadonlyAction();
        return false;
    }

    const selectedIndexes = getSelectedImportTextIndexes();
    if (!selectedIndexes.length) {
        alert('請至少選擇一筆解析結果。');
        return false;
    }

    const selectedItems = selectedIndexes.map(index => importTextItems[index]).filter(Boolean);
    const totalAmount = selectedItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const totalQuantity = selectedItems.reduce((sum, item) => sum + getImportTextItemQuantity(item), 0);
    const firstItem = selectedItems[0];
    const titleInput = $('#expense-title');
    const dateInput = $('#expense-date');
    const amountInput = $('#amount-original');
    const noteInput = $('#note');

    if (titleInput) titleInput.value = `*${formatImportTextQuantity(totalQuantity)}(請參閱備註)`;
    if (dateInput && firstItem?.date) {
        setRocDateValue(dateInput, getImportTextIsoDate(firstItem.date) || firstItem.date);
    }
    if (amountInput) {
        amountInput.value = totalAmount;
        updateExchangePreview();
    }
    if (noteInput) {
        noteInput.value = selectedItems.map(item => {
            const isoDate = getImportTextIsoDate(item.date) || String(item.date || '').trim();
            const amount = String(Number(item.amount || 0));
            return `${isoDate}|${item.title}|${amount}`;
        }).join('\n');
    }

    activeImportTextIndex = selectedIndexes[0];
    markImportTextIndexesImported(selectedIndexes);
    updateImportTextFormNav();
    renderImportTextResult();
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
    if (!importTextItems.length) {
        updateImportTextSummary();
        section.style.display = 'none';
        return;
    }
    clampActiveImportTextIndex();
    section.style.display = '';
    const status = $('#import-text-nav-status');
    const prevBtn = $('#import-text-prev-btn');
    const nextBtn = $('#import-text-next-btn');
    const currentBtn = $('#import-text-current-btn');
    const mergeBtn = $('#import-text-merge-btn');
    if (status) status.textContent = `${activeImportTextIndex + 1} / ${importTextItems.length}`;
    [prevBtn, nextBtn, currentBtn, mergeBtn].forEach(button => {
        if (button) button.disabled = importTextItems.length <= 0;
    });
    updateImportTextSummary();
    const currency = getImportTextCurrency();
    list.innerHTML = importTextItems.map((item, idx) => {
        const resultKey = getImportTextResultKey(item, idx);
        const isImported = importedImportTextIds.has(resultKey);
        return `
    <div class="import-text-result-row${idx === activeImportTextIndex ? ' active' : ''}${isImported ? ' imported' : ''}" data-import-idx="${idx}">
      <label class="import-text-result-check" aria-label="選擇解析結果">
        <input type="checkbox" data-import-select="${idx}"${selectedImportTextIndexes.has(idx) ? ' checked' : ''}>
      </label>
      <div class="import-text-result-info">
        <span class="import-text-result-date">${escapeHtml(formatRocDate(parseRocDate(item.date)) || item.date)}</span>
        <span class="import-text-result-title">${escapeHtml(item.title)}</span>
        ${isImported ? '<span class="import-text-result-imported">已帶入</span>' : ''}
        <span class="import-text-result-amount">${escapeHtml(formatCurrencyAmount(getResultAmount(item), currency))}</span>
      </div>
      <div class="import-text-result-btns">
        <button class="btn btn-primary" type="button" data-import-item="${idx}" style="font-size:.82rem;padding:5px 14px;">帶入</button>
        <button class="btn btn-ghost" type="button" data-remove-import-item="${idx}" style="font-size:.82rem;padding:5px 10px;">✕</button>
      </div>
    </div>
  `;
    }).join('');
}


function bindImportTextModal() {
    ensureImportTextControls();
    updateImportTextCountBadge();

    $('#open-import-text-btn')?.addEventListener('click', (event) => {
        if (guardReadonlyAction(event)) return;
        openImportTextModal();
    });

    $('#copy-ai-prompt-btn')?.addEventListener('click', () => {
        const text = $('#ai-prompt-text')?.textContent || '';
        navigator.clipboard?.writeText(text).then(() => {
            const btn = $('#copy-ai-prompt-btn');
            if (btn) { btn.textContent = '已複製！'; setTimeout(() => { btn.textContent = '複製'; }, 1800); }
        });
    });

    $('#parse-import-text-btn')?.addEventListener('click', (event) => {
        if (guardReadonlyAction(event)) return;
        const raw = $('#import-text-textarea')?.value || '';
        importTextItems = parseImportText(raw).map((item, index) => ({
            ...item,
            resultId: `import_text_${index}_${hashImportTextValue([item.date, item.title, item.amount, index].join('|'))}`
        }));
        resetImportTextState();
        // clear textarea after parsing, per spec: 匯入新的資料要先清除後再進行導入
        const ta = $('#import-text-textarea');
        if (ta) ta.value = '';
        renderImportTextResult();
    });

    $('#clear-import-text-btn')?.addEventListener('click', (event) => {
        if (guardReadonlyAction(event)) return;
        const ta = $('#import-text-textarea');
        if (ta) ta.value = '';
        importTextItems = [];
        resetImportTextState();
        renderImportTextResult();
    });

    $('#import-text-prev-btn')?.addEventListener('click', () => {
        setActiveImportTextIndex(activeImportTextIndex - 1);
    });

    $('#import-text-next-btn')?.addEventListener('click', () => {
        setActiveImportTextIndex(activeImportTextIndex + 1);
    });

    $('#import-text-current-btn')?.addEventListener('click', (event) => {
        if (guardReadonlyAction(event)) return;
        importTextItemToForm(activeImportTextIndex);
    });

    $('#import-text-merge-btn')?.addEventListener('click', (event) => {
        if (guardReadonlyAction(event)) return;
        importSelectedTextItemsToForm();
    });

    $('#import-text-form-prev-btn')?.addEventListener('click', (event) => {
        if (guardReadonlyAction(event)) return;
        stepImportTextItemOnForm(-1);
    });

    $('#import-text-form-next-btn')?.addEventListener('click', (event) => {
        if (guardReadonlyAction(event)) return;
        stepImportTextItemOnForm(1);
    });

    $('#import-text-result-list')?.addEventListener('click', (event) => {
        if (event.target.closest('[data-import-select], [data-import-item], [data-remove-import-item]') && guardReadonlyAction(event)) return;

        const selectInput = event.target.closest('[data-import-select]');
        if (selectInput) {
            const idx = Number(selectInput.dataset.importSelect);
            if (selectInput.checked) selectedImportTextIndexes.add(idx);
            else selectedImportTextIndexes.delete(idx);
            updateImportTextSummary();
            return;
        }

        const importBtn = event.target.closest('[data-import-item]');
        if (importBtn) {
            const idx = Number(importBtn.dataset.importItem);
            importTextItemToForm(idx);
            return;
        }

        const removeBtn = event.target.closest('[data-remove-import-item]');
        if (removeBtn) {
            const idx = Number(removeBtn.dataset.removeImportItem);
            removeImportTextItem(idx);
            if (idx <= activeImportTextIndex) activeImportTextIndex -= 1;
            clampActiveImportTextIndex();
            renderImportTextResult();
            return;
        }

        const row = event.target.closest('[data-import-idx]');
        if (row) {
            const idx = Number(row.dataset.importIdx);
            setActiveImportTextIndex(idx);
            if (selectedImportTextIndexes.has(idx)) selectedImportTextIndexes.delete(idx);
            else selectedImportTextIndexes.add(idx);
            renderImportTextResult();
        }
    });
}
