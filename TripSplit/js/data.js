async function loadTrips() {
  try {
    const data = await jsonp('getTrips', {});
    const rows = Array.isArray(data) ? data : data.trips || [];
    if (rows.length) {
      trips = rows.map(normalizeTrip).filter(trip => trip.id && trip.name);
    }
  } catch (error) {
    console.warn(error);
  }

  if (shouldSelectLatestTripOnLoad) {
    currentTripId = getLatestTripId() || currentTripId;
    localStorage.setItem('tripsplit_current_trip_id', currentTripId);
    shouldSelectLatestTripOnLoad = false;
  }

  if (!trips.some(trip => trip.id === currentTripId)) currentTripId = trips[0].id;
  renderTripSelect();
  loadArchivedTrips();
}

function normalizeTrip(row) {
  const id = row.trip_id || row.id;
  return {
    id,
    name: row.trip_name || row.name,
    baseCurrency: row.base_currency || 'TWD',
    updatedAt: row.updated_at || row.updatedAt || row.modified_at || row.modifiedAt || row.last_modified || row.lastModified || row.created_at || row.createdAt || getStoredTripModifiedAt(id) || ''
  };
}

function getTripSortTime(trip) {
  const updatedTime = Date.parse(trip.updatedAt || '');
  if (Number.isFinite(updatedTime)) return updatedTime;

  const idTimestamp = Number(String(trip.id || '').replace(/^trip_/, ''));
  return Number.isFinite(idTimestamp) ? idTimestamp : 0;
}

function getLatestTripId() {
  if (!trips.length) return '';

  return [...trips].sort((a, b) => {
    const timeDiff = getTripSortTime(b) - getTripSortTime(a);
    if (timeDiff) return timeDiff;
    return trips.indexOf(b) - trips.indexOf(a);
  })[0].id;
}

async function loadArchivedTrips() {
  try {
    const data = await jsonp('getArchivedTrips', {});
    const rows = Array.isArray(data) ? data : data.archivedTrips || [];
    if (rows.length) {
      archivedTrips = rows.map(row => ({
        id: row.trip_id || row.id,
        name: row.trip_name || row.name,
        baseCurrency: row.base_currency || 'TWD'
      })).filter(trip => trip.id && trip.name);
    } else {
      archivedTrips = [];
    }
  } catch (error) {
    console.warn(error);
    archivedTrips = [];
  }

  renderArchivedTrips();
}

async function loadCurrentTripData() {
  setStatus(`正在讀取「${currentTrip().name}」資料...`);
  try {
    const data = await jsonp('getInitialData', { trip_id: currentTripId });
    applyLoadedData(data);
    setStatus(`已切換到「${currentTrip().name}」。`, 'success');
  } catch (error) {
    console.warn(error);
    applyFallbackData();
    const blockedByClient = error && error.code === 'GAS_JSONP_LOAD';
    if (blockedByClient) {
      setStatus(`已切換到「${currentTrip().name}」；GAS 請求被瀏覽器或外掛阻擋，已改用本機預覽資料。`, 'error');
    } else {
      setStatus(`已切換到「${currentTrip().name}」；目前使用本機預覽資料。`, 'info');
    }
  }
  renderAll();
  updateFormDisabledState();
}

function applyLoadedData(data) {
  members = normalizeMembers(data.members || []);
  categories = normalizeCategories(data.categories || []);
  paymentMethods = normalizePaymentMethods(data.paymentMethods || data.payment_methods || []);
  exchangeRates = normalizeRates(data.exchangeRates || data.exchange_rates || exchangeRates);
  expenseReceipts = normalizeExpenseReceipts(data.expenseReceipts || data.expense_receipts || []);
  expenses = normalizeExpenses(data.expenses || [], expenseReceipts);

  // 只有在 fallback 中有對應 trip 且 GAS 沒回傳資料時才使用 fallback
  if ((!members.length || !categories.length || !paymentMethods.length) && fallbackDataByTrip[currentTripId]) {
    applyFallbackData({ keepExpenses: Boolean(expenses.length) });
  }
}

function applyFallbackData(options = {}) {
  const fallback = fallbackDataByTrip[currentTripId];
  if (!fallback) return;
  if (!members.length) members = fallback.members;
  if (!categories.length) categories = fallback.categories;
  if (!paymentMethods.length) paymentMethods = fallback.paymentMethods;
  if (!options.keepExpenses && !expenses.length) expenses = fallback.expenses;
}
