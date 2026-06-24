/* TripSplit module split from assets/app.js. Keep classic script order in HTML. */
async function postToGas(action, payload = {}, options = {}) {
    if (isPreviewMode && !READONLY_GAS_ACTIONS.has(action)) throwReadonlyPreviewAction(action);

    const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(3000, options.timeoutMs) : 12000;

    let lastError = null;
    for (let index = 0; index < GAS_WEB_APP_URLS.length; index += 1) {
        const endpoint = GAS_WEB_APP_URLS[index];
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
            await fetch(endpoint, {
                method: 'POST',
                mode: 'no-cors',
                redirect: 'follow',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action, payload }),
                signal: controller.signal
            });
            clearTimeout(timeout);
            return { ok: true };
        } catch (error) {
            clearTimeout(timeout);
            lastError = error;
            console.warn(`POST 到 GAS 失敗，切換 URL：${endpoint}`, error);
        }
    }

    throw lastError || new Error('GAS POST 失敗，無可用 URL。');
}

async function jsonp(action, payload = {}, options = {}) {
    if (isPreviewMode && !READONLY_GAS_ACTIONS.has(action)) throwReadonlyPreviewAction(action);

    const maxRetries = Number.isFinite(options.maxRetries) ? Math.max(0, options.maxRetries) : 1;
    const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(3000, options.timeoutMs) : 15000;

    const runOnEndpoint = (baseUrl, endpointIndex) => new Promise((resolve, reject) => {
        let attempt = 0;

        const send = () => {
            attempt += 1;

            const callbackName =
                `tripsplitCallback_${Date.now()}_${Math.floor(Math.random() * 100000)}_${endpointIndex}_${attempt}`;

            const script = document.createElement('script');
            let settled = false;

            const cleanup = () => {
                clearTimeout(timeout);
                delete window[callbackName];
                script.remove();
            };

            const retryOrReject = (error) => {
                cleanup();

                if (attempt <= maxRetries) {
                    setTimeout(send, 300 * attempt);
                    return;
                }

                reject(error);
            };

            const timeout = setTimeout(() => {
                if (settled) return;
                settled = true;
                retryOrReject(new Error('GAS JSONP 讀取逾時'));
            }, timeoutMs);

            window[callbackName] = (response) => {
                if (settled) return;
                settled = true;
                cleanup();

                if (!response || response.ok === false) {
                    reject(new Error(response && response.error ? response.error : 'GAS 回傳錯誤'));
                    return;
                }

                resolve(response.data);
            };

            const query = new URLSearchParams({
                action,
                payload: JSON.stringify(payload || {}),
                callback: callbackName,
                _: String(Date.now())
            });

            script.src = buildGasUrl(baseUrl, query);

            script.onerror = () => {
                if (settled) return;
                settled = true;
                const error = new Error(`無法載入 GAS JSONP：${baseUrl}`);
                error.code = 'GAS_JSONP_LOAD';
                retryOrReject(error);
            };

            (document.head || document.body || document.documentElement).appendChild(script);
        };

        send();
    });

    let lastError = null;

    for (let endpointIndex = 0; endpointIndex < GAS_WEB_APP_URLS.length; endpointIndex += 1) {
        const endpoint = GAS_WEB_APP_URLS[endpointIndex];

        try {
            return await runOnEndpoint(endpoint, endpointIndex);
        } catch (error) {
            lastError = error;
            console.warn('JSONP 失敗：', error);
        }
    }

    throw lastError || new Error('無可用的 GAS JSONP URL');
}

async function requestGasJson(action, payload = {}, options = {}) {
    if (isPreviewMode && !READONLY_GAS_ACTIONS.has(action)) throwReadonlyPreviewAction(action);

    const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(3000, options.timeoutMs) : 15000;

    let lastError = null;

    for (let index = 0; index < GAS_WEB_APP_URLS.length; index += 1) {
        const endpoint = GAS_WEB_APP_URLS[index];
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                redirect: 'follow',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8'
                },
                body: JSON.stringify({
                    action,
                    payload: payload || {}
                }),
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (!response.ok) {
                const error = new Error(`GAS HTTP error: ${response.status}`);
                error.code = 'GAS_JSON_HTTP';
                throw error;
            }

            const result = await response.json();

            if (!result || result.ok === false) {
                const error = new Error(result && result.error ? result.error : 'GAS returned an error');
                error.code = 'GAS_JSON_RESPONSE';
                throw error;
            }

            return result.data;

        } catch (error) {
            clearTimeout(timeout);
            lastError = error;
            console.warn(`GAS JSON API failed, switching URL: ${endpoint}`, error);
        }
    }

    throw lastError || new Error('No available GAS JSON API URL');
}

async function requestGas(action, payload = {}, options = {}) {
    try {
        return await requestGasJson(action, payload, options);
    } catch (error) {
        console.warn('JSON API failed, falling back to JSONP.', error);
        try {
            return await jsonp(action, payload, options);
        } catch (fallbackError) {
            const combinedError = new Error(
                `JSON API failed: ${error.message || error}; JSONP fallback failed: ${fallbackError.message || fallbackError}`
            );
            combinedError.code = 'GAS_REQUEST_FAILED';
            combinedError.jsonError = error;
            combinedError.jsonpError = fallbackError;
            throw combinedError;
        }
    }
}

async function postToGasBlind(action, payload = {}, options = {}) {
    if (isPreviewMode && !READONLY_GAS_ACTIONS.has(action)) throwReadonlyPreviewAction(action);

    const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(5000, options.timeoutMs) : 30000;
    const endpoint = GAS_WEB_APP_URLS[0];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        await fetch(endpoint, {
            method: 'POST',
            mode: 'no-cors',
            redirect: 'follow',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify({ action, payload }),
            signal: controller.signal
        });

        return { ok: true };

    } finally {
        clearTimeout(timeout);
    }
}
