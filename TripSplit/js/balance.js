function computeMemberBalances() {
  const names = members.map(member => member.name);
  const balances = {};
  names.forEach(name => {
    balances[name] = 0;
  });

  expenses.forEach(expense => {
    const payer = expense.payer;
    const amountTwd = Number(expense.twd || 0);
    if (!amountTwd || !names.length) return;

    if (balances[payer] === undefined) balances[payer] = 0;
    balances[payer] += amountTwd;

    const share = amountTwd / names.length;
    names.forEach(name => {
      balances[name] = (balances[name] || 0) - share;
    });
  });

  return names.map(name => ({
    name,
    balance: Math.round(balances[name] || 0)
  }));
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

function renderBalancesAndSettlements() {
  const balanceRows = computeMemberBalances();
  const balanceGrid = $('#balance-grid');
  const settlementList = $('#settlement-list');
  if (!balanceGrid || !settlementList) return;

  const total = expenses.reduce((sum, item) => sum + Number(item.twd || 0), 0);
  const avg = members.length ? Math.round(total / members.length) : 0;

  const memberCards = balanceRows.map(item => {
    const sign = item.balance >= 0 ? '+' : '-';
    const amount = money.format(Math.abs(item.balance));
    const className = item.balance > 0 ? 'positive' : item.balance < 0 ? 'negative' : 'neutral';
    return `<div class="balance-card"><span>${item.name}</span><strong class="${className}">${sign} NT$ ${amount}</strong></div>`;
  }).join('');

  balanceGrid.innerHTML = memberCards
    + `<div class="balance-card"><span>已記錄支出</span><strong class="neutral">${expenses.length} 筆</strong></div>`
    + `<div class="balance-card"><span>平均每人</span><strong class="neutral">NT$ ${money.format(avg)}</strong></div>`;

  const suggestions = buildSettlementSuggestions(balanceRows);
  settlementList.innerHTML = suggestions.length
    ? suggestions.map(item => `<div class="settlement-item"><div class="settlement-route"><span>${item.from}</span><span class="arrow">→</span><span>${item.to}</span></div><strong>NT$ ${money.format(item.amount)}</strong></div>`).join('')
    : '<p class="field-hint">目前已接近平衡，暫無建議轉帳。</p>';
}
