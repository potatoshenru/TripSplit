/* TripSplit module split from assets/app.js. Keep classic script order in HTML. */
async function confirmAndDeleteExpense(expenseId, onConfirmed) {
    if (isPreviewMode) {
        guardReadonlyAction();
        return false;
    }

    const expense = getExpenseById(expenseId);
    if (!expense) return false;
    if (!confirm(`確定要軟刪除「${expense.title || '這筆支出'}」嗎？\n\n刪除後不會出現在支出紀錄、總額與圖表中。`)) return false;
    if (typeof onConfirmed === 'function') onConfirmed();
    await saveThenReload('deleteExpense', { trip_id: currentTripId, expense_id: expense.id }, 900);
    return true;
}

function bindTripSwitch() {
    const form = $('#trip-switch-form');
    const select = $('#trip-select');
    if (!form || !select) return;
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (isPreviewMode) {
            select.value = currentTripId;
            setStatus('唯讀預覽模式不能切換帳本。', 'error');
            return;
        }
        currentTripId = select.value;
        localStorage.setItem('tripsplit_current_trip_id', currentTripId);
        localStorage.setItem(TRIP_SELECTION_MODE_KEY, 'manual');
        await loadCurrentTripData();
    });
    select.addEventListener('change', async () => {
        if (isPreviewMode) {
            select.value = currentTripId;
            setStatus('唯讀預覽模式不能切換帳本。', 'error');
            return;
        }
        currentTripId = select.value;
        localStorage.setItem('tripsplit_current_trip_id', currentTripId);
        localStorage.setItem(TRIP_SELECTION_MODE_KEY, 'manual');
        await loadCurrentTripData();
    });
}

function bindSettingsForms() {
    const tripCreateForm = $('#trip-create-form');
    if (tripCreateForm) {
        tripCreateForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (guardReadonlyAction(event)) return;
            const input = $('#new-trip-name');
            const name = input.value.trim();
            if (!name) return;
            const newTripId = `trip_${Date.now()}`;
            input.value = '';
            trips.push({ id: newTripId, name, baseCurrency: 'TWD', updatedAt: new Date().toISOString() });
            currentTripId = newTripId;
            markTripModified(currentTripId);
            localStorage.setItem('tripsplit_current_trip_id', currentTripId);
            localStorage.setItem(TRIP_SELECTION_MODE_KEY, 'manual');
            renderAll();
            try {
                await jsonp('addTrip', { trip_id: newTripId, trip_name: name, base_currency: 'TWD', created_by: 'Dustin' });
                await loadTrips();
            } catch (error) {
                console.warn(error);
            }
            await loadCurrentTripData();
        });
    }

    const memberForm = $('#member-form');
    if (memberForm) {
        memberForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (guardReadonlyAction(event)) return;
            const input = $('#member-name');
            const name = input.value.trim();
            if (!name) return;
            input.value = '';
            await saveThenReload('addMember', { trip_id: currentTripId, member_name: name, email_or_note: '旅伴', avatar_text: name.slice(0, 1).toUpperCase() });
        });
    }

    const categoryForm = $('#category-form');
    if (categoryForm) {
        categoryForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (guardReadonlyAction(event)) return;
            const name = $('#new-category-name').value.trim();
            const icon = $('#new-category-icon').value.trim() || '🏷';
            if (!name) return;
            $('#new-category-name').value = '';
            $('#new-category-icon').value = '';
            await saveThenReload('addCategory', { trip_id: currentTripId, category_name: name, icon, note: '自訂分類' });
        });
    }

    const paymentForm = $('#payment-form');
    if (paymentForm) {
        paymentForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (guardReadonlyAction(event)) return;
            const name = $('#new-payment-name').value.trim();
            const icon = $('#new-payment-icon').value.trim() || '💳';
            if (!name) return;
            $('#new-payment-name').value = '';
            $('#new-payment-icon').value = '';
            await saveThenReload('addPaymentMethod', { trip_id: currentTripId, payment_method_name: name, icon, note: '自訂付款方式' });
        });
    }
}

