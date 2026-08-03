import {Platform} from 'react-native';

/**
 * Cấu hình tích hợp app-to-app AMIS ↔ AILearning.
 *
 * ⚠️ FILE DUY NHẤT cần sửa khi MISA / BE VNR cung cấp thêm thông tin — mọi file
 * khác đọc từ đây. Chưa điền thì tính năng tự ngủ, app chạy như cũ.
 *
 * Tài liệu: docs/spec-deeplink-amis-gui-misa.md §9 ·
 *           docs/tasks-tich-hop-amis-app-to-app.md
 */

/* ── 1. ĐỊNH DANH APP AMIS (MISA cấp, bản production) ─────────────────────────
 * Hai nền tảng dùng hai cơ chế khác nhau: iOS custom scheme, Android App Link
 * https + package name. Android không dò được bằng `canOpenURL` (trình duyệt
 * cũng nhận link https nên luôn `true`) ⇒ phải hỏi `PackageManager`, xem
 * amisNative.js ← AmisDetectModule.kt
 * ─────────────────────────────────────────────────────────────────────────── */

export const AMIS_APP = {
    // KHÔNG kèm '://'. Phải khớp `LSApplicationQueriesSchemes` ở Info.plist.
    scheme: 'misa.amis.vn',
    schemeTest: '',

    // Android mở bằng Intent tới link https này thay vì scheme.
    androidUrl: 'https://misajsc.amis.vn',

    // ⚠️ Phải khớp <queries><package> trong AndroidManifest.xml, nếu không
    // getPackageInfo() luôn báo "chưa cài" dù máy có AMIS.
    androidPackage: 'vn.com.misa.amis',

    // Giá trị nhận diện bên gọi, do VNR quy định.
    source: 'ailearning',

    /**
     * Đường dẫn nút "Quay về AMIS". ⚠️ Hai nền tảng KHÁC NHAU:
     *   iOS     -> misa.amis.vn://           (màn mặc định của AMIS)
     *   Android -> https://misajsc.amis.vn/lms  (phải trúng '/lms' mới khớp App Link)
     */
    returnPath: {ios: '', android: 'lms'},

    // Chuỗi MISA chốt không có query. Cơ chế vẫn còn, cần thì điền lại.
    returnParams: {},
};

/**
 * Kết quả dò app AMIS. `UNKNOWN` là trạng thái riêng, không gộp vào `NO`: bản
 * build Android chưa có module native thì không dò được — lúc đó phải hiện nút
 * cho người dùng bấm, chứ không được kết luận là máy không có AMIS.
 */
export const AMIS_DETECT = {
    YES: 'yes',
    NO: 'no',
    UNKNOWN: 'unknown', // không kiểm tra được
};

/* ── 2. DEEP LINK LMS → AMIS XIN QUYỀN (đã chốt) ──────────────────────────────
 *   iOS     -> misa.amis.vn://lms?source=ailearning
 *   Android -> https://misajsc.amis.vn/lms?source=ailearning
 *
 * KHÔNG truyền gì khác. Không có `state` ⇒ bước đối chiếu callback tự tắt
 * (useAmisLogin chỉ đòi khi `params.state` khác rỗng), tức mất lớp chống
 * callback lặp/giả mạo. Cần bật lại thì điền `state: 'state'`, không sửa code.
 * ─────────────────────────────────────────────────────────────────────────── */

export const AMIS_GETTOKEN = {
    path: 'lms',

    // Tên tham số gửi sang AMIS. Đặt '' để KHÔNG gửi tham số đó.
    params: {
        source: 'source', // giá trị lấy từ AMIS_APP.source — thứ duy nhất được gửi
        redirectUri: '', // ⛔ MISA không nhận
        state: '', // ⛔ MISA không nhận
        clientId: '', // ⛔ MISA không nhận
        lang: '', // ⛔ MISA không nhận
    },

    clientId: '',
};

/* ── 3. CALLBACK AMIS → LMS (VNR định nghĩa, đã gửi MISA) ─────────────────────
 *   vnrlms://applms/amis-callback?tenantid=<...>&userid=<...>&sid=<...>
 *
 * Thứ tự tham số không quan trọng, tên đọc không phân biệt hoa thường. Thiếu
 * `tenantid` là hỏng — đó là khoá duy nhất để hỏi trang QL ra URL site LMS.
 *
 * ⚠️ KHÔNG khai path này vào `linking.config` của React Navigation: pattern
 * `home/:url` không hợp với link có query, sẽ nuốt mất tham số. Link callback
 * bắt bằng `Linking` thô — xem amisAuth.js#parseAmisLink.
 * ─────────────────────────────────────────────────────────────────────────── */

