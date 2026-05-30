const ROC_DATE_INPUT_SELECTORS = ['#expense-date', '#expense-date-quick', '#expense-filter-from', '#expense-filter-to'];
let activeRocDateInput = null;
let rocDatePickerViewDate = null;

function padDatePart(value) {
    return String(value).padStart(2, '0');
}

function toIsoDate(year, month, day) {
    return `${year}-${padDatePart(month)}-${padDatePart(day)}`;
}

function getLocalTodayIso() {
    const today = new Date();
    return toIsoDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
}

function parseIsoDate(value) {
    const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return { year, month, day, date };
}

function parseRocDate(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const normalized = raw
        .replace(/^民國\s*/i, '')
        .replace(/^roc\s*/i, '')
        .replace(/[年月.]/g, '/')
        .replace(/日/g, '')
        .replace(/-/g, '/')
        .replace(/\s+/g, '');
    const parts = normalized.split('/').filter(Boolean);
    if (parts.length !== 3) return '';

    const yearValue = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    if (!Number.isFinite(yearValue) || !Number.isFinite(month) || !Number.isFinite(day)) return '';

    const year = yearValue < 1000 ? yearValue + 1911 : yearValue;
    return parseIsoDate(toIsoDate(year, month, day)) ? toIsoDate(year, month, day) : '';
}

function formatRocDate(isoDate) {
    const parsed = parseIsoDate(isoDate);
    if (!parsed) return '';
    return `${parsed.year - 1911}/${padDatePart(parsed.month)}/${padDatePart(parsed.day)}`;
}

function syncRocDateDisplay(input) {
    if (!input) return;
    const display = input._rocDisplayInput;
    if (!display) return;
    display.value = formatRocDate(input.value);
}

function setRocDateValue(input, value, options = {}) {
    if (!input) return;
    const isoDate = parseIsoDate(value) ? value : parseRocDate(value);
    input.value = isoDate || '';
    syncRocDateDisplay(input);
    if (options.dispatchChange) input.dispatchEvent(new Event('change', { bubbles: true }));
}

function getRocDatePickerElement() {
    let picker = document.querySelector('.roc-date-picker');
    if (picker) return picker;

    picker = document.createElement('div');
    picker.className = 'roc-date-picker';
    picker.setAttribute('role', 'dialog');
    picker.setAttribute('aria-label', '民國日期選擇');
    document.body.appendChild(picker);
    return picker;
}

function closeRocDatePicker() {
    const picker = document.querySelector('.roc-date-picker');
    if (picker) picker.classList.remove('show');
    activeRocDateInput = null;
}

function positionRocDatePicker(anchor) {
    const picker = getRocDatePickerElement();
    const rect = anchor.getBoundingClientRect();
    const pickerWidth = Math.min(300, window.innerWidth - 24);
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - pickerWidth - 12);
    picker.style.width = `${pickerWidth}px`;
    picker.style.left = `${left}px`;
    picker.style.top = `${Math.min(rect.bottom + 8, window.innerHeight - 20)}px`;
}

function renderRocDatePicker() {
    if (!activeRocDateInput || !rocDatePickerViewDate) return;

    const picker = getRocDatePickerElement();
    const year = rocDatePickerViewDate.getFullYear();
    const month = rocDatePickerViewDate.getMonth();
    const selected = parseIsoDate(activeRocDateInput.value);
    const todayIso = getLocalTodayIso();
    const start = new Date(year, month, 1);
    start.setDate(start.getDate() - start.getDay());

    const cells = [];
    for (let index = 0; index < 42; index += 1) {
        const cellDate = new Date(start);
        cellDate.setDate(start.getDate() + index);
        const isoDate = toIsoDate(cellDate.getFullYear(), cellDate.getMonth() + 1, cellDate.getDate());
        const isOtherMonth = cellDate.getMonth() !== month;
        const isSelected = selected && selected.year === cellDate.getFullYear() && selected.month === cellDate.getMonth() + 1 && selected.day === cellDate.getDate();
        cells.push(`
            <button class="roc-date-day${isOtherMonth ? ' muted' : ''}${isSelected ? ' selected' : ''}${isoDate === todayIso ? ' today' : ''}" type="button" data-roc-date="${isoDate}">
                ${cellDate.getDate()}
            </button>
        `);
    }

    picker.innerHTML = `
        <div class="roc-date-picker-head">
            <button class="roc-date-nav" type="button" data-roc-date-prev aria-label="上個月">‹</button>
            <strong>民國${year - 1911}年${padDatePart(month + 1)}月</strong>
            <button class="roc-date-nav" type="button" data-roc-date-next aria-label="下個月">›</button>
        </div>
        <div class="roc-date-weekdays" aria-hidden="true">
            <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
        </div>
        <div class="roc-date-grid">${cells.join('')}</div>
        <div class="roc-date-actions">
            <button type="button" data-roc-date-clear>清除</button>
            <button type="button" data-roc-date-today>今天</button>
        </div>
    `;
    picker.classList.add('show');
    positionRocDatePicker(activeRocDateInput._rocControl || activeRocDateInput._rocDisplayInput);
}

