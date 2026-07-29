import {AMIS_DETECT, AMIS_TIMING} from './amisConfig';

/**
 * Cây quyết định lúc khởi động app: có nên tự động hỏi AMIS xin token không.
 *
 * Tách thành hàm THUẦN (không đọc storage, không gọi Linking, không dùng
 * `Date.now()`) để test được đủ nhánh mà không phải mock cả React Native.
 * Bên gọi — `useAmisLogin` — lo phần thu thập dữ liệu đầu vào.
 */

export const LAUNCH_ACTION = {
    // Có deep link ngay lúc khởi động ⇒ đi luồng deep link, tuyệt đối không đụng AMIS.
    DEEP_LINK: 'deeplink',
    // Đã có phiên/URL sẵn ⇒ đăng nhập như thường.
    EXISTING_SESSION: 'existing',
    // Về màn Welcome (nhập mã / quét QR), có thể kèm nút "Đăng nhập bằng AMIS".
    WELCOME: 'welcome',
    // Đủ điều kiện tự động mở AMIS xin token.
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
        // canAutoRequest = true,   // ⏸️ xem khối backoff bị tạm tắt ở dưới
    } = input;

    // (1) BẪY RACE CONDITION: `getInitialURL()` là bất đồng bộ. Quyết định trước
    // khi nó trả về sẽ khiến app nhảy sang AMIS ngay giữa lúc vừa được chính
    // AMIS mở bằng deep link — người dùng bị đá qua đá lại giữa hai app.
    if (initialUrl) {
        return {action: LAUNCH_ACTION.DEEP_LINK, reason: 'deep-link-khoi-dong'};
    }

    // (2) BẮT BUỘC: thiếu chốt chặn này thì người dùng đang dùng app bình thường
    // cứ mở app lên là bị đá sang AMIS.
    if (storedUrl || storedSaas) {
        return {action: LAUNCH_ACTION.EXISTING_SESSION, reason: 'da-co-phien'};
    }

    if (amisDetection === AMIS_DETECT.NO) {
        return {action: LAUNCH_ACTION.WELCOME, reason: 'khong-co-amis'};
    }

    // Android: MISA chỉ cấp App Link https nên không thể biết máy có AMIS hay
    // không. Tự động mở lúc này là canh bạc: đoán sai thì người dùng vừa cài
    // app xong đã bị ném thẳng vào trình duyệt misajsc.amis.vn mà không hiểu
    // vì sao. Nên chỉ hiện nút và để người dùng chủ động bấm.
    if (amisDetection === AMIS_DETECT.UNKNOWN) {
        return {action: LAUNCH_ACTION.WELCOME, reason: 'khong-do-duoc-amis'};
    }

    // ⏸️ (3) TẠM TẮT THEO YÊU CẦU — backoff chống ping-pong giữa hai app.
    //
    // Giai đoạn vừa làm vừa test: thất bại một lần rồi phải chờ 24h mới được
    // tự động thử lại là quá vướng. Tắt đi thì cứ mở app là chạy lại từ đầu.
    //
    // ⚠️ BẬT LẠI TRƯỚC KHI PHÁT HÀNH. Thiếu chốt này thì: xin token thất bại →
    // người dùng mở lại app → gửi tiếp → thất bại → ... ping-pong vô hạn giữa
    // AMIS và LMS, người dùng không thoát ra được.
    //
    // Hạ tầng vẫn còn nguyên, bật lại chỉ cần bỏ comment 3 chỗ:
    //   1. khối dưới đây
    //   2. `canAutoRequest` ở phần destructure đầu hàm + trong @param
    //   3. lời gọi `shouldAutoRequestToken()` trong useAmisLogin.js
    // (`requestTokenKey` vẫn đang ghi mốc thời gian `amis_gettoken_attempted_at`
    //  nên dữ liệu đã sẵn sàng, không mất gì.)
    //
    // if (!canAutoRequest) {
    //     return {action: LAUNCH_ACTION.WELCOME, reason: 'vua-thu-that-bai'};
    // }

    return {action: LAUNCH_ACTION.REQUEST_TOKEN, reason: 'du-dieu-kien'};
}

/**
 * Đang chờ callback mà quá hạn chưa thấy gì.
 * Lưới đỡ cuối cho trường hợp người dùng ở lì bên AMIS rất lâu; trường hợp
 * thường gặp (rời AMIS quay về LMS) do `isReturnWithoutCallback` bắt trước.
 */
export function isCallbackTimedOut(startedAt, now) {
    if (!startedAt) {
        return false;
    }
    return now - startedAt > AMIS_TIMING.callbackTimeoutMs;
}
