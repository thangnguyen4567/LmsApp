import {Platform} from 'react-native';

/**
 * Cấu hình tích hợp app-to-app AMIS ↔ AILearning.
 *
 * ⚠️ ĐÂY LÀ FILE DUY NHẤT CẦN SỬA khi MISA và BE VNR cung cấp đủ thông tin.
 * Mọi chỗ ghi "CHỜ" đang là chỗ trống. Điền xong file này là luồng chạy thật,
 * KHÔNG phải đụng tới bất kỳ file nào khác.
 *
 * Đối chiếu tài liệu:
 * - docs/spec-deeplink-amis-gui-misa.md  §9 — bảng trao đổi định danh app
 * - docs/tasks-tich-hop-amis-app-to-app.md — Pha 0 (chốt) và Pha 2 (kịch bản A)
 * - docs/AMIS-LMS.docx — Case B: "LMS tự kiểm tra có AMIS App? nếu có thì mở App
 *   AMIS và hỏi xin cấp quyền truy cập (token)"
 *
 * Khi chưa điền, mọi thứ đều tự tắt một cách im lặng: `isAmisInstalled()` trả
 * `false`, nút "Đăng nhập bằng AMIS" không hiện, app chạy y hệt hôm nay.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * 1. ĐỊNH DANH APP AMIS — ✅ MISA ĐÃ CẤP (bảng phối hợp dòng 1, bản PRODUCTION)
 *
 * MISA trả lời hai nền tảng bằng hai cơ chế KHÁC NHAU:
 *   iOS     : custom scheme  `misa.amis.vn://`
 *   Android : App Link https `https://misajsc.amis.vn`
 *             + kiểm tra đã cài theo package name `vn.com.misa.amis`
 *
 * Android KHÔNG dò được bằng `canOpenURL` (link https thì trình duyệt cũng
 * nhận nên luôn trả `true`) ⇒ phải hỏi `PackageManager` theo package name.
 * Việc đó `Linking` của React Native không làm được, nên có thêm module native:
 *   src/services/amisNative.js  ←  android/.../com/lms/AmisDetectModule.kt
 * ──────────────────────────────────────────────────────────────────────────── */

export const AMIS_APP = {
    // iOS — URL scheme, KHÔNG kèm '://'. Phải khớp `CFBundleURLSchemes` mà app
    // AMIS khai bên họ, và khớp `LSApplicationQueriesSchemes` ta khai ở Info.plist.
    scheme: 'misa.amis.vn',
    schemeTest: '',

    // Android — MISA yêu cầu mở bằng Intent tới link https này thay vì scheme.
    androidUrl: 'https://misajsc.amis.vn',

    // Android — package name để kiểm tra máy đã cài AMIS chưa (MISA cung cấp).
    // ⚠️ Phải khớp <queries><package> trong AndroidManifest.xml, nếu không
    // getPackageInfo() luôn báo "chưa cài" dù máy có AMIS.
    androidPackage: 'vn.com.misa.amis',

    // Đường dẫn mở lại app AMIS (nút "AMIS" trong menu). Bỏ trống ⇒ mở màn mặc định.
    returnPath: '',

    // Bảng phối hợp dòng 5: "VNR tự quy định cấu trúc deeplink bắn về AMIS để
    // AMIS nhận biết được là từ VNR bắn sang".
    // ⚠️ Đã quy định là `source=ailearning` — PHẢI báo lại MISA để bên họ đọc
    // đúng tham số này, nếu không AMIS sẽ không phân biệt được nguồn gọi.
    returnParams: {source: 'ailearning'},
};

/**
 * Kết quả dò app AMIS.
 * Giữ `UNKNOWN` làm trạng thái riêng thay vì gộp vào `NO`: có những bản build
 * không dò được (Android chưa build lại kèm module native) — lúc đó phải hiện
 * nút cho người dùng bấm chứ không được kết luận là "máy không có AMIS".
 */
export const AMIS_DETECT = {
    YES: 'yes', // chắc chắn có
    NO: 'no', // chắc chắn không
    UNKNOWN: 'unknown', // không kiểm tra được
};

