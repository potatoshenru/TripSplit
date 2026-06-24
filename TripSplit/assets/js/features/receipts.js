/* TripSplit module split from assets/app.js. Keep classic script order in HTML. */
function extractReceiptUrlsFromRows(rows) {
    const urls = [];
    rows.forEach(row => {
        urls.push(...extractReceiptUrls(row));
        if (row.drive_file_id && !row.drive_url && !row.receipt_url && !row.image_url) {
            urls.push(`https://drive.google.com/file/d/${row.drive_file_id}/view`);
        }
    });
    return dedupeReceiptUrls(urls);
}

function dedupeReceiptUrls(urls) {
    const map = new Map();
    (urls || []).forEach((url) => {
        const value = String(url || '').trim();
        if (!value) return;
        const driveId = extractDriveFileId(value);
        const key = driveId ? `drive:${driveId}` : `url:${value}`;
        if (!map.has(key)) map.set(key, value);
    });
    return Array.from(map.values());
}

function extractReceiptUrls(row) {
    const values = [];
    const pushValue = (value) => {
        if (typeof value !== 'string') return;
        const trimmed = value.trim();
        if (!trimmed) return;
        values.push(trimmed);
    };

    pushValue(row.drive_url);
    pushValue(row.receipt_url);
    pushValue(row.image_url);

    if (Array.isArray(row.receipts)) {
        row.receipts.forEach(item => {
            if (!item) return;
            if (typeof item === 'string') {
                pushValue(item);
                return;
            }
            pushValue(item.drive_url);
            pushValue(item.receipt_url);
            pushValue(item.url);
            pushValue(item.view_url);
            pushValue(item.webViewLink);
            pushValue(item.webContentLink);
        });
    }

    const rawList = row.receipt_urls || row.drive_urls || row.image_urls;
    if (Array.isArray(rawList)) {
        rawList.forEach(pushValue);
    } else if (typeof rawList === 'string') {
        const maybeJson = rawList.trim();
        if (maybeJson.startsWith('[') && maybeJson.endsWith(']')) {
            try {
                const parsed = JSON.parse(maybeJson);
                if (Array.isArray(parsed)) parsed.forEach(pushValue);
            } catch (_) {
                maybeJson.split(',').map(item => item.trim()).forEach(pushValue);
            }
        } else {
            maybeJson.split(',').map(item => item.trim()).forEach(pushValue);
        }
    }

    return [...new Set(values)];
}

