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
 * @returns {{action: string, reason: string}}
 */
export function decideLaunchAction(input = {}) {
    const {
        initialUrl = '',
        storedUrl = '',
        storedSaas = '',
        amisDetection = AMIS_DETECT.NO,
        // canAutoRequest = true,   // ⏸️ xem khối backoff đang tắt ở dưới
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

    // ⏸️ (3) BACKOFF ĐANG TẮT — quyết định nghiệp vụ đã chốt, không phải nợ:
    // máy trắng thông tin mà có AMIS thì mỗi lần mở app đều sang AMIS.
    //
    // Đánh đổi đã được chấp nhận: xin quyền thất bại → mở lại app → gửi tiếp.
    // Không thành bẫy chết vì rời AMIS là app thôi chờ ngay (useAmisLogin,
    // effect AppState) và rơi về Welcome, nhập mã cấu hình tay được.
    //
    // Bật lại: bỏ comment 3 chỗ — khối dưới đây, `canAutoRequest` ở phần
    // destructure, và lời gọi `shouldAutoRequestToken()` trong useAmisLogin.js.
    //
    // if (!canAutoRequest) {
    //     return {action: LAUNCH_ACTION.WELCOME, reason: 'vua-thu-that-bai'};
    // }

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
