/* TripSplit module split from assets/app.js. Keep classic script order in HTML. */
function setStatus(message, type = 'info') {
    const notice = $('#sync-status');
    if (!notice) return;
    const dotColor = type === 'error' ? 'var(--red)' : type === 'success' ? 'var(--green)' : 'var(--orange)';
    notice.classList.toggle('is-floating', type !== 'success');
    notice.innerHTML = `<span class="status-dot" style="background:${dotColor}"></span>${message}`;
}

function setLoading(isLoading) {
    document.body.classList.toggle('is-loading', Boolean(isLoading));

    const selectors = [
        ['#trip-select', isPreviewMode],
        ['#trip-switch-form button', isPreviewMode],
        ['#expense-create-form button[type="submit"]', isPreviewMode || isCurrentTripArchived()],
        ['#member-form button[type="submit"]', isPreviewMode || isCurrentTripArchived()],
        ['#category-form button[type="submit"]', isPreviewMode || isCurrentTripArchived()],
        ['#payment-form button[type="submit"]', isPreviewMode || isCurrentTripArchived()],
        ['#archive-trip-btn', isPreviewMode || isCurrentTripArchived()]
    ];

    selectors.forEach(([selector, disabledWhenIdle]) => {
        const el = $(selector);
        if (el) el.disabled = Boolean(isLoading) || Boolean(disabledWhenIdle);
    });
}

function setStatusWithRetry(message, tripId = currentTripId) {
    const notice = $('#sync-status');
    if (!notice) return;

    notice.classList.add('is-floating');
    notice.innerHTML = `
        <span class="status-dot" style="background:var(--red)"></span>
        <span>${escapeHtml(message)}</span>
        <button type="button" id="retry-load-btn" class="mini-retry">Retry</button>
    `;

    $('#retry-load-btn')?.addEventListener('click', () => {
        if (tripId && tripId !== currentTripId) {
            currentTripId = tripId;
            localStorage.setItem('tripsplit_current_trip_id', currentTripId);
            renderTripSelect();
        }
        loadCurrentTripData();
    }, { once: true });
}

function throwReadonlyPreviewAction(action = '') {
    const message = '唯讀預覽模式不能修改資料。';
    setStatus(message, 'error');
    const error = new Error(message);
    error.code = 'TRIPSPLIT_PREVIEW_READONLY';
    error.action = action;
    throw error;
}

function guardReadonlyAction(event, message = '唯讀預覽模式不能修改資料。') {
    if (!isPreviewMode) return false;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();
    setStatus(message, 'error');
    return true;
}