function extractDriveFileId(url) {
    const input = String(url || '');
    const fileIdMatch = input.match(/\/file\/d\/([^/?#]+)/);
    if (fileIdMatch && fileIdMatch[1]) return fileIdMatch[1];

    const idMatch = input.match(/[?&]id=([^&#]+)/);
    if (idMatch && idMatch[1]) return idMatch[1];

    return '';
}

function buildDriveImageCandidates(url) {
    const original = String(url || '').trim();
    if (!original) return [];

    const fileId = extractDriveFileId(original);
    if (!fileId) return [original];

    return [
        `https://drive.google.com/uc?export=view&id=${fileId}`,
        `https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`,
        `https://drive.usercontent.google.com/download?id=${fileId}&export=view`,
        original
    ];
}

function toDisplayImageUrl(url) {
    return buildDriveImageCandidates(url)[0] || String(url || '');
}

function handleReceiptImageError(event) {
    const image = event.target;
    const candidates = JSON.parse(image.dataset.candidates || '[]');
    const currentIndex = Number(image.dataset.candidateIndex || 0);
    const nextIndex = currentIndex + 1;

    if (nextIndex >= candidates.length) {
        image.onerror = null;
        return;
    }

    image.dataset.candidateIndex = String(nextIndex);
    image.src = candidates[nextIndex];
}

function openReceiptModal(rawUrl) {
    const modal = $('#receipt-modal');
    const image = $('#receipt-modal-image');
    const link = $('#receipt-modal-open-link');
    if (!modal || !image || !link) return;

    const originalUrl = String(rawUrl || '').trim();
    if (!originalUrl) return;

    const candidates = buildDriveImageCandidates(originalUrl);
    if (!candidates.length) return;

    image.dataset.candidates = JSON.stringify(candidates);
    image.dataset.candidateIndex = '0';
    image.onerror = handleReceiptImageError;
    image.src = candidates[0];
    image.alt = '收據照片預覽';
    link.href = originalUrl;
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeReceiptModal() {
    const modal = $('#receipt-modal');
    const image = $('#receipt-modal-image');
    const link = $('#receipt-modal-open-link');
    if (!modal || !image || !link) return;

    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    image.src = '';
    image.onerror = null;
    image.dataset.candidates = '[]';
    image.dataset.candidateIndex = '0';
    link.href = '#';
    document.body.style.overflow = '';
}

async function fileToBase64(file) {
    const compressedBlob = await compressImageFile(file, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.72
    });

    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            const result = String(reader.result || '');

            resolve({
                fileName: file.name.replace(/\.[^.]+$/, '') + '.jpg',
                mimeType: 'image/jpeg',
                base64: result.includes(',') ? result.split(',')[1] : result
            });
        };

        reader.onerror = reject;
        reader.readAsDataURL(compressedBlob);
    });
}

function compressImageFile(file, options = {}) {
    const maxWidth = options.maxWidth || 1600;
    const maxHeight = options.maxHeight || 1600;
    const quality = options.quality || 0.72;

    return new Promise((resolve, reject) => {
        const image = new Image();
        const objectUrl = URL.createObjectURL(file);

        image.onload = () => {
            URL.revokeObjectURL(objectUrl);

            let width = image.width;
            let height = image.height;

            const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const context = canvas.getContext('2d');
            context.drawImage(image, 0, 0, width, height);

            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        reject(new Error('圖片壓縮失敗'));
                        return;
                    }

                    resolve(blob);
                },
                'image/jpeg',
                quality
            );
        };

        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('圖片讀取失敗'));
        };

        image.src = objectUrl;
    });
}

function renderReceiptPreview() {
    const preview = $('#receipt-preview');
    if (!preview) return;

    preview.innerHTML = '';
    selectedReceiptFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'receipt-preview-item';

        const img = document.createElement('img');
        const objectUrl = URL.createObjectURL(file);
        img.src = objectUrl;
        img.alt = file.name;
        img.addEventListener('load', () => URL.revokeObjectURL(objectUrl), { once: true });

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'receipt-preview-remove';
        removeButton.dataset.removePreviewIndex = String(index);
        removeButton.setAttribute('aria-label', `移除 ${file.name}`);
        removeButton.textContent = '×';

        item.appendChild(img);
        item.appendChild(removeButton);
        preview.appendChild(item);
    });

    preview.style.display = selectedReceiptFiles.length ? 'flex' : 'none';
}

function appendReceiptFiles(files) {
    if (isPreviewMode) {
        guardReadonlyAction();
        return;
    }

    const imageFiles = Array.from(files || []).filter(file => file.type.startsWith('image/'));
    if (!imageFiles.length) return;

    const remain = Math.max(0, MAX_RECEIPT_FILES - selectedReceiptFiles.length);
    if (!remain) {
        alert(`最多只能上傳 ${MAX_RECEIPT_FILES} 張收據照片。`);
        return;
    }

    const accepted = imageFiles.slice(0, remain);
    selectedReceiptFiles = selectedReceiptFiles.concat(accepted);

    if (imageFiles.length > remain) {
        alert(`最多只能上傳 ${MAX_RECEIPT_FILES} 張收據照片，已保留前 ${MAX_RECEIPT_FILES} 張。`);
    }

    renderReceiptPreview();
}

function renderReceiptUploadPreview() {
    const preview = $('#receipt-upload-preview');
    const submitButton = $('#receipt-upload-submit');
    if (!preview) return;

    preview.innerHTML = '';
    selectedReceiptUploadFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'receipt-preview-item';

        const img = document.createElement('img');
        const objectUrl = URL.createObjectURL(file);
        img.src = objectUrl;
        img.alt = file.name;
        img.addEventListener('load', () => URL.revokeObjectURL(objectUrl), { once: true });

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'receipt-preview-remove';
        removeButton.dataset.removeUploadPreviewIndex = String(index);
        removeButton.setAttribute('aria-label', `移除 ${file.name}`);
        removeButton.textContent = '×';

        item.appendChild(img);
        item.appendChild(removeButton);
        preview.appendChild(item);
    });

    preview.style.display = selectedReceiptUploadFiles.length ? 'flex' : 'none';
    if (submitButton) submitButton.disabled = !selectedReceiptUploadFiles.length || !activeReceiptUploadExpenseId;
}

