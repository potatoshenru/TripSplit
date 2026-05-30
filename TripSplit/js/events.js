$('#trip-switch-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  currentTripId = $('#trip-select').value;
  localStorage.setItem('tripsplit_current_trip_id', currentTripId);
  await loadCurrentTripData();
});

$('#trip-select').addEventListener('change', async () => {
  currentTripId = $('#trip-select').value;
  localStorage.setItem('tripsplit_current_trip_id', currentTripId);
  await loadCurrentTripData();
});

$('#trip-create-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = $('#new-trip-name');
  const name = input.value.trim();
  if (!name) return;
  const newTripId = `trip_${Date.now()}`;
  input.value = '';
  trips.push({ id: newTripId, name, baseCurrency: 'TWD' });
  currentTripId = newTripId;
  markTripModified(currentTripId);
  localStorage.setItem('tripsplit_current_trip_id', currentTripId);
  renderAll();
  try {
    await jsonp('addTrip', { trip_id: newTripId, trip_name: name, base_currency: 'TWD', created_by: 'Dustin' });
    await loadTrips();
  } catch (error) {
    console.warn(error);
  }
  await loadCurrentTripData();
});

$('#member-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = $('#member-name');
  const name = input.value.trim();
  if (!name) return;
  input.value = '';
  await saveThenReload('addMember', { trip_id: currentTripId, member_name: name, email_or_note: '旅伴', avatar_text: name.slice(0, 1).toUpperCase() });
});

$('#category-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = $('#new-category-name').value.trim();
  const icon = $('#new-category-icon').value.trim() || '🏷';
  if (!name) return;
  $('#new-category-name').value = '';
  $('#new-category-icon').value = '';
  await saveThenReload('addCategory', { trip_id: currentTripId, category_name: name, icon, note: '自訂分類' });
});

$('#payment-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = $('#new-payment-name').value.trim();
  const icon = $('#new-payment-icon').value.trim() || '💳';
  if (!name) return;
  $('#new-payment-name').value = '';
  $('#new-payment-icon').value = '';
  await saveThenReload('addPaymentMethod', { trip_id: currentTripId, payment_method_name: name, icon, note: '自訂付款方式' });
});

document.addEventListener('click', async (event) => {
  const receiptButton = event.target.closest('[data-receipt-url]');
  if (receiptButton) {
    const decoded = decodeURIComponent(receiptButton.dataset.receiptUrl || '');
    openReceiptModal(decoded);
    return;
  }

  const closeModalButton = event.target.closest('[data-close-receipt-modal]');
  if (closeModalButton) {
    closeReceiptModal();
    return;
  }

  const previewRemoveButton = event.target.closest('[data-remove-preview-index]');
  if (previewRemoveButton) {
    removeReceiptFileAt(Number(previewRemoveButton.dataset.removePreviewIndex));
    return;
  }

  const archiveButton = event.target.closest('#archive-trip-btn');
  if (archiveButton) {
    if (!currentTripId) return;
    const confirmArchive = confirm(`確定要封存「${currentTrip().name}」嗎？\n\n封存後，此旅遊將不再顯示在下拉選單中。`);
    if (!confirmArchive) return;

    await saveThenReload('archiveTrip', { trip_id: currentTripId });

    // 切換到第一個未封存的旅遊
    if (trips.length > 0) {
      currentTripId = trips[0].id;
    } else {
      currentTripId = 'trip_default';
    }
    localStorage.setItem('tripsplit_current_trip_id', currentTripId);
    await loadTrips();
    await loadCurrentTripData();
    return;
  }

  const unarchiveButton = event.target.closest('[data-unarchive-trip]');
  if (unarchiveButton) {
    const tripId = unarchiveButton.dataset.unarchiveTrip;
    const tripName = archivedTrips.find(t => t.id === tripId)?.name || 'Unknown';
    const confirmUnarchive = confirm(`確定要解除封存「${tripName}」嗎？`);
    if (!confirmUnarchive) return;

    await saveThenReload('unarchiveTrip', { trip_id: tripId });
    await loadTrips();
    return;
  }

  const button = event.target.closest('[data-remove]');
  if (!button) return;
  const id = button.dataset.id;
  const type = button.dataset.remove;
  const actionMap = { member: 'deleteMember', category: 'deleteCategory', payment: 'deletePaymentMethod' };
  const payloadMap = { member: { member_id: id }, category: { category_id: id }, payment: { payment_method_id: id } };
  if (!actionMap[type]) return;
  await saveThenReload(actionMap[type], payloadMap[type]);
});

$('#amount-original').addEventListener('input', () => {
  updateExchangePreview();
  const splitType = document.querySelector('input[name="split_type"]:checked')?.value || '平均分';
  if (splitType === '自訂金額') {
    renderSplitConfig();
  } else {
    updateSplitSummary();
  }
});
$('#expense-currency').addEventListener('change', updateExchangePreview);
$('#participant-options').addEventListener('change', (event) => {
  if (event.target.matches('input[type="checkbox"]')) renderSplitConfig();
});
document.querySelectorAll('input[name="split_type"]').forEach(input => {
  input.addEventListener('change', renderSplitConfig);
});
$('#split-config').addEventListener('input', (event) => {
  if (event.target.matches('.split-input')) updateSplitSummary();
});
['#receipt-files', '#receipt-camera-files'].forEach(selector => {
  $(selector)?.addEventListener('change', (event) => {
    appendReceiptFiles(event.target.files || []);
    event.target.value = '';
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && $('#receipt-modal')?.classList.contains('show')) {
    closeReceiptModal();
  }
});

$('#expense-create-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const selectedCategory = categories.find(item => String(item.id) === $('#category-id').value);
  const selectedPayment = paymentMethods.find(item => String(item.id) === $('#payment-method-id').value);
  const amount = Number($('#amount-original').value || 0);
  const currency = $('#expense-currency').value;
  const rate = Number(exchangeRates[currency] || 1);
  const split = document.querySelector('input[name="split_type"]:checked').value;
  if (!$('#expense-title').value.trim() || !selectedCategory || !selectedPayment || !amount) return;

  const splitValidation = validateSplitInputs(split, amount);
  if (!splitValidation.ok) return;

    setStatus('正在處理收據照片...');
    const receiptPayloads = await getReceiptPayloads();

    await saveThenReload('addExpense', {
        trip_id: currentTripId,
        title: $('#expense-title').value.trim(),
        payer_member_name: $('#paid-by').value,
        category_id: selectedCategory.id,
        category_name: selectedCategory.name,
        payment_method_id: selectedPayment.id,
        payment_method_name: selectedPayment.name,
        expense_date: $('#expense-date').value,
        amount_original: amount,
        original_currency: currency,
        exchange_rate_to_twd: rate,
        amount_twd: Math.round(amount * rate),
        split_type: split,
        split_details: splitValidation.splitDetails,
        note: $('#note').value,
        participants: getSelectedParticipants(),
        receipts: receiptPayloads
    }, receiptPayloads.length ? 4500 : 1000);

  // 保存本次選擇的幣別
  localStorage.setItem('tripsplit_last_currency', currency);

  event.target.reset();
  clearReceiptFiles();
  updateExchangePreview();
  renderSplitConfig();
  document.querySelector('#expenses').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

(async function init() {
  renderAll();
  await loadTrips();
  await loadCurrentTripData();
})();
