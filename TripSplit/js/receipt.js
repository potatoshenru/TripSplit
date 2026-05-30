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

function removeReceiptFileAt(index) {
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
