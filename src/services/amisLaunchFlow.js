import {AMIS_DETECT, AMIS_TIMING} from './amisConfig';

/**
 * Cây quyết định lúc khởi động: có nên tự động hỏi AMIS xin quyền không.
 *
 * Hàm THUẦN (không đọc storage, không gọi Linking, không dùng `Date.now()`) để
 * test được đủ nhánh. `useAmisLogin` lo phần thu thập dữ liệu đầu vào.
 */

export const LAUNCH_ACTION = {
    // Có deep link lúc khởi động ⇒ đi luồng deep link, không đụng AMIS.
    DEEP_LINK: 'deeplink',
    EXISTING_SESSION: 'existing',
    // Màn Welcome (nhập mã / quét QR), có thể kèm nút "Đăng nhập bằng AMIS".
    WELCOME: 'welcome',
    REQUEST_TOKEN: 'request-token',
};

/**
 * @param {object} input
 * @param {string} input.initialUrl     URL khởi động app (Linking.getInitialURL)
 * @param {string} input.storedUrl      khoá `url` trong MMKV
 * @param {string} input.storedSaas     khoá `saas_userdata` trong MMKV
 * @param {string} input.amisDetection  một giá trị của AMIS_DETECT
 * @param {boolean} input.autoLaunchDone đã dùng hết lượt tự mở AMIS chưa
 * @returns {{action: string, reason: string}}
 */
export function decideLaunchAction(input = {}) {
    const {
        initialUrl = '',
        storedUrl = '',
        storedSaas = '',
        amisDetection = AMIS_DETECT.NO,
        autoLaunchDone = false,
    } = input;

    // (1) `getInitialURL()` là bất đồng bộ. Quyết định trước khi nó trả về sẽ
    // khiến app nhảy sang AMIS ngay giữa lúc vừa được chính AMIS mở bằng deep
    // link — người dùng bị đá qua đá lại giữa hai app.
    if (initialUrl) {
        return {action: LAUNCH_ACTION.DEEP_LINK, reason: 'deep-link-khoi-dong'};
    }

    // (2) Thiếu chốt chặn này thì người dùng đang dùng app bình thường cứ mở
    // app lên là bị đá sang AMIS.
    if (storedUrl || storedSaas) {
        return {action: LAUNCH_ACTION.EXISTING_SESSION, reason: 'da-co-phien'};
    }

    if (amisDetection === AMIS_DETECT.NO) {
        return {action: LAUNCH_ACTION.WELCOME, reason: 'khong-co-amis'};
    }

    // Không dò được thì tự động mở là canh bạc: đoán sai thì người dùng vừa cài
    // app xong đã bị ném thẳng vào trình duyệt misajsc.amis.vn mà không hiểu vì
    // sao. Chỉ hiện nút và để họ chủ động bấm.
    if (amisDetection === AMIS_DETECT.UNKNOWN) {
        return {action: LAUNCH_ACTION.WELCOME, reason: 'khong-do-duoc-amis'};
    }

    // (3) Tự mở AMIS đúng MỘT LẦN cho mỗi lần cài app, bất kể kết quả (đồng ý,
    // từ chối, hay bỏ ngang quay về đều tính là đã dùng). Không hỏi lại nữa vì
    // người đã từ chối một lần mà mở app lần nào cũng bị đá sang AMIS thì rất
    // khó chịu.
    //
    // Không thành ngõ cụt: nút "Đăng nhập bằng AMIS" ở màn Welcome luôn hiện khi
    // máy có app AMIS (shouldShowAmisLoginButton) — đó là đường vào sau lượt này.
    // Reset chỉ bằng cách xoá dữ liệu app / cài lại.
    if (autoLaunchDone) {
        return {action: LAUNCH_ACTION.WELCOME, reason: 'da-tu-mo-mot-lan'};
    }

    return {action: LAUNCH_ACTION.REQUEST_TOKEN, reason: 'du-dieu-kien'};
}

/**
 * Đang chờ callback mà quá hạn chưa thấy gì. Lưới đỡ cuối cho trường hợp người
 * dùng ở lì bên AMIS rất lâu; ca thường gặp (quay về LMS) bị bắt trước bởi
 * `returnGraceMs` trong useAmisLogin.
 */
export function isCallbackTimedOut(startedAt, now) {
    if (!startedAt) {
        return false;
    }
    return now - startedAt > AMIS_TIMING.callbackTimeoutMs;
}