export const AMIS_CALLBACK = {
    scheme: 'vnrlms',
    host: 'applms',
    path: 'amis-callback',

    // MISA chốt: chỉ trả `sid` + `tenantid` + `userid`. `tokenKey` giữ lại phòng
    // sau này có, hiện luôn rỗng — không nhánh nào phụ thuộc vào nó.
    params: {
        tokenKey: 'token',
        sid: 'sid',
        tenantId: 'tenantid',
        userId: 'userid',
        lang: 'lang',
        state: 'state',
        error: 'error',
        // ⏳ HỨNG TRƯỚC — AMIS chưa gửi tham số này. Có hay không đều chạy bình
        // thường: vắng mặt ⇒ '' ⇒ mọi nhánh y như hôm nay.
        rejected: 'rejected',
    },

    // Giá trị `error` nghĩa là người dùng bấm "Từ chối" ở popup cấp quyền AMIS.
    deniedValue: 'access_denied',

    // Giá trị của `rejected` được coi là "người dùng đã từ chối". Đọc không phân
    // biệt hoa thường. Nhận thêm '1' phòng AMIS gửi kiểu số.
    //
    // ⚠️ Chỉ đúng những giá trị này mới tính là từ chối — `rejected=false` phải
    // đi tiếp như bình thường.
    rejectedValues: ['true', '1'],
};

/* ── 4. ENDPOINT TRANG QUẢN LÝ VNR (T0.4 — đã có) ─────────────────────────────
 * App gửi `tenantid` sang, nhận về thông tin tenant — quan trọng nhất là URL
 * site LMS để nạp WebView. `tenantid` là KHOÁ TRA CỨU.
 *
 * GET https://lmsadminapi.vnresource.vn/api/Tenant/GetByTenantId/<tenantid>
 * {"IsSuccess":true,"Message":"Success","Data":{…,"Code":"<tenantid>","Link":"https://…"}}
 *
 * ⚠️ Không tìm thấy tenant thì API vẫn trả **HTTP 200**, chỉ đổi
 * `IsSuccess:false` + `Message:"TenantNotFound"` + `Data:null`. Đừng trông vào
 * mã HTTP — 404 chỉ xảy ra khi URL thiếu hẳn tenantid.
 * ─────────────────────────────────────────────────────────────────────────── */

export const VNR_TENANT_LOOKUP = {
    // `{tenantid}` / `{sid}` / `{userid}` được thay bằng giá trị thật (đã encode).
    url: 'https://lmsadminapi.vnresource.vn/api/Tenant/GetByTenantId/{tenantid}',
    method: 'GET',
    timeoutMs: 15000,

    // Tên field GỬI ĐI — chỉ dùng cho method có body (POST/PUT). Endpoint hiện
    // tại là GET nên bỏ qua toàn bộ khối này.
    request: {
        tenantId: 'tenantid',
        sid: 'sid',
        userId: 'userid',
        tokenKey: 'tokenkey',
    },

    /**
     * Tên field ĐỌC VỀ, hỗ trợ đường dẫn lồng bằng dấu chấm (`Data.Link`).
     * Đặt '' cho field API không trả — lúc đó app dùng giá trị từ deep link.
     *
     * `success` phải khai vì API báo lỗi trong thân JSON chứ không bằng mã HTTP;
     * và vì `Message` mang giá trị "Success" lúc thành công, nên chỉ được đọc nó
     * như lỗi SAU KHI `IsSuccess` đã false.
     */
    response: {
        success: 'IsSuccess',
        error: 'Message',
        link: 'Data.Link', // wwwroot site LMS, app tự ghép '/auth/saas/index.php'
        tenantId: 'Data.Code',
        sid: '', // API không trả — lấy `sid` từ deep link
        lang: '',
    },
};

/* ── 5. MOCK — chạy trọn luồng khi chưa có endpoint thật ──────────────────────
 * Bật thì `lookupTenant()` không gọi mạng. Tự khoá ở release bằng `__DEV__` để
 * dữ liệu giả không lọt lên production.
 * ─────────────────────────────────────────────────────────────────────────── */

export const AMIS_MOCK = {
    enabled: typeof __DEV__ !== 'undefined' && __DEV__,
    delayMs: 800,

    // Đổi thành một mã ở LOOKUP_ERROR để thử nhánh lỗi, '' là nhánh thành công.
    failWith: '',

    /**
     * Bộ dữ liệu thật đang dùng để chạy thử (site cài ở GỐC domain).
     * `sid`/`tenantid` chỉ là đường lùi: `mockLookup()` ưu tiên giá trị AMIS vừa
     * gửi sang, nên sửa tham số trong deep link lúc test là thấy nó chảy qua
     * đúng cả luồng.
     */
    response: {
        link: 'https://elearning.vnresource.net',
        sid: '20e7e8d1bba74635ac637552b27452ec0758a2aee8164e59a0b24be58db6224c',
        tenantid: '20e7e8d1-bba7-4635-ac63-7552b27452ec',
        lang: 'vi',
    },
};