/* ────────────────────────────────────────────────────────────────────────────
 * 2. DEEP LINK LMS → AMIS ĐỂ XIN TOKEN — CHỜ MISA (spec §9.1 mục ⑤⑦)
 *
 * docs/AMIS-LMS.docx gợi ý dạng `amis://get-token`, nhưng tên tham số thì chưa
 * có. Giữ nguyên tên mặc định kiểu OAuth ở dưới cho tới khi MISA chốt.
 * ──────────────────────────────────────────────────────────────────────────── */

export const AMIS_GETTOKEN = {
    // Phần đứng sau '<scheme>://'. Vd 'get-token' ⇒ 'amis://get-token?...'
    path: 'get-token',

    // Tên tham số app LMS gửi sang AMIS. Đặt giá trị '' để KHÔNG gửi tham số đó.
    params: {
        redirectUri: 'redirect_uri', // nơi AMIS gọi ngược về (xem mục 3)
        state: 'state', // chuỗi ngẫu nhiên chống giả mạo callback
        clientId: 'client_id', // chỉ gửi khi `clientId` bên dưới khác rỗng
        lang: 'lang', // ngôn ngữ app LMS đang dùng, để AMIS hiện popup đúng tiếng
    },

    // Khoá định danh bên gọi, nếu AMIS yêu cầu (spec §9.1 mục ⑦).
    clientId: '',
};

/* ────────────────────────────────────────────────────────────────────────────
 * 3. CALLBACK AMIS → LMS — CHỜ MISA XÁC NHẬN TÊN THAM SỐ (spec §9.1 mục ⑥)
 *
 * Phía LMS đã sẵn sàng: intent-filter Android (scheme `vnrlms`, host `applms`)
 * và `CFBundleURLSchemes` iOS đều KHÔNG giới hạn path, nên `amis-callback` chạy
 * được ngay mà không phải sửa native.
 *
 * ⚠️ KHÔNG khai path này vào `linking.config` của React Navigation: pattern
 * `home/:url` không hợp với link có query, sẽ nuốt mất tham số. Link callback
 * được bắt bằng `Linking` thô — xem src/services/amisAuth.js#parseAmisLink.
 * ──────────────────────────────────────────────────────────────────────────── */

export const AMIS_CALLBACK = {
    scheme: 'vnrlms',
    host: 'applms',
    path: 'amis-callback',

    // Tên tham số AMIS trả về. Đọc không phân biệt hoa thường.
    // Theo docx, AMIS trả "token (output: User, SID, TenantID)" nên app nhận cả
    // token key lẫn sid/tenantid/userid — có gì dùng nấy, thiếu thì hỏi trang QL.
    params: {
        tokenKey: 'token',
        sid: 'sid',
        tenantId: 'tenantid',
        userId: 'userid',
        lang: 'lang',
        state: 'state',
        error: 'error',
    },

    // Giá trị `error` nghĩa là người dùng bấm "Từ chối" ở popup cấp quyền AMIS.
    // Phân biệt với lỗi kỹ thuật để hiện đúng thông báo, không bảo "thử lại" khi
    // chính người dùng vừa từ chối.
    deniedValue: 'access_denied',
};

/* ────────────────────────────────────────────────────────────────────────────
 * 4. ENDPOINT TRANG QUẢN LÝ VNR — CHỜ BE VNR (spec §9.2 mục 7, task T0.4)
 *
 * Luồng: AMIS đã gửi trước `token key` + `SID` + `tenantid` lên trang QL; app
 * LMS cầm `token key` sang tra ngược để lấy link site LMS của tenant.
 * ──────────────────────────────────────────────────────────────────────────── */

export const VNR_TENANT_LOOKUP = {
    // ⚠️ CHỜ BE. Vd: 'https://lmsadmin.vnresource.vn/api/app/amis/resolve'
    url: '',
    method: 'POST',
    timeoutMs: 15000,

    // Tên field app LMS GỬI ĐI.
    request: {
        tokenKey: 'tokenkey',
        tenantId: 'tenantid',
        sid: 'sid',
        userId: 'userid',
    },

    // Tên field app LMS ĐỌC VỀ. `link` là wwwroot site LMS của tenant
    // (vd 'https://misajsc.amis.vn/lms'); app tự ghép '/auth/saas/index.php'.
    response: {
        link: 'link',
        sid: 'sid',
        tenantId: 'tenantid',
        lang: 'lang',
        error: 'error',
    },
};