function bindGlobalClicks() {
    document.addEventListener('click', async (event) => {
        const iconSelectTrigger = event.target.closest('.icon-select-trigger');
        if (iconSelectTrigger) {
            const wrapper = iconSelectTrigger.closest('.icon-select');
            const willOpen = !wrapper.classList.contains('open');
            closeIconSelects(wrapper);
            wrapper.classList.toggle('open', willOpen);
            iconSelectTrigger.setAttribute('aria-expanded', String(willOpen));
            return;
        }

        const iconSelectOption = event.target.closest('.icon-select-option');
        if (iconSelectOption) {
            const select = document.getElementById(iconSelectOption.dataset.selectTarget);
            if (select) {
                select.value = iconSelectOption.dataset.value || '';
                select.dispatchEvent(new Event('change', { bubbles: true }));
                syncIconSelect(select);
            }
            closeIconSelects();
            return;
        }

        if (!event.target.closest('.icon-select')) closeIconSelects();

        const copyPreviewLinkButton = event.target.closest('[data-copy-preview-link]');
        if (copyPreviewLinkButton) {
            const tripId = copyPreviewLinkButton.dataset.copyPreviewLink || '';
            const originalText = copyPreviewLinkButton.textContent;
            try {
                await copyTextToClipboard(buildArchivedTripPreviewUrl(tripId));
                setStatus('已複製預覽連結。', 'success');
                copyPreviewLinkButton.textContent = '已複製';
                window.setTimeout(() => {
                    copyPreviewLinkButton.textContent = originalText || '🔗 複製連結';
                }, 1600);
            } catch (error) {
                console.warn(error);
                setStatus('無法複製連結，請稍後再試。', 'error');
            }
            return;
        }

        const previewMutationTarget = event.target.closest(PREVIEW_MUTATION_SELECTOR);
        if (previewMutationTarget && guardReadonlyAction(event)) {
            openExpenseMenuId = '';
            renderExpenses();
            return;
        }

        const expenseViewModeButton = event.target.closest('[data-expense-view-mode]');
        if (expenseViewModeButton) {
            setExpenseViewMode(expenseViewModeButton.dataset.expenseViewMode || 'card');
            return;
        }

        const expenseTablePageButton = event.target.closest('[data-expense-table-page]');
        if (expenseTablePageButton && !expenseTablePageButton.disabled) {
            setExpenseTablePage(expenseTablePageButton.dataset.expenseTablePage);
            return;
        }

        const expenseTableDetailClose = event.target.closest('[data-close-expense-table-detail]');
        if (expenseTableDetailClose) {
            closeExpenseTableDetail();
            return;
        }

        const expenseTableDetailTrigger = event.target.closest('[data-open-expense-table-detail]');
        if (expenseTableDetailTrigger) {
            openExpenseTableDetail(expenseTableDetailTrigger.dataset.openExpenseTableDetail);
            return;
        }

        const balanceDetailTrigger = event.target.closest('[data-balance-detail-member]');
        if (balanceDetailTrigger) {
            openBalanceDetailModal(
                balanceDetailTrigger.dataset.balanceDetailMember || '',
                balanceDetailTrigger.dataset.balanceDetailCategory || 'balance'
            );
            return;
        }

        const expenseMenuButton = event.target.closest('[data-expense-menu]');
        if (expenseMenuButton) {
            const menuId = expenseMenuButton.dataset.expenseMenu || '';
            openExpenseMenuId = openExpenseMenuId === menuId ? '' : menuId;
            renderExpenses();
            return;
        }

        const mergedNoteToggle = event.target.closest('[data-toggle-merged-note]');
        if (mergedNoteToggle) {
            const noteKey = mergedNoteToggle.dataset.toggleMergedNote || '';
            if (expandedMergedNoteIds.has(noteKey)) expandedMergedNoteIds.delete(noteKey);
            else expandedMergedNoteIds.add(noteKey);
            if ($('#category-detail-modal')?.classList.contains('show')) openCategoryDetailModal(selectedCategory);
            else renderExpenses();
            return;
        }

        if (event.target.closest('.expense-note')) {
            return;
        }

        const expenseDetailButton = event.target.closest('[data-toggle-expense-detail]');
        const expenseCard = event.target.closest('[data-expense-card]');
        const shouldToggleCard = expenseCard && !event.target.closest('button, a, input, select, textarea, details, summary');
        if (expenseDetailButton || shouldToggleCard) {
            const expenseId = expenseDetailButton?.dataset.toggleExpenseDetail || expenseCard?.dataset.expenseCard || '';
            if (expandedExpenseIds.has(expenseId)) expandedExpenseIds.delete(expenseId);
            else expandedExpenseIds.add(expenseId);
            openExpenseMenuId = '';
            renderExpenses();
            return;
        }

        if (openExpenseMenuId && !event.target.closest('.expense-actions')) {
            openExpenseMenuId = '';
            renderExpenses();
        }

        const deleteExpenseButton = event.target.closest('[data-delete-expense]');
        if (deleteExpenseButton) {
            openExpenseMenuId = '';
            await confirmAndDeleteExpense(deleteExpenseButton.dataset.deleteExpense);
            return;
        }

        const editExpenseButton = event.target.closest('[data-edit-expense]');
        if (editExpenseButton) {
            openExpenseMenuId = '';
            openExpenseEditModal(editExpenseButton.dataset.editExpense);
            return;
        }

        const closeExpenseEditButton = event.target.closest('[data-close-expense-edit-modal]');
        if (closeExpenseEditButton) {
            closeExpenseEditModal();
            return;
        }

        const receiptButton = event.target.closest('[data-receipt-url]');
        if (receiptButton) {
            const decoded = decodeURIComponent(receiptButton.dataset.receiptUrl || '');
            openReceiptModal(decoded);
            return;
        }

        const openReceiptUploadButton = event.target.closest('[data-open-receipt-upload]');
        if (openReceiptUploadButton) {
            openExpenseMenuId = '';
            openReceiptUploadModal(openReceiptUploadButton.dataset.openReceiptUpload);
            renderExpenses();
            return;
        }

        const closeModalButton = event.target.closest('[data-close-receipt-modal]');
        if (closeModalButton) {
            closeReceiptModal();
            return;
        }

        const closeReceiptUploadButton = event.target.closest('[data-close-receipt-upload-modal]');
        if (closeReceiptUploadButton) {
            closeReceiptUploadModal();
            return;
        }

        const uploadPreviewRemoveButton = event.target.closest('[data-remove-upload-preview-index]');
        if (uploadPreviewRemoveButton) {
            removeReceiptUploadFileAt(Number(uploadPreviewRemoveButton.dataset.removeUploadPreviewIndex));
            return;
        }

        const closeImportTextButton = event.target.closest('[data-close-import-text-modal]');
        if (closeImportTextButton) {
            closeImportTextModal();
            return;
        }

        const closeBalanceDetailButton = event.target.closest('[data-close-balance-detail-modal]');
        if (closeBalanceDetailButton) {
            closeBalanceDetailModal();
            return;
        }

        const closeCategoryDetailButton = event.target.closest('[data-close-category-detail-modal]');
        if (closeCategoryDetailButton) {
            closeCategoryDetailModal();
            return;
        }

        const openChartZoomButton = event.target.closest('[data-open-chart-zoom]');
        if (openChartZoomButton && typeof openChartZoomModal === 'function') {
            openChartZoomModal(openChartZoomButton.dataset.openChartZoom || 'expense');
            return;
        }

        const closeChartZoomButton = event.target.closest('[data-close-chart-zoom]');
        if (closeChartZoomButton && typeof closeChartZoomModal === 'function') {
            closeChartZoomModal();
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
            const confirmArchive = confirm(`確定要封存「${currentTrip().name}」嗎？\n\n封存後，此旅遊將不再顯示在主要下拉選單中。`);
            if (!confirmArchive) return;

            await saveThenReload('archiveTrip', { trip_id: currentTripId });
            if (trips.length > 0) currentTripId = trips[0].id;
            else currentTripId = 'trip_default';
            localStorage.setItem('tripsplit_current_trip_id', currentTripId);
            localStorage.setItem(TRIP_SELECTION_MODE_KEY, 'auto');
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
        const payloadMap = { member: { trip_id: currentTripId, member_id: id }, category: { trip_id: currentTripId, category_id: id }, payment: { trip_id: currentTripId, payment_method_id: id } };
        if (!actionMap[type]) return;
        await saveThenReload(actionMap[type], payloadMap[type]);
    });
}

function getDashboardTabFromHash(hash = window.location.hash) {
    const normalizedHash = String(hash || '').toLowerCase();
    if (normalizedHash === '#expenses') return 'records';
    if (['#balances', '#settlements', '#expense-charts'].includes(normalizedHash)) return 'overview';
    if (isPreviewMode) return 'records';
    return 'quick';
}

function getDashboardTabTarget(tab) {
    if (tab === 'records') return '#expenses';
    if (tab === 'overview') return '#balances';
    return '#expense-form';
}

function setDashboardTab(tab, options = {}) {
    const layout = $('.work-layout');
    const contentStack = $('.content-stack');
    const expenseForm = $('#expense-form');
    const expensesPanel = $('#expenses');
    const sideStack = $('.side-stack');
    if (!layout || !contentStack || !expenseForm || !expensesPanel || !sideStack) return;

    const allowedTabs = isPreviewMode ? ['records', 'overview'] : ['quick', 'records', 'overview'];
    const activeTab = allowedTabs.includes(tab) ? tab : (isPreviewMode ? 'records' : 'quick');
    layout.dataset.activeTab = activeTab;
    contentStack.hidden = activeTab === 'overview';
    expenseForm.hidden = isPreviewMode || activeTab !== 'quick';
    expensesPanel.hidden = activeTab !== 'records';
    sideStack.hidden = activeTab !== 'overview';

    document.querySelectorAll('[data-dashboard-tab]').forEach(button => {
        const isActive = button.dataset.dashboardTab === activeTab;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-selected', String(isActive));
        if (isPreviewMode && button.dataset.dashboardTab === 'quick') {
            button.hidden = true;
            button.disabled = true;
            button.setAttribute('aria-disabled', 'true');
        }
    });

    if (options.updateHash) {
        const hash = getDashboardTabTarget(activeTab);
        if (window.location.hash !== hash) history.pushState(null, '', hash);
    }

    if (activeTab === 'overview') {
        if (typeof renderExpenseChart === 'function') renderExpenseChart();
        if (typeof renderBudgetChart === 'function') renderBudgetChart();
    }

    if (options.scroll) {
        const target = $(getDashboardTabTarget(activeTab));
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function bindDashboardTabs() {
    if (!$('.dashboard-tabs')) return;

    document.querySelectorAll('[data-dashboard-tab]').forEach(button => {
        button.addEventListener('click', () => {
            setDashboardTab(button.dataset.dashboardTab, { updateHash: true, scroll: true });
        });
    });

    document.addEventListener('click', (event) => {
        const link = event.target.closest('a[href^="#"]');
        if (!link) return;
        const tab = getDashboardTabFromHash(link.getAttribute('href'));
        const href = link.getAttribute('href');
        if (!['#expense-form', '#expenses', '#balances', '#settlements', '#expense-charts'].includes(href)) return;
        event.preventDefault();
        setDashboardTab(tab, { updateHash: true, scroll: true });
    });

    window.addEventListener('hashchange', () => {
        setDashboardTab(getDashboardTabFromHash(), { updateHash: false, scroll: false });
    });
    window.addEventListener('popstate', () => {
        setDashboardTab(getDashboardTabFromHash(), { updateHash: false, scroll: false });
    });

    setDashboardTab(getDashboardTabFromHash(), { updateHash: false, scroll: false });
}

function bindExpenseForm() {
    if (typeof renderExpenseChart === 'function') {
        document.querySelectorAll('input[name="chart_type"]').forEach(input => input.addEventListener('change', () => {
            renderExpenseChart();
            if ($('#chart-zoom-modal')?.classList.contains('show') && typeof renderZoomChart === 'function') renderZoomChart();
        }));
    }
    if (typeof renderBudgetChart === 'function') {
        document.querySelectorAll('input[name="chart_type_budget"]').forEach(input => input.addEventListener('change', () => {
            renderBudgetChart();
            if ($('#chart-zoom-modal')?.classList.contains('show') && typeof renderZoomChart === 'function') renderZoomChart();
        }));
    }
    window.addEventListener('resize', () => {
        if (typeof renderExpenseChart === 'function') renderExpenseChart();
        if (typeof renderBudgetChart === 'function') renderBudgetChart();
        if ($('#chart-zoom-modal')?.classList.contains('show') && typeof renderZoomChart === 'function') renderZoomChart();
    });
    if (typeof bindChartInteractions === 'function') bindChartInteractions();

    const amountInput = $('#amount-original');
    if (amountInput) {
        amountInput.addEventListener('input', () => {
            updateExchangePreview();
            updateImportTextSummary();
            const splitType = document.querySelector('input[name="split_type"]:checked')?.value || '平均分';
            if (splitType === '自訂金額') renderSplitConfig();
            else updateSplitSummary();
        });
    }

    $('#expense-currency')?.addEventListener('change', () => {
        updateExchangePreview();
        renderImportTextResult();
    });
    $('#participant-options')?.addEventListener('change', (event) => {
        if (event.target.matches('input[type="checkbox"]')) renderSplitConfig();
    });
    document.querySelectorAll('input[name="split_type"]').forEach(input => input.addEventListener('change', renderSplitConfig));
    $('#split-config')?.addEventListener('input', (event) => {
        if (event.target.matches('.split-input')) updateSplitSummary();
    });
    ['#receipt-files', '#receipt-camera-files'].forEach(selector => {
        $(selector)?.addEventListener('change', (event) => {
            if (isPreviewMode) {
                event.target.value = '';
                guardReadonlyAction(event);
                return;
            }
            appendReceiptFiles(event.target.files || []);
            event.target.value = '';
        });
    });
    ['#receipt-upload-files', '#receipt-upload-camera-files'].forEach(selector => {
        $(selector)?.addEventListener('change', (event) => {
            if (isPreviewMode) {
                event.target.value = '';
                guardReadonlyAction(event);
                return;
            }
            appendReceiptUploadFiles(event.target.files || []);
            event.target.value = '';
        });
    });
    $('#receipt-upload-submit')?.addEventListener('click', async (event) => {
        if (guardReadonlyAction(event)) return;
        await submitReceiptUpload();
    });

    const searchInput = $('#expense-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            expenseSearchTerm = searchInput.value || '';
            resetExpenseTableBrowsing();
            renderExpenses();
        });
    }

    const filterBindings = [
        ['#expense-date-quick', 'quickDate'],
        ['#expense-filter-category', 'category'],
        ['#expense-filter-payer', 'payer'],
        ['#expense-filter-payment', 'payment'],
        ['#expense-filter-from', 'from'],
        ['#expense-filter-to', 'to']
    ];

    filterBindings.forEach(([selector, key]) => {
        const input = $(selector);
        if (!input) return;
        input.addEventListener('change', () => {
            expenseFilters[key] = input.value || '';
            if (key === 'quickDate') {
                const fromInput = $('#expense-filter-from');
                const toInput = $('#expense-filter-to');
                if (input.value) {
                    expenseFilters.from = '';
                    expenseFilters.to = '';
                    setRocDateValue(fromInput, '');
                    setRocDateValue(toInput, '');
                }
            }
            resetExpenseTableBrowsing();
            renderExpenses();
        });
    });

    $('#expense-filter-clear')?.addEventListener('click', () => {
        expenseSearchTerm = '';
        expenseFilters = { quickDate: '', category: '', payer: '', payment: '', from: '', to: '' };
        if (searchInput) searchInput.value = '';
        filterBindings.forEach(([selector]) => {
            const input = $(selector);
            setRocDateValue(input, '');
        });
        resetExpenseTableBrowsing();
        renderExpenses();
    });

    const dateInput = $('#expense-date');
    if (dateInput && !dateInput.value) {
        setRocDateValue(dateInput, getLocalTodayIso());
    }

    $('#edit-expense-currency')?.addEventListener('change', () => {
        updateEditExchangePreview();
        renderEditSplitConfig();
    });
    $('#edit-amount-original')?.addEventListener('input', () => {
        updateEditExchangePreview();
        renderEditSplitConfig();
    });
    $('#edit-participant-options')?.addEventListener('change', (event) => {
        if (event.target.matches('input[type="checkbox"]')) renderEditSplitConfig();
    });
    $('#edit-split-config')?.addEventListener('input', (event) => {
        if (event.target.matches('.split-input')) updateEditSplitSummary();
    });
    document.querySelectorAll('input[name="edit_split_type"]').forEach(input => {
        input.addEventListener('change', () => renderEditSplitConfig());
    });
    $('#expense-edit-form')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (guardReadonlyAction(event)) return;
        const payload = buildEditExpensePayload();
        if (!payload) return;
        closeExpenseEditModal();
        await saveThenReload('updateExpense', payload, 900);
    });
    $('#expense-soft-delete-btn')?.addEventListener('click', async (event) => {
        if (guardReadonlyAction(event)) return;
        if (!activeEditingExpenseId) return;
        await confirmAndDeleteExpense(activeEditingExpenseId, closeExpenseEditModal);
    });

    const expenseForm = $('#expense-create-form');
    if (!expenseForm) return;
    expenseForm.addEventListener('reset', () => {
        window.setTimeout(() => {
            const resetCurrency = pendingExpenseResetCurrency;
            pendingExpenseResetCurrency = '';
            clearReceiptFiles();
            applyPreferredExpenseCurrency(resetCurrency || getPreferredExpenseCurrency());
            updateExchangePreview();
            renderSplitConfig();
            syncAllIconSelects();
            setRocDateValue(dateInput, getLocalTodayIso());
        }, 0);
    });
    expenseForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (guardReadonlyAction(event)) return;
        const selectedCategory = categories.find(item => String(item.id) === $('#category-id').value);
        const selectedPayment = paymentMethods.find(item => String(item.id) === $('#payment-method-id').value);
        const amount = Number($('#amount-original').value || 0);
        const currency = $('#expense-currency').value;
        const rate = Number(exchangeRates[currency] || 1);
        const split = document.querySelector('input[name="split_type"]:checked')?.value || '平均分';
        if (!$('#expense-title').value.trim() || !selectedCategory || !selectedPayment || !amount) return;

        const splitValidation = validateSplitInputs(split, amount, $('#paid-by')?.value || '');
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

        localStorage.setItem('tripsplit_last_currency', currency);
        pendingExpenseResetCurrency = currency;
        expenseForm.reset();
        applyPreferredExpenseCurrency(currency);
        clearReceiptFiles();
        setRocDateValue(dateInput, getLocalTodayIso());
        updateExchangePreview();
        renderSplitConfig();
        setDashboardTab('records', { updateHash: true, scroll: true });
    });
}

