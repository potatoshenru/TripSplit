function updateExchangePreview() {
  const currency = $('#expense-currency').value;
  const amount = Number($('#amount-original').value || 0);
  const rate = Number(exchangeRates[currency] || 1);
  $('#rate-preview').value = `${currency} → TWD：${rate}`;
  $('#amount-twd').value = amount ? `NT$ ${money.format(Math.round(amount * rate))}` : '輸入金額後自動換算';
}

function getSelectedParticipants() {
  return Array.from(document.querySelectorAll('#participant-options input:checked')).map(input => input.value);
}

function distributeIntegerPercent(count) {
  if (!count) return [];
  const base = Math.floor(100 / count);
  let remainder = 100 - (base * count);

  return Array.from({ length: count }, () => {
    const value = base + (remainder > 0 ? 1 : 0);
    remainder -= 1;
    return value;
  });
}

function distributeAmount(totalAmount, count) {
  if (!count) return [];
  const roundedTotal = Math.round(Number(totalAmount || 0) * 100) / 100;
  const base = Math.floor((roundedTotal / count) * 100) / 100;
  let remaining = roundedTotal;

  return Array.from({ length: count }, (_, index) => {
    const value = index === count - 1 ? remaining : base;
    remaining = Math.round((remaining - value) * 100) / 100;
    return Math.round(value * 100) / 100;
  });
}

function formatAmountValue(value) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : number.toFixed(2);
}

function updateSplitSummary() {
  const summary = $('#split-summary');
  if (!summary) return;

  const inputs = Array.from(document.querySelectorAll('#split-config .split-input'));
  const kind = inputs[0]?.dataset.kind || '';
  const total = inputs.reduce((sum, input) => sum + Number(input.value || 0), 0);

  if (kind === 'percent') {
    const diff = Math.round((100 - total) * 100) / 100;
    summary.textContent = `目前合計 ${formatAmountValue(total)}%，${diff === 0 ? '剛好 100%' : diff > 0 ? `還差 ${formatAmountValue(diff)}%` : `多出 ${formatAmountValue(Math.abs(diff))}%`}。`;
    return;
  }

  if (kind === 'amount') {
    const target = Number($('#amount-original').value || 0);
    const diff = Math.round((target - total) * 100) / 100;
    summary.textContent = `目前合計 ${formatAmountValue(total)}，${diff === 0 ? '剛好等於原始金額' : diff > 0 ? `還差 ${formatAmountValue(diff)}` : `多出 ${formatAmountValue(Math.abs(diff))}`}。`;
  }
}

function renderSplitConfig() {
  const splitType = document.querySelector('input[name="split_type"]:checked')?.value || '平均分';
  const selected = getSelectedParticipants();
  const container = $('#split-config');
  if (!container) return;

  if (!selected.length || splitType === '平均分') {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }

  const isPercent = splitType === '百分比分';
  const kind = isPercent ? 'percent' : 'amount';
  const defaultValues = isPercent
    ? distributeIntegerPercent(selected.length)
    : distributeAmount(Number($('#amount-original').value || 0), selected.length);

  container.style.display = 'grid';
  container.innerHTML = `
    <label>${isPercent ? '請輸入每位比例（%）' : '請輸入每位金額（原始幣別）'}</label>
    <div class="split-input-grid">
      ${selected.map((name, index) => `
        <div class="split-input-row">
          <span>${name} 分攤</span>
          <input
            type="number"
            class="split-input"
            data-member="${name}"
            data-kind="${kind}"
            min="0"
            step="${isPercent ? '1' : '0.01'}"
            value="${isPercent ? defaultValues[index] : formatAmountValue(defaultValues[index])}"
            placeholder="${isPercent ? '例如 25' : '例如 1200'}"
          />
        </div>
      `).join('')}
    </div>
    <p class="field-hint" id="split-summary"></p>
  `;
  updateSplitSummary();
}

function validateSplitInputs(splitType, totalAmount) {
  const selected = getSelectedParticipants();
  if (!selected.length) {
    alert('請至少勾選一位分帳對象。');
    return { ok: false };
  }

  if (splitType === '平均分') {
    return {
      ok: true,
      splitDetails: selected.map(memberName => ({ member_name: memberName, split_mode: 'equal' }))
    };
  }

  const inputs = Array.from(document.querySelectorAll('#split-config .split-input'));
  if (!inputs.length || inputs.length !== selected.length) {
    alert('請先輸入分帳資料。');
    return { ok: false };
  }

  const splitDetails = [];
  for (const input of inputs) {
    const value = Number(input.value);
    if (!(value >= 0)) {
      alert(`請輸入 ${input.dataset.member} 的分帳數值。`);
      input.focus();
      return { ok: false };
    }

    if (splitType === '百分比分') {
      splitDetails.push({
        member_name: input.dataset.member,
        split_mode: 'percent',
        share_percentage: value
      });
      continue;
    }

    splitDetails.push({
      member_name: input.dataset.member,
      split_mode: 'amount',
      share_amount_original: value
    });
  }

  if (splitType === '百分比分') {
    const totalPercent = splitDetails.reduce((sum, item) => sum + Number(item.share_percentage || 0), 0);
    if (Math.abs(totalPercent - 100) > 0.01) {
      alert(`百分比加總需為 100%，目前為 ${totalPercent.toFixed(2)}%。`);
      return { ok: false };
    }
  }

  if (splitType === '自訂金額') {
    const totalSplitAmount = splitDetails.reduce((sum, item) => sum + Number(item.share_amount_original || 0), 0);
    if (Math.abs(totalSplitAmount - totalAmount) > 1) {
      alert(`自訂金額加總建議接近原始金額，現在加總為 ${totalSplitAmount.toFixed(2)}。`);
    }
  }

  return { ok: true, splitDetails };
}