/* ────────────────────────────────────────────────────────────────────────────
 * 5. MOCK — chạy trọn luồng khi MISA/BE chưa có gì
 *
 * Bật mock thì `lookupTenant()` KHÔNG gọi mạng, trả thẳng dữ liệu giả sau một
 * khoảng trễ. Nhờ vậy test được đủ các nhánh UI (chờ / lỗi / vào được site)
 * ngay hôm nay.
 *
 * Tự khoá ở bản release bằng `__DEV__` để dữ liệu giả không bao giờ lọt lên
 * production dù có quên tắt.
 * ──────────────────────────────────────────────────────────────────────────── */

export const AMIS_MOCK = {
    enabled: typeof __DEV__ !== 'undefined' && __DEV__,
    delayMs: 800,

    // Đổi thành một trong các mã ở LOOKUP_ERROR (mục 7) để thử nhánh lỗi,
    // để '' là chạy nhánh thành công.
    failWith: '',

    // Dữ liệu giả trả về. `link` cố tình dùng site có sub-path '/lms' vì đó là
    // trường hợp dễ sai nhất (MISA JSC).
    response: {
        link: 'https://misajsc.amis.vn/lms',
        sid: 'MOCK_SID_KHONG_DUNG_DUOC_THAT',
        tenantid: 'T001',
        lang: 'vi',
    },
};

/* ────────────────────────────────────────────────────────────────────────────
 * 6. THỜI GIAN & KHOÁ LƯU TRỮ
 * ──────────────────────────────────────────────────────────────────────────── */

export const AMIS_TIMING = {
    // `state` sống bao lâu thì hết hiệu lực (callback về trễ hơn ⇒ từ chối).
    stateTtlMs: 5 * 60 * 1000,
    // Mở AMIS xong bao lâu không thấy callback thì coi như hỏng, thôi chờ.
    // Đây là lưới đỡ cuối cho trường hợp người dùng ở lì bên AMIS rất lâu;
    // trường hợp thường gặp (quay lại LMS) do `returnGraceMs` bắt trước.
    callbackTimeoutMs: 60 * 1000,

    // Người dùng quay lại app LMS mà vẫn đang chờ ⇒ họ đã rời AMIS mà không
    // bấm đồng ý. Chờ thêm đúng khoảng này rồi mới kết luận, để phòng trường
    // hợp callback và sự kiện "app active" về sát nhau và lệch thứ tự.
    //
    // Cả hai nền tảng đều bắn deep link TRƯỚC khi app active (iOS:
    // willEnterForeground → openURL → didBecomeActive; Android singleTask:
    // onNewIntent → onResume) nên khoảng đệm ngắn là đủ. Để dài hơn thì người
    // dùng phải nhìn spinner vô ích, ngắn quá thì rủi ro huỷ nhầm.
    returnGraceMs: 1200,
    // Thất bại rồi thì bao lâu nữa mới TỰ ĐỘNG thử lại. Không có backoff thì
    // thất bại → mở lại app → gửi tiếp → ping-pong vô hạn giữa hai app.
    // Người dùng bấm nút "Đăng nhập bằng AMIS" thì bỏ qua backoff này.
    retryBackoffMs: 24 * 60 * 60 * 1000,
};

// Khoá MMKV. ⚠️ KHÔNG lưu `sid` và `token key` — chúng dùng một lần.
export const AMIS_KEYS = {
    state: 'amis_auth_state',
    stateAt: 'amis_auth_ts',
    attemptedAt: 'amis_gettoken_attempted_at',
    tenantId: 'amis_tenantid',
};

/* ────────────────────────────────────────────────────────────────────────────
 * 7. MÃ LỖI — dùng làm hậu tố khoá i18n (`amis.errorTimeout`, …)
 * ──────────────────────────────────────────────────────────────────────────── */

export const LOOKUP_ERROR = {
    CONFIG: 'config', // chưa điền cấu hình ở file này
    DENIED: 'denied', // người dùng bấm "Từ chối" ở popup cấp quyền AMIS
    CANCELLED: 'cancelled', // quay lại LMS mà chưa xác nhận gì bên AMIS
    STATE: 'state', // callback không khớp `state` (trễ, lặp, hoặc giả mạo)
    TIMEOUT: 'timeout', // ở lì bên AMIS quá lâu, không thấy callback
    EXPIRED: 'expired', // token key hết hạn
    NOTFOUND: 'notfound', // trang QL không có bản ghi cho token key này
    NETWORK: 'network', // không gọi được trang QL
    UNKNOWN: 'unknown',
};

