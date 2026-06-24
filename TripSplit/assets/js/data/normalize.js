/* TripSplit module split from assets/app.js. Keep classic script order in HTML. */
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

function pickTextField(row, fieldNames) {
    const lowerCaseLookup = Object.keys(row || {}).reduce((lookup, key) => {
        lookup[key.toLowerCase()] = row[key];
        return lookup;
    }, {});

    for (const fieldName of fieldNames) {
        const value = row[fieldName] !== undefined ? row[fieldName] : lowerCaseLookup[fieldName.toLowerCase()];
        if (value === null || value === undefined) continue;
        const text = String(value).trim();
        if (text) return text;
    }

    return '';
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
            note: pickTextField(row, ['note', 'notes', 'remark', 'remarks', 'memo', 'description', 'comment', 'expense_note']),
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
