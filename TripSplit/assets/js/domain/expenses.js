/* TripSplit module split from assets/app.js. Keep classic script order in HTML. */
function buildReceiptLinks(expense) {
    const urls = Array.isArray(expense.receiptUrls) ? expense.receiptUrls : [];
    if (!urls.length) return '';

    const viewButtons = urls.map((url, index) => `
    <button class="receipt-link" type="button" data-receipt-url="${encodeURIComponent(url)}">📷 查看照片${urls.length > 1 ? ` ${index + 1}` : ''}</button>
  `).join('');

    return `<div class="expense-links">${viewButtons}</div>`;
}

function parseMergedNoteLines(note) {
    const text = String(note || '').trim();
    if (!text) return [];

    const matches = [...text.matchAll(/(\d{4}-\d{2}-\d{2})\|(.+?)\|(\d+)(?=\s+\d{4}-\d{2}-\d{2}\||$)/gs)];
    if (matches.length) {
        return matches.map(match => {
            const item = match[2].trim();
            if (!item) return null;
            return {
                date: match[1],
                item,
                amount: Number(match[3])
            };
        });
    }

    return text.split(/\r?\n/).map(line => {
        const match = line.trim().match(/^(\d{4}-\d{2}-\d{2})\|([^|]+)\|(\d+)$/);
        if (!match) return null;
        const item = match[2].trim();
        if (!item) return null;
        return {
            date: match[1],
            item,
            amount: Number(match[3])
        };
    });
}

function isMergedDetailNote(note) {
    const details = parseMergedNoteLines(note);
    return details.length > 0 && details.every(Boolean);
}

function formatAmount(amount) {
    return money.format(Number(amount || 0));
}

function getMergedNoteKey(expense, note) {
    const expenseId = String(expense?.id || '').trim();
    if (expenseId) return expenseId;

    const source = `${expense?.date || ''}|${expense?.title || ''}|${note}`;
    let hash = 0;
    for (let index = 0; index < source.length; index += 1) {
        hash = ((hash << 5) - hash + source.charCodeAt(index)) | 0;
    }
    return `note_${Math.abs(hash)}`;
}

function buildExpenseNote(expense) {
    const note = String(expense?.note || '').trim();
    if (!note) return '';

    if (isMergedDetailNote(note)) {
        const details = parseMergedNoteLines(note);
        const total = details.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const currency = expense?.currency || 'TWD';
        const noteKey = getMergedNoteKey(expense, note);
        const isExpanded = expandedMergedNoteIds.has(noteKey);
        const rows = details.map(item => `
          <div class="merged-note-row">
            <span class="merged-note-date">${escapeHtml(item.date)}</span>
            <span class="merged-note-item" title="${escapeHtml(item.item)}">${escapeHtml(item.item)}</span>
            <span class="merged-note-amount">${formatAmount(item.amount)}</span>
          </div>`).join('');

        const toggleText = isExpanded ? '收合明細 ▴' : '查看明細 ▾';

        return `
        <div class="expense-note expense-note-merged${isExpanded ? ' merged-note-summary-expanded' : ''}">
          <div class="merged-note-summary" data-toggle-merged-note="${escapeHtml(noteKey)}" aria-expanded="${isExpanded}" role="button" tabindex="0">
            <div class="merged-note-summary-main">
              <strong>🧾 合併明細 ${details.length} 筆</strong>
              <span aria-hidden="true">｜</span>
              <span>${escapeHtml(currency)} ${formatAmount(total)}</span>
            </div>
            <button class="merged-note-toggle" type="button" data-toggle-merged-note="${escapeHtml(noteKey)}" aria-expanded="${isExpanded}">${toggleText}</button>
          </div>
          ${isExpanded ? `
          <div class="merged-note-table" role="table" aria-label="合併明細備註">
            <div class="merged-note-head" role="row">
              <span role="columnheader">日期</span>
              <span role="columnheader">品項</span>
              <span role="columnheader">金額</span>
            </div>
            <div class="merged-note-body">${rows}</div>
            <div class="merged-note-total">合計 ${escapeHtml(currency)} ${formatAmount(total)}</div>
          </div>` : ''}
        </div>`;
    }

    return `
        <details class="expense-note">
          <summary>備註</summary>
          <p>${escapeHtml(note)}</p>
        </details>`;
}