/* ────────────────────────────────────────────────────────────────────────────
 * 8. HÀM TIỆN ÍCH — dùng chung, tránh mỗi nơi tự ghép chuỗi một kiểu
 * ──────────────────────────────────────────────────────────────────────────── */

/** Scheme AMIS trên iOS: ưu tiên prod, chưa có thì lấy bản test. */
export function getAmisScheme() {
    return AMIS_APP.scheme || AMIS_APP.schemeTest || '';
}

/**
 * Gốc URL để mở app AMIS trên nền tảng hiện tại.
 * iOS  -> 'misa.amis.vn://'          (custom scheme)
 * khác -> 'https://misajsc.amis.vn'  (App Link, theo yêu cầu của MISA)
 */
export function getAmisBaseUrl() {
    if (Platform.OS === 'android') {
        return AMIS_APP.androidUrl || '';
    }
    const scheme = getAmisScheme();
    return scheme ? scheme + '://' : '';
}

/** Ghép path vào gốc URL AMIS, xử lý dấu '/' cho cả hai dạng gốc. */
export function joinAmisUrl(path) {
    const base = getAmisBaseUrl();
    if (!base) {
        return base;
    }
    if (path) {
        return base.slice(-1) === '/' ? base + path : base + '/' + path;
    }
    // Không có path vẫn phải giữ lại dấu '/'. Link https với path RỖNG
    // (`https://host?x=1`) rất dễ trượt intent-filter nếu app AMIS có khai
    // `android:path` / `android:pathPrefix` — mà ta không biết họ khai kiểu gì.
    // Thêm '/' thì khớp được nhiều dạng khai báo hơn, và cũng đúng chuẩn hơn.
    return base.slice(-1) === '/' ? base : base + '/';
}

/** Đã có đủ thông tin để nói chuyện với app AMIS chưa. */
export function isAmisConfigured() {
    return Boolean(getAmisBaseUrl());
}

/**
 * Đã có ĐỦ THÔNG TIN để dò app AMIS trên nền tảng này chưa.
 *
 * Chỉ nói về mặt cấu hình. Riêng Android còn cần module native có mặt trong
 * bản build nữa — điều kiện đó do `amisAuth.isAmisInstalled()` kiểm tra, vì
 * file config này cố tình không phụ thuộc vào tầng native.
 */
export function canDetectAmisInstalled() {
    if (Platform.OS === 'android') {
        return Boolean(AMIS_APP.androidPackage);
    }
    return Boolean(getAmisScheme());
}

/**
 * URL mở lại app AMIS (nút "AMIS" trong menu), kèm tham số nhận diện nguồn gọi.
 * Trả '' khi chưa cấu hình ⇒ nút tự ẩn, không hiện nút bấm vào không có gì xảy ra.
 */
export function getAmisReturnUrl() {
    const base = joinAmisUrl(AMIS_APP.returnPath || '');
    if (!base) {
        return '';
    }
    const params = AMIS_APP.returnParams || {};
    const query = Object.keys(params)
        .filter(key => params[key])
        .map(
            key =>
                encodeURIComponent(key) +
                '=' +
                encodeURIComponent(String(params[key])),
        )
        .join('&');
    if (!query) {
        return base;
    }
    return base + (base.indexOf('?') > -1 ? '&' : '?') + query;
}

/** URL callback app LMS đưa cho AMIS gọi ngược. */
export function getCallbackUrl() {
    return (
        AMIS_CALLBACK.scheme +
        '://' +
        AMIS_CALLBACK.host +
        '/' +
        AMIS_CALLBACK.path
    );
}

/**
 * Tra được token key chưa: hoặc có endpoint thật, hoặc đang bật mock.
 * Tách riêng khỏi `isAmisConfigured()` vì hai bên chặn nhau ở hai khâu khác
 * nhau — thiếu scheme là không mở được AMIS, thiếu endpoint là mở được nhưng
 * cầm token về rồi không biết hỏi ai.
 */
export function isTenantLookupConfigured() {
    return Boolean(VNR_TENANT_LOOKUP.url) || AMIS_MOCK.enabled;
}