/* ── 5b. GỠ LỖI: Alert liệt kê tham số callback (đang TẮT) ────────────────────
 * Bật cả hai cờ khi cần soi AMIS gửi về cái gì — Alert đứng trước mọi nhánh
 * kiểm tra nên thấy được cả ca gửi rỗng / sai tên tham số / báo từ chối.
 *
 * ⚠️ Cố tình KHÔNG khoá bằng `__DEV__` (cần bật được trên bản build ký thật gửi
 * MISA test) ⇒ bật rồi thì PHẢI NHỚ TẮT trước khi phát hành.
 * ─────────────────────────────────────────────────────────────────────────── */

export const AMIS_DEBUG = {
    alertCallbackParams: false,

    // Đóng Alert là dừng, không đi tiếp bước gọi trang QL / mock.
    stopAfterAlert: false,
};

/* ── 6. THỜI GIAN & KHOÁ LƯU TRỮ ─────────────────────────────────────────── */

export const AMIS_TIMING = {
    // `state` sống bao lâu thì hết hiệu lực.
    stateTtlMs: 5 * 60 * 1000,

    // Lưới đỡ cuối khi người dùng ở lì bên AMIS rất lâu; ca thường gặp (quay về
    // LMS) do `returnGraceMs` bắt trước.
    callbackTimeoutMs: 60 * 1000,

    // Quay lại app mà vẫn đang chờ ⇒ đã rời AMIS không xác nhận. Đệm ngắn phòng
    // callback và sự kiện "app active" về sát nhau, lệch thứ tự: cả hai nền tảng
    // đều bắn deep link TRƯỚC khi app active, nên không cần dài.
    returnGraceMs: 1200,
};

// ⚠️ KHÔNG lưu `sid` — nó dùng một lần.
export const AMIS_KEYS = {
    state: 'amis_auth_state',
    stateAt: 'amis_auth_ts',
    tenantId: 'amis_tenantid',

    // Đã tự động bay sang AMIS lần nào chưa. MỘT LẦN cho mỗi lần cài app, không
    // quan tâm kết quả — xem amisLaunchFlow.js#decideLaunchAction.
    // ⚠️ Cố ý KHÔNG nằm trong danh sách xoá của `clearAmisSession`: cờ này thuộc
    // về bản cài, không thuộc về phiên. Xoá theo lúc đăng xuất là mỗi lần đăng
    // xuất lại bị đá sang AMIS một lần nữa.
    autoLaunched: 'amis_auto_launched',
};

/* ── 7. MÃ LỖI — dùng làm hậu tố khoá i18n (`amis.errorTimeout`, …) ───────── */

export const LOOKUP_ERROR = {
    CONFIG: 'config', // chưa điền cấu hình ở file này
    DENIED: 'denied', // người dùng bấm "Từ chối" ở popup cấp quyền AMIS
    CANCELLED: 'cancelled', // quay lại LMS mà chưa xác nhận gì bên AMIS
    STATE: 'state', // callback không khớp `state`
    TIMEOUT: 'timeout', // ở lì bên AMIS quá lâu, không thấy callback
    EXPIRED: 'expired', // phiên hết hạn
    // Trang QL không có tenant, hoặc có mà không có link site LMS.
    // ⚠️ Ca NGHIỆP VỤ chứ không phải sự cố: đơn vị chưa mở Elearning.
    NOTFOUND: 'notfound',
    NETWORK: 'network', // không gọi được trang QL
    UNKNOWN: 'unknown',
};

/** Khoá i18n của một mã lỗi. `'notfound'` → `'amis.errorNotfound'`. */
export function errorMessageKey(errorCode) {
    if (!errorCode) {
        return '';
    }
    return (
        'amis.error' + errorCode.charAt(0).toUpperCase() + errorCode.slice(1)
    );
}

/**
 * Lỗi chỉ báo bằng Alert rồi thả về màn Welcome, không để lại hộp lỗi.
 *
 * `notfound`: AMIS đã cấp quyền xong nhưng LMS không có link cho đơn vị đó —
 * app hết việc làm được, không có gì để thử lại cũng không có gì để chờ.
 */
export const ALERT_ONLY_ERRORS = [LOOKUP_ERROR.NOTFOUND];