function toExpenseDateKey(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const normalized = raw.replace(/\//g, '-');
    const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (match) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
    const time = Date.parse(raw);
    if (!Number.isFinite(time)) return '';
    const date = new Date(time);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getExpenseDateTime(expense) {
    const key = toExpenseDateKey(expense.date);
    const match = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const time = match
        ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime()
        : Date.parse(expense.date || '');
    return Number.isFinite(time) ? time : 0;
}

function formatExpenseDateHeading(dateKey) {
    if (!dateKey) return '未設定消費日期';
    const date = new Date(`${dateKey}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateKey;
    const weekday = new Intl.DateTimeFormat('zh-TW', { weekday: 'short' }).format(date);
    return `${formatRocDate(dateKey)} ${weekday}`;
}

function buildExpenseSummary(expense) {
    const tags = [
        `付款人 ${expense.payer || '未設定'}`,
        expense.payment || '未設定付款方式',
        `${expense.currency || 'TWD'} ${money.format(Number(expense.amount || 0))}`,
        `匯率 ${money.format(Number(expense.rate || 1))}`,
        expense.split || ''
    ].filter(Boolean);

    return `
        <div class="expense-summary-tags" aria-label="付款資訊">
          ${tags.map(tag => `<span class="expense-summary-tag">${escapeHtml(tag)}</span>`).join('')}
        </div>`;
}

function buildExpenseDetail(expense) {
    const details = Array.isArray(expense.splitDetails) ? expense.splitDetails : [];
    const participants = details.length
        ? details
        : (expense.participants || []).map(name => ({
            member_name: name,
            share_amount_twd: ''
        }));
    const paidAmount = `NT$ ${money.format(Math.round(expense.twd || 0))}`;
    const participantRows = participants.map(item => {
        const share = Number(item.share_amount_twd || 0);
        const hasShareAmount = item.share_amount_twd !== '' && item.share_amount_twd !== null && item.share_amount_twd !== undefined;
        const amountText = hasShareAmount ? formatSignedTwd(share) : '金額未設定';
        return `
            <div class="expense-detail-row settlement-row">
              <span>${escapeHtml(item.member_name || '未命名')}</span>
              <strong class="settlement-amount">${escapeHtml(amountText)}</strong>
            </div>`;
    }).join('');

    return `
        <div class="expense-detail-panel settlement-summary">
          <div class="expense-detail-section settlement-section">
            <div class="expense-detail-label settlement-label">付款</div>
            <div class="expense-detail-row settlement-row expense-detail-paid">
              <span>${escapeHtml(expense.payer || '未設定')}</span>
              <strong class="settlement-amount">已付 ${paidAmount}</strong>
            </div>
          </div>
          <div class="expense-detail-section settlement-section">
            <div class="expense-detail-label settlement-label">分帳</div>
            ${participantRows || '<p class="expense-detail-empty">目前沒有分帳明細</p>'}
          </div>
        </div>`;
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

function hasActiveExpenseFilters() {
    return Boolean(expenseSearchTerm || Object.values(expenseFilters).some(Boolean));
}

function formatExpenseTableDate(expense) {
    const dateKey = toExpenseDateKey(expense.date);
    return formatRocDate(dateKey) || dateKey || '未設定';
}

function formatExpenseCreatedAt(expense) {
    const value = expense.createdAt || expense.updatedAt || '';
    if (!value) return '未提供';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getExpenseParticipantCount(expense) {
    const details = Array.isArray(expense.splitDetails) ? expense.splitDetails.filter(item => item.member_name) : [];
    if (details.length) return details.length;
    return Array.isArray(expense.participants) ? expense.participants.filter(Boolean).length : 0;
}

function getExpenseAverageShare(expense) {
    const details = Array.isArray(expense.splitDetails) ? expense.splitDetails : [];
    const shares = details
        .map(item => Number(item.share_amount_twd || 0))
        .filter(value => Number.isFinite(value) && value !== 0);
    if (shares.length) return shares.reduce((sum, value) => sum + value, 0) / shares.length;

    const participantCount = getExpenseParticipantCount(expense);
    return participantCount ? Number(expense.twd || 0) / participantCount : 0;
}

function buildExpenseStatusBadge(label, isActive) {
    return `<span class="expense-table-badge${isActive ? ' active' : ''}">${label}</span>`;
}

function buildExpenseTablePagination(totalPages, visibleCount) {
    if (totalPages <= 1) return '';

    const start = (expenseTablePage - 1) * EXPENSE_TABLE_PAGE_SIZE + 1;
    const end = Math.min(visibleCount, expenseTablePage * EXPENSE_TABLE_PAGE_SIZE);
    const pageStart = Math.max(1, Math.min(expenseTablePage - 2, totalPages - 4));
    const pageEnd = Math.min(totalPages, pageStart + 4);
    const pageButtons = Array.from({ length: pageEnd - pageStart + 1 }, (_, index) => pageStart + index)
        .map(page => `<button type="button" data-expense-table-page="${page}" class="${page === expenseTablePage ? 'active' : ''}" aria-current="${page === expenseTablePage ? 'page' : 'false'}">${page}</button>`)
        .join('');
    const leadingPage = pageStart > 1 ? '<span class="expense-page-gap">…</span>' : '';
    const trailingPage = pageEnd < totalPages ? '<span class="expense-page-gap">…</span>' : '';

    return `
        <div class="expense-table-pagination" aria-label="表格分頁">
          <span>第 ${expenseTablePage} / ${totalPages} 頁 · ${start}-${end} / ${visibleCount}</span>
          <div>
            <button type="button" data-expense-table-page="prev" ${expenseTablePage <= 1 ? 'disabled' : ''}>上一頁</button>
            <div class="expense-page-numbers">${leadingPage}${pageButtons}${trailingPage}</div>
            <button type="button" data-expense-table-page="next" ${expenseTablePage >= totalPages ? 'disabled' : ''}>下一頁</button>
          </div>
        </div>`;
}

function buildExpenseDetailNote(expense) {
    const note = String(expense?.note || '').trim();
    if (!note) return '<p class="expense-table-detail-empty">沒有備註</p>';
    return `<div class="expense-table-detail-note">${escapeHtml(note)}</div>`;
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