function appendReceiptUploadFiles(files) {
    if (isPreviewMode) {
        guardReadonlyAction();
        return;
    }

    const imageFiles = Array.from(files || []).filter(file => file.type.startsWith('image/'));
    if (!imageFiles.length) return;

    const expense = getExpenseById(activeReceiptUploadExpenseId);
    const existingCount = Array.isArray(expense?.receiptUrls) ? expense.receiptUrls.length : 0;
    const remain = Math.max(0, MAX_RECEIPT_FILES - existingCount - selectedReceiptUploadFiles.length);

    if (!remain) {
        alert(`最多只能上傳 ${MAX_RECEIPT_FILES} 張收據照片。`);
        return;
    }

    selectedReceiptUploadFiles = selectedReceiptUploadFiles.concat(imageFiles.slice(0, remain));

    if (imageFiles.length > remain) {
        alert(`最多只能上傳 ${MAX_RECEIPT_FILES} 張收據照片，已保留前 ${remain} 張。`);
    }

    renderReceiptUploadPreview();
}

function removeReceiptUploadFileAt(index) {
    if (isPreviewMode) {
        guardReadonlyAction();
        return;
    }

    if (!(index >= 0) || index >= selectedReceiptUploadFiles.length) return;
    selectedReceiptUploadFiles.splice(index, 1);
    renderReceiptUploadPreview();
}

function clearReceiptUploadFiles() {
    selectedReceiptUploadFiles = [];
    renderReceiptUploadPreview();
    if ($('#receipt-upload-files')) $('#receipt-upload-files').value = '';
    if ($('#receipt-upload-camera-files')) $('#receipt-upload-camera-files').value = '';
}

async function getReceiptUploadPayloads() {
    return Promise.all(selectedReceiptUploadFiles.slice(0, MAX_RECEIPT_FILES).map(fileToBase64));
}

function openReceiptUploadModal(expenseId) {
    if (isPreviewMode) {
        guardReadonlyAction();
        return;
    }

    const expense = getExpenseById(expenseId);
    const modal = $('#receipt-upload-modal');
    if (!expense || !modal) return;

    activeReceiptUploadExpenseId = String(expenseId || '');
    safeSetText('#receipt-upload-title', expense.title || '支出照片');
    safeSetText('#receipt-upload-count', `${(expense.receiptUrls || []).length} / ${MAX_RECEIPT_FILES}`);
    clearReceiptUploadFiles();
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeReceiptUploadModal() {
    const modal = $('#receipt-upload-modal');
    if (!modal) return;

    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    activeReceiptUploadExpenseId = '';
    clearReceiptUploadFiles();
    document.body.style.overflow = '';
}

async function submitReceiptUpload() {
    if (isPreviewMode) {
        guardReadonlyAction();
        return;
    }

    if (!activeReceiptUploadExpenseId || !selectedReceiptUploadFiles.length) return;

    const expenseId = activeReceiptUploadExpenseId;
    const receiptPayloads = await getReceiptUploadPayloads();
    closeReceiptUploadModal();
    await saveThenReload('addExpenseReceipts', {
        trip_id: currentTripId,
        expense_id: expenseId,
        receipts: receiptPayloads
    }, 4500);
}

function removeReceiptFileAt(index) {
    if (isPreviewMode) {
        guardReadonlyAction();
        return;
    }

    if (!(index >= 0) || index >= selectedReceiptFiles.length) return;
    selectedReceiptFiles.splice(index, 1);
    renderReceiptPreview();
}

function clearReceiptFiles() {
    selectedReceiptFiles = [];
    renderReceiptPreview();
    if ($('#receipt-files')) $('#receipt-files').value = '';
    if ($('#receipt-camera-files')) $('#receipt-camera-files').value = '';
}

async function getReceiptPayloads() {
    return Promise.all(selectedReceiptFiles.slice(0, MAX_RECEIPT_FILES).map(fileToBase64));
}
