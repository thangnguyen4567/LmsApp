/**
 * Cấu hình từ xa (Firebase Remote Config) — đổi endpoint mà KHÔNG phải submit app.
 *
 * ⚠️ File DUY NHẤT được import `@react-native-firebase/*`. Nơi khác chỉ gọi các
 * hàm ở đây, nên thiếu module native (jest, bản build cũ) thì tính năng tự ngủ:
 * mọi getter trả '' và bên gọi dùng giá trị cố định trong amisConfig.js.
 *
 * Quản lý ở Firebase Console → dự án `lms-notification-75264` → Remote Config.
 */

// Tên parameter trên Firebase Console — phải khớp từng ký tự.
export const REMOTE_KEYS = {
    // Template URL tra tenant, dạng
    // `https://…/api/Tenant/GetByTenantId/{tenantid}`. Rỗng/sai ⇒ dùng
    // VNR_TENANT_LOOKUP.url.
    tenantLookupUrl: 'tenant_lookup_url',
};

// Giá trị lấy về được dùng lại trong bao lâu trước khi hỏi lại Firebase. Bản
// release để 10 phút: lần tải chạy nền, không chặn UI. Trong lúc chuyển endpoint,
// URL cũ vẫn phải sống song song cho các máy chưa kịp lấy giá trị mới.
const FETCH_INTERVAL_MS = __DEV__ ? 0 : 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10000;

let instance = null;
let readyPromise = null;

/** Instance Remote Config, `null` khi không có module native. */
function getInstance() {
    if (instance) {
        return instance;
    }
    try {
        const {getRemoteConfig} = require('@react-native-firebase/remote-config');
        instance = getRemoteConfig();
    } catch (_e) {
        instance = null;
    }
    return instance;
}

/**
 * Gọi một lần lúc mở app, KHÔNG chặn render. Giá trị lấy được ở lần trước vẫn
 * dùng được ngay, kể cả khi lần tải này thất bại (offline).
 */
export function initRemoteConfig() {
    if (readyPromise) {
        return readyPromise;
    }
    const rc = getInstance();
    if (!rc) {
        readyPromise = Promise.resolve(false);
        return readyPromise;
    }
    readyPromise = (async () => {
        try {
            const {fetchAndActivate, getValue} = require('@react-native-firebase/remote-config');
            rc.settings = {
                minimumFetchIntervalMillis: FETCH_INTERVAL_MS,
                fetchTimeoutMillis: FETCH_TIMEOUT_MS,
            };
            await fetchAndActivate(rc);
            if (__DEV__) {
                // 'remote' = đã lấy được từ Console. 'static' = sai tên key
                // hoặc chưa Publish.
                const value = getValue(rc, REMOTE_KEYS.tenantLookupUrl);
                console.log(
                    '[remoteConfig]',
                    REMOTE_KEYS.tenantLookupUrl,
                    value.getSource(),
                    value.asString(),
                );
            }
            return true;
        } catch (_e) {
            return false;
        }
    })();
    return readyPromise;
}

/**
 * Chờ lần tải đầu xong, tối đa `timeoutMs`. Mở app lạnh bằng callback AMIS có
 * thể tới bước tra tenant trước khi Firebase kịp trả lời.
 */
export function waitForRemoteConfig(timeoutMs = 3000) {
    if (!readyPromise) {
        return Promise.resolve(false);
    }
    return Promise.race([
        readyPromise,
        new Promise(resolve => setTimeout(() => resolve(false), timeoutMs)),
    ]);
}

/**
 * Template URL tra tenant lấy từ xa, hoặc '' nếu không có / không hợp lệ.
 *
 * Kiểm tra chặt vì URL này quyết định app nạp site LMS nào và gửi thông tin
 * đăng nhập đi đâu: chỉ nhận https và bắt buộc có `{tenantid}`.
 */
export function getRemoteTenantLookupUrl() {
    const rc = getInstance();
    if (!rc) {
        return '';
    }
    try {
        const {getValue} = require('@react-native-firebase/remote-config');
        const value = String(
            getValue(rc, REMOTE_KEYS.tenantLookupUrl).asString() || '',
        ).trim();
        return isValidLookupTemplate(value) ? value : '';
    } catch (_e) {
        return '';
    }
}

/** `https://host/...{tenantid}...` — sai một điều kiện là bỏ. */
export function isValidLookupTemplate(value) {
    if (!value || value.indexOf('{tenantid}') === -1) {
        return false;
    }
    try {
        const parsed = new URL(value.replace(/\{(tenantid|sid|userid)\}/g, 'x'));
        return parsed.protocol === 'https:' && Boolean(parsed.hostname);
    } catch (_e) {
        return false;
    }
}
