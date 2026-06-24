/* TripSplit module split from assets/app.js. Keep classic script order in HTML. */
function getTripDataCacheKey(tripId) {
    return `${TRIP_DATA_CACHE_PREFIX}${tripId}`;
}

function cacheTripData(tripId, data) {
    if (!tripId || !data) return;

    try {
        localStorage.setItem(getTripDataCacheKey(tripId), JSON.stringify({
            version: TRIP_DATA_CACHE_VERSION,
            savedAt: new Date().toISOString(),
            data
        }));
    } catch (error) {
        console.warn('Unable to cache trip data.', error);
    }
}

function getCachedTripData(tripId) {
    if (!tripId) return null;

    try {
        const cached = JSON.parse(localStorage.getItem(getTripDataCacheKey(tripId)) || 'null');
        if (!cached || cached.version !== TRIP_DATA_CACHE_VERSION || !cached.data) return null;
        return cached;
    } catch (error) {
        console.warn('Unable to read cached trip data.', error);
        return null;
    }
}

function applyCachedDataIfAvailable(tripId) {
    const cached = getCachedTripData(tripId);
    if (!cached?.data) return false;

    applyLoadedData(cached.data);
    renderAll();
    updateFormDisabledState();
    return true;
}

async function loadTrips() {
    try {
        const data = await requestGas('getTrips', {});
        const rows = Array.isArray(data) ? data : data.trips || [];
        if (rows.length) {
            trips = rows.map(normalizeTrip).filter(trip => trip.id && trip.name);
        }
    } catch (error) {
        console.warn(error);
    }

    if (!isPreviewMode && shouldSelectLatestTripOnLoad) {
        currentTripId = getLatestTripId() || currentTripId;
        localStorage.setItem('tripsplit_current_trip_id', currentTripId);
        localStorage.setItem(TRIP_SELECTION_MODE_KEY, 'auto');
        shouldSelectLatestTripOnLoad = false;
    }

    if (!isPreviewMode && !trips.some(trip => trip.id === currentTripId)) currentTripId = trips[0]?.id || currentTripId;
    renderTripSelect();
    await loadArchivedTrips();
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
        const data = await requestGas('getArchivedTrips', {});
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

async function loadCurrentTripDataLegacy() {
    if (isPreviewMode && !currentTripId) {
        clearLoadedTripData();
        renderAll();
        setStatus('預覽連結缺少 trip_id，無法載入帳本資料。', 'error');
        return;
    }

    setStatus(`正在讀取「${currentTrip().name}」資料...`);
    try {
        const data = await requestGas('getInitialData', { trip_id: currentTripId });
        applyLoadedData(data);
        setStatus(`已切換到「${currentTrip().name}」。`, 'success');
    } catch (error) {
        console.warn(error);
        if (isPreviewMode) {
            clearLoadedTripData();
            renderAll();
            updateFormDisabledState();
            setStatus('無法載入預覽帳本，請確認連結是否完整或帳本仍存在。', 'error');
            return;
        }

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

async function loadCurrentTripData() {
    const token = ++activeLoadToken;
    const tripId = currentTripId;

    if (isPreviewMode && !tripId) {
        clearLoadedTripData();
        renderAll();
        setStatus('Preview link is missing trip_id; unable to load trip data.', 'error');
        setLoading(false);
        return;
    }

    setStatus(`Loading "${currentTrip().name}"...`);
    setLoading(true);
    if (!isPreviewMode && applyCachedDataIfAvailable(tripId)) setLoading(true);

    try {
        const data = await requestGas('getInitialData', { trip_id: tripId });
        if (token !== activeLoadToken || tripId !== currentTripId) return;

        applyLoadedData(data);
        cacheTripData(tripId, data);
        setStatus(`Loaded "${currentTrip().name}".`, 'success');
    } catch (error) {
        if (token !== activeLoadToken || tripId !== currentTripId) return;
        console.warn(error);
        handleLoadError(error, tripId);
    } finally {
        if (token === activeLoadToken) {
            renderAll();
            updateFormDisabledState();
            setLoading(false);
        }
    }
}

function handleLoadError(error, tripId) {
    const errorDetail = error && error.message ? ` (${error.message})` : '';

    if (isPreviewMode) {
        clearLoadedTripData();
        setStatusWithRetry(`Unable to load preview data${errorDetail}. Check that the link is complete and the trip still exists.`, tripId);
        return;
    }

    if (applyCachedDataIfAvailable(tripId)) {
        setStatusWithRetry(`GAS load failed${errorDetail}. Showing cached data; retry when the connection is ready.`, tripId);
        return;
    }

    applyFallbackData();
    const blockedByClient = error && error.code === 'GAS_JSONP_LOAD';
    const message = blockedByClient
        ? `GAS JSONP was blocked by the browser or an extension${errorDetail}. Showing local fallback data.`
        : `Unable to load GAS data${errorDetail}. Showing local fallback data.`;
    setStatusWithRetry(message, tripId);
}

function applyLoadedData(data) {
    data = data || {};
    members = normalizeMembers(data.members || []);
    categories = normalizeCategories(data.categories || []);
    paymentMethods = normalizePaymentMethods(data.paymentMethods || data.payment_methods || []);
    exchangeRates = normalizeRates(data.exchangeRates || data.exchange_rates || exchangeRates);
    expenseReceipts = normalizeExpenseReceipts(data.expenseReceipts || data.expense_receipts || []);
    expenseParticipants = normalizeExpenseParticipants(data.expenseParticipants || data.expense_participants || []);
    expenses = normalizeExpenses(data.expenses || [], expenseReceipts, expenseParticipants);

    // 只有在 fallback 中有對應 trip 且 GAS 沒回傳資料時才使用 fallback
    if (!isPreviewMode && (!members.length || !categories.length || !paymentMethods.length) && fallbackDataByTrip[currentTripId]) {
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