function openRocDatePicker(input) {
    if (!input) return;
    activeRocDateInput = input;
    const parsed = parseIsoDate(input.value) || parseIsoDate(getLocalTodayIso());
    rocDatePickerViewDate = new Date(parsed.year, parsed.month - 1, 1);
    renderRocDatePicker();
}

function enhanceRocDateInputs() {
    ROC_DATE_INPUT_SELECTORS.forEach((selector) => {
        const input = $(selector);
        if (!input || input.dataset.rocEnhanced === 'true') return;

        input.dataset.rocEnhanced = 'true';
        input.type = 'hidden';

        const control = document.createElement('div');
        control.className = 'roc-date-control';

        const display = document.createElement('input');
        display.type = 'text';
        display.className = 'roc-date-display';
        display.placeholder = formatRocDate(getLocalTodayIso());
        display.inputMode = 'numeric';
        display.autocomplete = 'off';
        display.setAttribute('aria-label', '民國日期');

        const button = document.createElement('button');
        button.className = 'roc-date-button';
        button.type = 'button';
        button.setAttribute('aria-label', '開啟民國日期選擇');

        control.append(display, button);
        input.insertAdjacentElement('afterend', control);

        input._rocControl = control;
        input._rocDisplayInput = display;
        syncRocDateDisplay(input);

        display.addEventListener('focus', () => openRocDatePicker(input));
        display.addEventListener('click', () => openRocDatePicker(input));
        display.addEventListener('change', () => setRocDateValue(input, display.value, { dispatchChange: true }));
        display.addEventListener('blur', () => {
            window.setTimeout(() => {
                if (!document.querySelector('.roc-date-picker:hover')) setRocDateValue(input, display.value, { dispatchChange: true });
            }, 120);
        });
        button.addEventListener('click', () => {
            display.focus();
            openRocDatePicker(input);
        });
        input.addEventListener('change', () => syncRocDateDisplay(input));
    });

    document.addEventListener('click', (event) => {
        const target = event.target;
        if (target.closest('.roc-date-picker') || target.closest('.roc-date-control')) return;
        closeRocDatePicker();
    });

    getRocDatePickerElement().addEventListener('click', (event) => {
        const prev = event.target.closest('[data-roc-date-prev]');
        const next = event.target.closest('[data-roc-date-next]');
        const day = event.target.closest('[data-roc-date]');
        const clear = event.target.closest('[data-roc-date-clear]');
        const today = event.target.closest('[data-roc-date-today]');

        if (prev || next) {
            rocDatePickerViewDate.setMonth(rocDatePickerViewDate.getMonth() + (next ? 1 : -1));
            renderRocDatePicker();
            return;
        }

        if (day && activeRocDateInput) {
            setRocDateValue(activeRocDateInput, day.dataset.rocDate, { dispatchChange: true });
            closeRocDatePicker();
            return;
        }

        if (clear && activeRocDateInput) {
            setRocDateValue(activeRocDateInput, '', { dispatchChange: true });
            closeRocDatePicker();
            return;
        }

        if (today && activeRocDateInput) {
            setRocDateValue(activeRocDateInput, getLocalTodayIso(), { dispatchChange: true });
            closeRocDatePicker();
        }
    });

    window.addEventListener('resize', () => {
        if (activeRocDateInput) renderRocDatePicker();
    });
    window.addEventListener('scroll', () => {
        if (activeRocDateInput) positionRocDatePicker(activeRocDateInput._rocControl || activeRocDateInput._rocDisplayInput);
    }, true);
}