export function isAlertOnlyError(errorCode) {
    return Boolean(errorCode) && ALERT_ONLY_ERRORS.indexOf(errorCode) > -1;
}

/**
 * Lỗi mà bấm "Thử lại" không thể đổi kết quả ⇒ ẩn nút Thử lại.
 *
 * `config` là app chưa cấu hình xong — việc của người phát hành. `notfound`
 * thực tế đi đường Alert ở trên nên không tới hộp lỗi; giữ ở đây làm lưới đỡ.
 * Các mã còn lại đều có lý do để thử lại nên vẫn hiện nút.
 */
export const NO_RETRY_ERRORS = [LOOKUP_ERROR.NOTFOUND, LOOKUP_ERROR.CONFIG];

export function canRetryAfter(errorCode) {
    if (!errorCode) {
        return false;
    }
    return NO_RETRY_ERRORS.indexOf(errorCode) === -1;
}

/* ── 8. HÀM TIỆN ÍCH — tránh mỗi nơi tự ghép chuỗi một kiểu ───────────────── */

/** Scheme AMIS trên iOS: ưu tiên prod, chưa có thì lấy bản test. */
export function getAmisScheme() {
    return AMIS_APP.scheme || AMIS_APP.schemeTest || '';
}

/** Gốc URL mở AMIS: iOS `misa.amis.vn://`, Android `https://misajsc.amis.vn`. */
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
    // Không có path vẫn phải giữ dấu '/': link https với path rỗng
    // (`https://host?x=1`) rất dễ trượt intent-filter nếu AMIS có khai
    // `android:path` / `android:pathPrefix` — mà ta không biết họ khai kiểu gì.
    return base.slice(-1) === '/' ? base : base + '/';
}

/** Đã đủ thông tin để nói chuyện với app AMIS chưa. */
export function isAmisConfigured() {
    return Boolean(getAmisBaseUrl());
}

/**
 * Nút "Đăng nhập bằng AMIS" ở màn Welcome — hiện trên CẢ HAI nền tảng, miễn là
 * máy có app AMIS (điều kiện đó do `showLoginButton` trong useAmisLogin ghép
 * thêm). KHÔNG phụ thuộc việc app đã tự bay sang AMIS hay chưa.
 *
 * Đây là lối vào duy nhất còn lại sau khi lượt tự động đã dùng hết, nên tắt nút
 * là tạo ra ngõ cụt vĩnh viễn: mở AMIS hỏng ngay lần đầu ⇒ mất luôn đường đăng
 * nhập bằng AMIS cho tới khi cài lại app.
 */
export function shouldShowAmisLoginButton() {
    return true;
}

/**
 * Đủ thông tin CẤU HÌNH để dò app AMIS chưa. Riêng Android còn cần module native
 * có trong bản build nữa — điều kiện đó do `amisAuth.isAmisInstalled()` lo, vì
 * file này cố tình không phụ thuộc tầng native.
 */
export function canDetectAmisInstalled() {
    if (Platform.OS === 'android') {
        return Boolean(AMIS_APP.androidPackage);
    }
    return Boolean(getAmisScheme());
}

/** Đường dẫn quay về AMIS của nền tảng hiện tại (xem AMIS_APP.returnPath). */
export function getAmisReturnPath() {
    const paths = AMIS_APP.returnPath || {};
    return (Platform.OS === 'android' ? paths.android : paths.ios) || '';
}

/**
 * URL nút "Quay về AMIS": iOS `misa.amis.vn://`, Android
 * `https://misajsc.amis.vn/lms`. Trả '' khi chưa cấu hình ⇒ nút tự ẩn, không
 * hiện nút bấm vào không có gì xảy ra.
 */
export function getAmisReturnUrl() {
    const base = joinAmisUrl(getAmisReturnPath());
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

/** URL callback công bố cho AMIS gọi ngược (AMIS ghép thêm query, xem mục 3). */
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
 * Cầm `tenantid` về rồi thì có chỗ nào hỏi ra URL site LMS không. Tách khỏi
 * `isAmisConfigured()` vì hai bên chặn ở hai khâu khác nhau: thiếu scheme là
 * không mở được AMIS, thiếu endpoint là mở được nhưng về rồi không biết hỏi ai.
 *
 * Cờ `alertCallbackParams` cũng tính là "có chỗ hỏi" — nhờ đó bản release chưa
 * có endpoint vẫn đi hết được vòng callback để soi tham số.
 */
export function isTenantLookupConfigured() {
    return (
        Boolean(VNR_TENANT_LOOKUP.url) ||
        AMIS_MOCK.enabled ||
        AMIS_DEBUG.alertCallbackParams
    );
}