function isTextEntryTarget(target) {
    return Boolean(target?.closest?.('input, textarea, select') || target?.isContentEditable);
}

function bindKeyboard() {
    document.addEventListener('keydown', (event) => {
        const mergedNoteKeyboardToggle = event.target.closest?.('[data-toggle-merged-note]');
        if (mergedNoteKeyboardToggle && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            const noteKey = mergedNoteKeyboardToggle.dataset.toggleMergedNote || '';
            if (expandedMergedNoteIds.has(noteKey)) expandedMergedNoteIds.delete(noteKey);
            else expandedMergedNoteIds.add(noteKey);
            if ($('#category-detail-modal')?.classList.contains('show')) openCategoryDetailModal(selectedCategory);
            else renderExpenses();
            return;
        }

        const hasOpenModal = $('#expense-edit-modal')?.classList.contains('show') ||
            $('#import-text-modal')?.classList.contains('show') ||
            $('#balance-detail-modal')?.classList.contains('show') ||
            $('#category-detail-modal')?.classList.contains('show') ||
            $('#receipt-upload-modal')?.classList.contains('show') ||
            $('#receipt-modal')?.classList.contains('show') ||
            $('#chart-zoom-modal')?.classList.contains('show');

        if (expenseViewMode === 'table' && !hasOpenModal && !isTextEntryTarget(event.target)) {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                const totalPages = Math.max(1, Math.ceil(getVisibleExpenses().length / EXPENSE_TABLE_PAGE_SIZE));
                if (totalPages > 1) {
                    event.preventDefault();
                    setExpenseTablePage(event.key === 'ArrowLeft' ? 'prev' : 'next');
                    return;
                }
            }

            if (event.key === 'Enter' || event.key === ' ') {
                const row = event.target.closest?.('tr[data-open-expense-table-detail]');
                if (row) {
                    event.preventDefault();
                    openExpenseTableDetail(row.dataset.openExpenseTableDetail);
                    return;
                }
            }
        }

        const balanceDetailKeyboardTrigger = event.target.closest?.('[data-balance-detail-member]');
        if (!hasOpenModal && balanceDetailKeyboardTrigger && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            openBalanceDetailModal(
                balanceDetailKeyboardTrigger.dataset.balanceDetailMember || '',
                balanceDetailKeyboardTrigger.dataset.balanceDetailCategory || 'balance'
            );
            return;
        }

        if (event.key !== 'Escape') return;
        if (activeRocDateInput) {
            closeRocDatePicker();
            return;
        }
        if (document.querySelector('.icon-select.open')) {
            closeIconSelects();
            return;
        }
        if ($('#expense-edit-modal')?.classList.contains('show')) {
            closeExpenseEditModal();
            return;
        }
        if ($('#import-text-modal')?.classList.contains('show')) {
            closeImportTextModal();
            return;
        }
        if ($('#balance-detail-modal')?.classList.contains('show')) {
            closeBalanceDetailModal();
            return;
        }
        if ($('#category-detail-modal')?.classList.contains('show')) {
            closeCategoryDetailModal();
            return;
        }
        if ($('#receipt-upload-modal')?.classList.contains('show')) {
            closeReceiptUploadModal();
            return;
        }
        if ($('#chart-zoom-modal')?.classList.contains('show') && typeof closeChartZoomModal === 'function') {
            closeChartZoomModal();
            return;
        }
        if ($('#receipt-modal')?.classList.contains('show')) closeReceiptModal();
        if (selectedExpenseTableDetailId) closeExpenseTableDetail();
    });
}

function bindAppEvents() {
    enhanceRocDateInputs();
    bindTripSwitch();
    bindSettingsForms();
    bindGlobalClicks();
    bindDashboardTabs();
    bindExpenseForm();
    bindKeyboard();
    bindImportTextModal();
}
