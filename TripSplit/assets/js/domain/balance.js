/* TripSplit module split from assets/app.js. Keep classic script order in HTML. */
function computeMemberBalances() {
    const names = members.map(member => member.name);
    const nameSet = new Set(names);
    const totals = {};
    names.forEach(name => {
        totals[name] = {
            name,
            paidTotal: 0,
            personal: 0,
            selfPaid: 0,
            advancedForOthers: 0,
            owedToOthers: 0
        };
    });

    expenses.forEach(expense => {
        const payer = expense.payer;
        const amountTwd = Number(expense.twd || 0);
        if (!amountTwd || !names.length) return;

        if (payer && !totals[payer]) {
            totals[payer] = {
                name: payer,
                paidTotal: 0,
                personal: 0,
                selfPaid: 0,
                advancedForOthers: 0,
                owedToOthers: 0
            };
        }
        if (payer) totals[payer].paidTotal += amountTwd;

        const shareRows = getExpenseShareRows(expense, names, amountTwd);
        let payerShare = 0;
        let otherShare = 0;

        shareRows.forEach(row => {
            if (!row.name) return;
            if (!totals[row.name]) {
                totals[row.name] = {
                    name: row.name,
                    paidTotal: 0,
                    personal: 0,
                    selfPaid: 0,
                    advancedForOthers: 0,
                    owedToOthers: 0
                };
            }
            const shareAmount = Number(row.amount || 0);
            totals[row.name].personal += shareAmount;
            if (row.name === payer) {
                payerShare += shareAmount;
            } else {
                otherShare += shareAmount;
                totals[row.name].owedToOthers += shareAmount;
            }
            nameSet.add(row.name);
        });

        if (payer && totals[payer]) {
            totals[payer].selfPaid += payerShare;
            totals[payer].advancedForOthers += otherShare;
        }
    });

    return Array.from(nameSet).map(name => ({
        name,
        paid: Math.round(totals[name]?.advancedForOthers || 0),
        owed: Math.round(totals[name]?.personal || 0),
        paidTotal: Math.round(totals[name]?.paidTotal || 0),
        personal: Math.round(totals[name]?.personal || 0),
        selfPaid: Math.round(totals[name]?.selfPaid || 0),
        advancedForOthers: Math.round(totals[name]?.advancedForOthers || 0),
        owedToOthers: Math.round(totals[name]?.owedToOthers || 0),
        balance: Math.round((totals[name]?.advancedForOthers || 0) - (totals[name]?.owedToOthers || 0))
    }));
}

function getExpenseShareRows(expense, memberNames, amountTwd) {
    const details = Array.isArray(expense?.splitDetails) ? expense.splitDetails : [];
    const usableDetails = details
        .map(detail => ({
            name: detail.member_name,
            amount: Number(detail.share_amount_twd || 0),
            hasAmount: detail.share_amount_twd !== '' && detail.share_amount_twd !== null && detail.share_amount_twd !== undefined
        }))
        .filter(detail => detail.name && detail.hasAmount && Number.isFinite(detail.amount));

    if (usableDetails.length) {
        return normalizeShareRounding(usableDetails, amountTwd);
    }

    const participants = Array.isArray(expense?.participants)
        ? expense.participants.filter(Boolean)
        : [];
    const shareNames = participants.length ? participants : memberNames;
    if (!shareNames.length) return [];

    return splitAmountEvenly(amountTwd, shareNames).map((amount, index) => ({
        name: shareNames[index],
        amount
    }));
}

function normalizeShareRounding(rows, targetTotal) {
    const roundedRows = rows.map(row => ({
        name: row.name,
        amount: Math.round(Number(row.amount || 0))
    }));
    const diff = Math.round(targetTotal) - roundedRows.reduce((sum, row) => sum + row.amount, 0);
    if (roundedRows.length && diff !== 0) {
        roundedRows[roundedRows.length - 1].amount += diff;
    }
    return roundedRows;
}

function splitAmountEvenly(total, names) {
    const roundedTotal = Math.round(Number(total || 0));
    if (!names.length) return [];
    const base = Math.floor(roundedTotal / names.length);
    let remainder = roundedTotal - (base * names.length);
    return names.map(() => {
        const extra = remainder > 0 ? 1 : 0;
        remainder -= extra;
        return base + extra;
    });
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

function addDirectSettlementAmount(matrix, from, to, amount) {
    const roundedAmount = Math.round(Number(amount || 0));
    if (!from || !to || from === to || roundedAmount === 0) return;

    if (roundedAmount < 0) {
        addDirectSettlementAmount(matrix, to, from, Math.abs(roundedAmount));
        return;
    }

    const key = `${from}\u0000${to}`;
    matrix[key] = (matrix[key] || 0) + roundedAmount;
}

function buildDirectSettlementSuggestions() {
    const names = members.map(member => member.name);
    const matrix = {};

    expenses.forEach(expense => {
        const payer = expense.payer;
        const amountTwd = Number(expense.twd || 0);
        if (!payer || !amountTwd || !names.length) return;

        getExpenseShareRows(expense, names, amountTwd).forEach(row => {
            if (!row.name || row.name === payer) return;
            addDirectSettlementAmount(matrix, row.name, payer, row.amount);
        });
    });

    const settledPairs = new Set();
    const suggestions = [];

    Object.keys(matrix).forEach(key => {
        if (settledPairs.has(key)) return;

        const [from, to] = key.split('\u0000');
        const reverseKey = `${to}\u0000${from}`;
        const amount = Math.round((matrix[key] || 0) - (matrix[reverseKey] || 0));
        settledPairs.add(key);
        settledPairs.add(reverseKey);

        if (amount > 0.5) suggestions.push({ from, to, amount });
        else if (amount < -0.5) suggestions.push({ from: to, to: from, amount: Math.abs(amount) });
    });

    return suggestions.sort((a, b) => {
        if (b.amount !== a.amount) return b.amount - a.amount;
        return `${a.from}${a.to}`.localeCompare(`${b.from}${b.to}`, 'zh-TW');
    });
}

const BALANCE_DETAIL_LABELS = {
    balance: '\u61c9\u4ed8 / \u61c9\u6536\u7e3d\u984d',
    personal: '\u500b\u4eba\u65c5\u904a\u82b1\u8cbb',
    selfPaid: '\u81ea\u4ed8\u500b\u4eba\u9805\u76ee',
    advancedForOthers: '\u4ee3\u588a\u5171\u540c\u652f\u51fa',
    owedToOthers: '\u61c9\u4ed8\u4ed6\u4eba\u5206\u6524'
};

function getBalanceRowByName(memberName) {
    return computeMemberBalances().find(item => item.name === memberName) || null;
}

function formatBalanceDetailDate(expense) {
    return formatExpenseTableDate(expense);
}

function formatExpenseOriginalAmount(expense) {
    return `${expense.currency || 'TWD'} ${money.format(Number(expense.amount || 0))}`;
}

function buildShareSummary(shareRows) {
    return shareRows
        .filter(row => row.name)
        .map(row => `${escapeHtml(row.name)} ${formatSignedTwd(row.amount)}`)
        .join('<br>');
}

function getBalanceExpenseDetailRows(memberName, category) {
    const names = members.map(member => member.name);
    const rows = [];

    expenses.forEach(expense => {
        const payer = expense.payer || '';
        const amountTwd = Number(expense.twd || 0);
        if (!amountTwd || !names.length) return;

        const shareRows = getExpenseShareRows(expense, names, amountTwd);
        const memberShare = shareRows.find(row => row.name === memberName);
        const otherShares = shareRows.filter(row => row.name && row.name !== payer);
        const advancedAmount = payer === memberName
            ? otherShares.reduce((sum, row) => sum + Number(row.amount || 0), 0)
            : 0;

        if (category === 'personal' && memberShare) {
            rows.push({
                title: expense.title || '\u672a\u547d\u540d\u652f\u51fa',
                date: formatBalanceDetailDate(expense),
                payer,
                original: formatExpenseOriginalAmount(expense),
                participants: buildShareSummary(shareRows),
                relation: payer === memberName ? '\u81ea\u5df1\u4ed8\u6b3e' : `\u4ed8\u6b3e\u4eba\uff1a${payer || '\u672a\u8a2d\u5b9a'}`,
                amount: Math.round(Number(memberShare.amount || 0))
            });
            return;
        }

        if (category === 'selfPaid' && payer === memberName && memberShare) {
            rows.push({
                title: expense.title || '\u672a\u547d\u540d\u652f\u51fa',
                date: formatBalanceDetailDate(expense),
                payer,
                original: formatExpenseOriginalAmount(expense),
                participants: buildShareSummary(shareRows),
                relation: '\u4ed8\u6b3e\u4eba\u81ea\u5df1\u7684\u5206\u6524',
                amount: Math.round(Number(memberShare.amount || 0))
            });
            return;
        }

        if (category === 'advancedForOthers' && payer === memberName && advancedAmount) {
            rows.push({
                title: expense.title || '\u672a\u547d\u540d\u652f\u51fa',
                date: formatBalanceDetailDate(expense),
                payer,
                original: formatExpenseOriginalAmount(expense),
                participants: buildShareSummary(shareRows),
                relation: shareRows
                    .filter(row => row.name && row.name !== memberName)
                    .map(row => `${escapeHtml(row.name)} ${formatSignedTwd(row.amount)}`)
                    .join('<br>'),
                amount: Math.round(advancedAmount)
            });
            return;
        }

        if (category === 'owedToOthers' && memberShare && payer && payer !== memberName) {
            rows.push({
                title: expense.title || '\u672a\u547d\u540d\u652f\u51fa',
                date: formatBalanceDetailDate(expense),
                payer,
                original: formatExpenseOriginalAmount(expense),
                participants: buildShareSummary(shareRows),
                relation: `\u6211\u6b20 ${escapeHtml(payer)}`,
                amount: Math.round(Number(memberShare.amount || 0))
            });
        }
    });

    return rows;
}

function getBalanceTransferDetailRows(memberName) {
    const balanceRow = getBalanceRowByName(memberName);
    const memberBalance = Number(balanceRow?.balance || 0);
    return buildDirectSettlementSuggestions()
        .filter(item => item.from === memberName || item.to === memberName)
        .map(item => {
            const rawAmount = Math.round(Number(item.amount || 0));
            const amount = memberBalance >= 0
                ? (item.to === memberName ? rawAmount : -rawAmount)
                : (item.from === memberName ? rawAmount : -rawAmount);
            return {
                title: `${item.from} \u2192 ${item.to}`,
                date: '\u7d50\u7b97\u5efa\u8b70',
                payer: item.from,
                original: formatTwd(item.amount),
                participants: `${escapeHtml(item.from)} \u4ed8\u7d66 ${escapeHtml(item.to)}`,
                relation: item.from === memberName ? `\u6211\u61c9\u4ed8\u7d66 ${escapeHtml(item.to)}` : `${escapeHtml(item.from)} \u61c9\u4ed8\u7d66\u6211\uff08\u62b5\u6263\uff09`,
                amount
            };
        });
}

function buildBalanceDetailRows(memberName, category) {
    if (category === 'balance') return getBalanceTransferDetailRows(memberName);
    return getBalanceExpenseDetailRows(memberName, category);
}

function buildBalanceDetailTable(rows, category) {
    if (!rows.length) return '<p class="field-hint">\u9019\u500b\u5206\u985e\u76ee\u524d\u6c92\u6709\u660e\u7d30\u3002</p>';

    const relationHead = category === 'advancedForOthers'
        ? '\u9019\u7b46\u4ee3\u588a\u7d66\u8ab0'
        : category === 'owedToOthers'
            ? '\u6211\u6b20\u8ab0'
            : category === 'balance'
                ? '\u7d50\u7b97\u95dc\u4fc2'
                : '\u95dc\u4fc2';

    return `
        <div class="balance-detail-table-wrap">
          <table class="balance-detail-table">
            <thead>
              <tr>
                <th scope="col">\u65e5\u671f</th>
                <th scope="col">\u54c1\u9805</th>
                <th scope="col">\u4ed8\u6b3e\u4eba</th>
                <th scope="col">\u539f\u59cb\u91d1\u984d</th>
                <th scope="col">\u53c3\u8207\u5206\u6524\u7684\u4eba</th>
                <th scope="col">${relationHead}</th>
                <th scope="col" class="numeric">\u7b97\u5165\u91d1\u984d</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(row => `
                <tr>
                  <td data-label="\u65e5\u671f">${escapeHtml(row.date)}</td>
                  <td data-label="\u54c1\u9805">${escapeHtml(row.title)}</td>
                  <td data-label="\u4ed8\u6b3e\u4eba">${escapeHtml(row.payer || '\u672a\u8a2d\u5b9a')}</td>
                  <td data-label="\u539f\u59cb\u91d1\u984d">${escapeHtml(row.original)}</td>
                  <td data-label="\u53c3\u8207\u5206\u6524\u7684\u4eba">${row.participants || '-'}</td>
                  <td data-label="${relationHead}">${row.relation || '-'}</td>
                  <td data-label="\u7b97\u5165\u91d1\u984d" class="numeric"><strong>${formatSignedTwd(row.amount)}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`;
}

function openBalanceDetailModal(memberName, category = 'balance') {
    const modal = $('#balance-detail-modal');
    const title = $('#balance-detail-title');
    const summary = $('#balance-detail-summary');
    const body = $('#balance-detail-body');
    const balanceRow = getBalanceRowByName(memberName);
    if (!modal || !title || !summary || !body || !balanceRow) return;

    const label = BALANCE_DETAIL_LABELS[category] || BALANCE_DETAIL_LABELS.balance;
    const expectedRaw = Math.round(Number(balanceRow[category] ?? balanceRow.balance ?? 0));
    const expected = category === 'balance' ? Math.abs(expectedRaw) : expectedRaw;
    const expectedText = category === 'balance' ? formatTwd(expected) : formatSignedTwd(expected);
    const rows = buildBalanceDetailRows(memberName, category);
    const actual = rows.reduce((sum, row) => sum + Math.round(Number(row.amount || 0)), 0);
    const isMatched = actual === expected;

    title.textContent = `${memberName} - ${label}`;
    summary.textContent = `${label} ${expectedText}，共 ${rows.length} 筆明細。`;
    body.innerHTML = `
        <div class="balance-detail-total ${isMatched ? 'matched' : 'mismatch'}">
          <div><span>\u756b\u9762\u7e3d\u984d</span><strong>${expectedText}</strong></div>
          <div><span>\u660e\u7d30\u52a0\u7e3d</span><strong>${formatSignedTwd(actual)}</strong></div>
          ${isMatched ? '<p>\u660e\u7d30\u52a0\u7e3d\u8207\u756b\u9762\u7e3d\u984d\u4e00\u81f4\u3002</p>' : '<p>\u26a0 \u660e\u7d30\u52a0\u7e3d\u8207\u756b\u9762\u7e3d\u984d\u4e0d\u4e00\u81f4\uff0c\u8acb\u6aa2\u67e5\u5206\u6524\u660e\u7d30\u3002</p>'}
        </div>
        ${buildBalanceDetailTable(rows, category)}
    `;

    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
}

function closeBalanceDetailModal() {
    const modal = $('#balance-detail-modal');
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
}

function getExpenseCategoryLabel(expense) {
    const label = String(expense?.category || '').trim();
    return label || '未分類';
}

function getCategoryDetailRows(categoryName) {
    const selected = String(categoryName || '').trim() || '未分類';
    return expenses.filter(expense => getExpenseCategoryLabel(expense) === selected);
}

function hasSplitValue(value) {
    if (value === '' || value === null || value === undefined) return false;
    const number = Number(value);
    return Number.isFinite(number) && number !== 0;
}

function getExpenseSplitRowsForCategoryDetail(expense) {
    const amountTwd = Number(expense?.twd || 0);
    const rate = Number(expense?.rate || 1) || 1;
    const details = Array.isArray(expense?.splitDetails) ? expense.splitDetails.filter(item => item?.member_name) : [];
    const participants = Array.isArray(expense?.participants) ? expense.participants.filter(Boolean) : [];
    const sourceRows = details.length
        ? details
        : participants.map(name => ({ member_name: name }));

    if (!sourceRows.length) return [];

    return sourceRows.map((item) => {
        const rawAmountTwd = hasSplitValue(item.share_amount_twd)
            ? Number(item.share_amount_twd)
            : hasSplitValue(item.share_amount_original)
                ? Number(item.share_amount_original) * rate
                : 0;
        const rawPercent = hasSplitValue(item.share_percentage) ? Number(item.share_percentage) : 0;
        const isEvenSplitFallback = !rawAmountTwd && !rawPercent && sourceRows.length > 0 && String(expense?.split || '').includes('平均');
        const amount = rawAmountTwd
            || (rawPercent && amountTwd ? amountTwd * (rawPercent / 100) : 0)
            || (isEvenSplitFallback ? amountTwd / sourceRows.length : 0);
        const percent = rawPercent
            || (amount && amountTwd ? (amount / amountTwd) * 100 : 0)
            || (isEvenSplitFallback ? 100 / sourceRows.length : 0);

        return {
            name: item.member_name,
            amount,
            percent,
            hasShare: Boolean(amount || percent)
        };
    });
}

function formatSplitPercent(value) {
    const percent = Number(value || 0);
    if (!Number.isFinite(percent) || percent === 0) return '-';
    const rounded = Math.round(percent * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

function buildCategorySplitCell(rows, key) {
    if (!rows.length) return key === 'name' ? '未設定分攤' : '-';
    return rows.map(row => {
        if (!row.hasShare && key !== 'name') return '-';
        if (key === 'name') return escapeHtml(row.name || '未命名');
        if (key === 'amount') return row.amount ? `NT$ ${money.format(Math.round(row.amount))}` : '-';
        return formatSplitPercent(row.percent);
    }).map(value => `<div class="category-split-line">${value}</div>`).join('');
}

function buildCategorySplitCardRows(rows) {
    if (!rows.length) return '<p class="category-detail-card-empty">未設定分攤</p>';
    return rows.map(row => {
        const amountText = row.amount ? `NT$ ${money.format(Math.round(row.amount))}` : '金額未設定';
        const percentText = formatSplitPercent(row.percent);
        const detailText = row.hasShare ? `${amountText}（${percentText}）` : amountText;
        return `
            <div class="category-detail-split-row">
              <span>${escapeHtml(row.name || '未命名')}</span>
              <strong>${escapeHtml(detailText)}</strong>
            </div>`;
    }).join('');
}

function getCategoryPlainNote(expense) {
    const note = String(expense?.note || '').trim();
    if (!note || isMergedDetailNote(note)) return '';
    return note;
}

function buildCategoryExpenseDetailBlock(expense) {
    const note = String(expense?.note || '').trim();
    if (!note || !isMergedDetailNote(note)) return '';
    return buildExpenseNote(expense);
}

function buildCategoryDetailCards(rows) {
    if (!rows.length) return '';
    return `
        <div class="category-detail-card-list" aria-label="分類明細卡片">
          ${rows.map(expense => {
              const note = getCategoryPlainNote(expense);
              const detailBlock = buildCategoryExpenseDetailBlock(expense);
              const splitRows = getExpenseSplitRowsForCategoryDetail(expense);
              return `
                <article class="category-detail-card">
                  <div class="category-detail-card-head">
                    <div>
                      <span class="category-detail-card-date">日期：${escapeHtml(formatExpenseTableDate(expense))}</span>
                      <h3>品項：${escapeHtml(expense.title || '未命名支出')}</h3>
                    </div>
                    <strong>NT$ ${money.format(Math.round(Number(expense.twd || 0)))}</strong>
                  </div>
                  <div class="category-detail-card-meta">
                    <div><span>付款人</span><strong>${escapeHtml(expense.payer || '未設定')}</strong></div>
                    <div><span>總金額</span><strong>NT$ ${money.format(Math.round(Number(expense.twd || 0)))}</strong></div>
                  </div>
                  <section class="category-detail-split-box">
                    <h4>分攤明細</h4>
                    ${buildCategorySplitCardRows(splitRows)}
                  </section>
                  ${detailBlock ? `<section class="category-detail-merged-box"><h4>明細</h4>${detailBlock}</section>` : ''}
                  <div class="category-detail-card-note"><span>備註</span><p>${note ? escapeHtml(note) : '-'}</p></div>
                </article>`;
          }).join('')}
        </div>`;
}

function buildCategoryDetailTable(rows, categoryName) {
    if (!rows.length) return `<p class="field-hint">目前沒有${escapeHtml(categoryName)}明細</p>`;

    return `
        <div class="balance-detail-table-wrap category-detail-table-wrap">
          <table class="balance-detail-table">
            <thead>
              <tr>
                <th scope="col">日期</th>
                <th scope="col">品項 / 說明</th>
                <th scope="col">付款人</th>
                <th scope="col" class="numeric">金額</th>
                <th scope="col">分攤人</th>
                <th scope="col" class="numeric">分攤金額</th>
                <th scope="col" class="numeric">分攤比例</th>
                <th scope="col">明細</th>
                <th scope="col">備註</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(expense => {
                  const note = getCategoryPlainNote(expense);
                  const detailBlock = buildCategoryExpenseDetailBlock(expense);
                  const splitRows = getExpenseSplitRowsForCategoryDetail(expense);
                  return `
                    <tr>
                      <td data-label="日期">${escapeHtml(formatExpenseTableDate(expense))}</td>
                      <td data-label="品項 / 說明">${escapeHtml(expense.title || '未命名支出')}</td>
                      <td data-label="付款人">${escapeHtml(expense.payer || '未設定')}</td>
                      <td data-label="金額" class="numeric"><strong>NT$ ${money.format(Math.round(Number(expense.twd || 0)))}</strong></td>
                      <td data-label="分攤人">${buildCategorySplitCell(splitRows, 'name')}</td>
                      <td data-label="分攤金額" class="numeric">${buildCategorySplitCell(splitRows, 'amount')}</td>
                      <td data-label="分攤比例" class="numeric">${buildCategorySplitCell(splitRows, 'percent')}</td>
                      <td data-label="明細" class="category-detail-merged-cell">${detailBlock || '-'}</td>
                      <td data-label="備註">${note ? escapeHtml(note) : '-'}</td>
                    </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        ${buildCategoryDetailCards(rows)}`;
}

function openCategoryDetailModal(categoryName) {
    const modal = $('#category-detail-modal');
    const title = $('#category-detail-title');
    const summary = $('#category-detail-summary');
    const body = $('#category-detail-body');
    if (!modal || !title || !summary || !body) return;

    selectedCategory = String(categoryName || '').trim() || '未分類';
    const rows = getCategoryDetailRows(selectedCategory);
    const total = rows.reduce((sum, expense) => sum + Number(expense.twd || 0), 0);

    title.textContent = `${selectedCategory}明細`;
    summary.textContent = `${selectedCategory}合計：NT$${money.format(Math.round(total))}`;
    body.innerHTML = `
        <div class="balance-detail-total">
          <div><span>${escapeHtml(selectedCategory)}合計</span><strong>NT$ ${money.format(Math.round(total))}</strong></div>
        </div>
        ${buildCategoryDetailTable(rows, selectedCategory)}
    `;

    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
}

function closeCategoryDetailModal() {
    const modal = $('#category-detail-modal');
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
}

function renderBalancesAndSettlements() {
    const balanceRows = computeMemberBalances();
    const balanceGrid = $('#balance-grid');
    const settlementList = $('#settlement-list');
    if (!balanceGrid || !settlementList) return;

    const total = expenses.reduce((sum, item) => sum + Number(item.twd || 0), 0);
    const totalOwed = balanceRows.reduce((sum, item) => sum + Number(item.personal || item.owed || 0), 0);
    const unallocated = Math.max(0, Math.round(total) - Math.round(totalOwed));
    const suggestions = buildDirectSettlementSuggestions();
    const balanceHeader = $('#balances .card-title h2');
    const balanceIntro = $('#balances .card-title p');
    const settlementCard = $('#settlements');

    if (balanceHeader) balanceHeader.textContent = '\u500b\u4eba\u6536\u652f\u5e73\u8861';
    if (balanceIntro) balanceIntro.textContent = '\u5feb\u901f\u78ba\u8a8d\u8ab0\u61c9\u6536\u3001\u8ab0\u61c9\u4ed8\uff0c\u4ee5\u53ca\u5efa\u8b70\u5982\u4f55\u7d50\u6e05\u3002';
    if (settlementCard) settlementCard.hidden = true;

    const memberCards = balanceRows.map(item => {
        const status = item.balance > 0 ? '\u61c9\u6536' : item.balance < 0 ? '\u61c9\u4ed8' : '\u5df2\u5e73\u8861';
        const className = item.balance > 0 ? 'positive' : item.balance < 0 ? 'negative' : 'neutral';
        const detailButtonAttrs = `data-balance-detail-member="${escapeHtml(item.name)}"`;
        return `<article class="balance-card balance-person-card ${className}" tabindex="0" ${detailButtonAttrs} data-balance-detail-category="balance" aria-label="${escapeHtml(item.name)} ${status} ${formatTwd(item.balance)}，查看明細">
            <div class="balance-person-head">
                <span class="balance-person-name">${escapeHtml(item.name)}</span>
                <span class="balance-status-badge ${className}">${status}</span>
            </div>
            <button class="balance-detail-trigger balance-main-amount ${className}" type="button" ${detailButtonAttrs} data-balance-detail-category="balance" aria-label="查看 ${escapeHtml(item.name)} ${status}總額明細">${status} ${formatTwd(item.balance)}</button>
            <div class="balance-breakdown">
                <button type="button" class="balance-detail-line" ${detailButtonAttrs} data-balance-detail-category="personal"><span>\u500b\u4eba\u65c5\u904a\u82b1\u8cbb</span><strong>${formatSignedTwd(item.personal)}</strong></button>
                <button type="button" class="balance-detail-line" ${detailButtonAttrs} data-balance-detail-category="selfPaid"><span>\u81ea\u4ed8\u500b\u4eba\u9805\u76ee</span><strong>${formatSignedTwd(item.selfPaid)}</strong></button>
                <button type="button" class="balance-detail-line" ${detailButtonAttrs} data-balance-detail-category="advancedForOthers"><span>\u4ee3\u588a\u5171\u540c\u652f\u51fa</span><strong>${formatSignedTwd(item.advancedForOthers)}</strong></button>
                <button type="button" class="balance-detail-line" ${detailButtonAttrs} data-balance-detail-category="owedToOthers"><span>\u61c9\u4ed8\u4ed6\u4eba\u5206\u6524</span><strong>${formatSignedTwd(item.owedToOthers)}</strong></button>
            </div>
        </article>`;
    }).join('');

    const paymentRows = suggestions.length
        ? suggestions.map(item => `<div class="suggested-payment-row" data-balance-amount="${item.amount}">
            <div class="settlement-route" aria-label="${escapeHtml(item.from)} \u4ed8\u6b3e\u7d66 ${escapeHtml(item.to)}">
                <span>${escapeHtml(item.from)}</span>
                <span class="arrow" aria-hidden="true">&rarr;</span>
                <span>${escapeHtml(item.to)}</span>
            </div>
            <strong>${formatTwd(item.amount)}</strong>
        </div>`).join('')
        : '<p class="field-hint">\u76ee\u524d\u6bcf\u500b\u4eba\u90fd\u5df2\u5e73\u8861\uff0c\u7121\u9700\u8f49\u5e33\u3002</p>';

    balanceGrid.innerHTML = `
        <section class="balance-section suggested-payments-section" aria-labelledby="suggested-payments-title">
            <div class="balance-section-head">
                <h3 id="suggested-payments-title">\u5efa\u8b70\u4ed8\u6b3e</h3>
                <p>\u4f9d\u6bcf\u7b46\u4ee3\u588a\u660e\u7d30\u7d50\u7b97\uff0c\u81ea\u4ed8\u500b\u4eba\u9805\u76ee\u4e0d\u7d0d\u5165\u4ee3\u588a\u3002</p>
            </div>
            <div class="suggested-payment-list">${paymentRows}</div>
        </section>
        <section class="balance-section" aria-labelledby="member-balances-title">
            <div class="balance-section-head">
                <h3 id="member-balances-title">\u6bcf\u500b\u4eba\u7684\u6536\u652f</h3>
            </div>
            <div class="balance-member-grid">${memberCards}</div>
        </section>
        <section class="balance-section" aria-labelledby="balance-stats-title">
            <div class="balance-section-head">
                <h3 id="balance-stats-title">\u7d71\u8a08\u6458\u8981</h3>
            </div>
            <div class="balance-stat-grid">
                <article class="balance-stat-card"><span>\u7e3d\u652f\u51fa</span><strong>${formatTwd(total)}</strong></article>
                <article class="balance-stat-card"><span>\u5206\u6524\u72c0\u614b</span><strong>${unallocated === 0 ? '\u5df2\u5168\u6578\u5206\u6524' : `\u672a\u5206\u6524 ${formatTwd(unallocated)}`}</strong><small>\u5df2\u5206\u6524\u7e3d\u984d ${formatTwd(totalOwed)}</small></article>
                <article class="balance-stat-card"><span>\u5df2\u8a18\u9304\u652f\u51fa</span><strong>${expenses.length} \u7b46</strong></article>
            </div>
        </section>
    `;

    settlementList.innerHTML = suggestions.length
        ? suggestions.map(item => `<div class="settlement-item"><div class="settlement-route"><span>${escapeHtml(item.from)}</span><span class="arrow">&rarr;</span><span>${escapeHtml(item.to)}</span></div><strong>${formatTwd(item.amount)}</strong></div>`).join('')
        : '<p class="field-hint">\u76ee\u524d\u6bcf\u500b\u4eba\u90fd\u5df2\u5e73\u8861\uff0c\u7121\u9700\u8f49\u5e33\u3002</p>';
}
