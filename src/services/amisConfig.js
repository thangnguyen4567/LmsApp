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

    // Giá trị nhận diện bên gọi (bảng phối hợp dòng 5: "VNR tự quy định cấu trúc
    // deeplink bắn về AMIS để AMIS nhận biết được là từ VNR bắn sang").
    source: 'ailearning',

    /**
     * Đường dẫn mở lại app AMIS — nút "Quay về AMIS" trong menu.
     *
     * ✅ ĐÃ CHỐT VỚI MISA, và **hai nền tảng khác nhau**:
     *     iOS     -> misa.amis.vn://          (không path)
     *     Android -> https://misajsc.amis.vn/lms
     *
     * Đừng gộp thành một giá trị: bên iOS mở màn mặc định của AMIS, bên Android
     * phải trúng '/lms' mới khớp App Link của họ.
     */
    returnPath: {ios: '', android: 'lms'},

    /**
     * Tham số kèm theo link quay về.
     *
     * ✅ ĐÃ CHỐT: **rỗng**. Bản trao đổi trước có `?source=ailearning`, nhưng
     * chuỗi cuối MISA gửi lại không có query — giữ nguyên rỗng cho khớp. Để
     * trống là cơ chế vẫn còn, MISA cần thì điền lại chỗ này, không phải sửa code.
     */
    returnParams: {},
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
 * 2. DEEP LINK LMS → AMIS ĐỂ XIN QUYỀN — ✅ ĐÃ CHỐT VỚI MISA
 *
 * Chuỗi cuối cùng hai bên thống nhất:
 *     iOS     -> misa.amis.vn://lms?source=ailearning
 *     Android -> https://misajsc.amis.vn/lms?source=ailearning
 *
 * ⚠️ **KHÔNG truyền gì khác** — không `redirect_uri`, không `state`, không
 * `client_id`, không `lang`. AMIS biết đường gọi về nhờ chuỗi callback ta công
 * bố sẵn (mục 3), chứ không nhận qua tham số.
 *
 * Hệ quả của việc không có `state`:
 * - `buildGetTokenUrl` bỏ qua mọi tên tham số để rỗng ⇒ URL sạch.
 * - Bước đối chiếu `state` khi callback về **tự tắt** (useAmisLogin chỉ đòi khi
 *   `params.state` khác rỗng). Nghĩa là mất lớp chống callback lặp/giả mạo —
 *   đây là quyết định của MISA, đã ghi vào docs/tasks-… phần "Nợ".
 * - MISA cần `state` trở lại: điền `state: 'state'` là chạy lại nguyên vẹn,
 *   không phải sửa dòng code nào.
 * ──────────────────────────────────────────────────────────────────────────── */

export const AMIS_GETTOKEN = {
    // Phần đứng sau gốc URL. Cả hai nền tảng đều là 'lms'.
    path: 'lms',

    // Tên tham số app LMS gửi sang AMIS. Đặt '' để KHÔNG gửi tham số đó.
    params: {
        source: 'source', // giá trị lấy từ AMIS_APP.source — thứ DUY NHẤT được gửi
        redirectUri: '', // ⛔ MISA không nhận
        state: '', // ⛔ MISA không nhận ⇒ tắt luôn bước đối chiếu state
        clientId: '', // ⛔ MISA không nhận
        lang: '', // ⛔ MISA không nhận
    },

    // Khoá định danh bên gọi, nếu sau này AMIS yêu cầu (spec §9.1 mục ⑦).
    clientId: '',
};

/* ────────────────────────────────────────────────────────────────────────────
 * 3. CALLBACK AMIS → LMS — ✅ VNR ĐỊNH NGHĨA, ĐÃ GỬI MISA (spec §9.1 mục ⑥)
 *
 * Chuỗi chính thức AMIS gọi để trả dữ liệu về app LMS:
 *
 *     vnrlms://applms/amis-callback?tenantid=<...>&userid=<...>&sid=<...>
 *
 * Thứ tự tham số không quan trọng, tên tham số đọc KHÔNG phân biệt hoa thường.
 * Thiếu `tenantid` là hỏng: đó là khoá duy nhất để hỏi trang QL ra URL site LMS.
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
    //
    // ✅ MISA đã chốt: AMIS trả về `sid` + `tenantid` + `userid`, **KHÔNG có
    // token key**. `tenantid` là khoá để hỏi trang QL lấy URL site LMS.
    // `tokenKey` giữ lại phòng khi sau này có, hiện luôn rỗng — không nhánh nào
    // phụ thuộc vào nó.
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
 * Luồng: app LMS xin quyền từ AMIS, nhận về `sid` + `tenantid` + `userid`, rồi
 * gửi **`tenantid`** sang trang QL để lấy toàn bộ thông tin tenant — trong đó
 * quan trọng nhất là **URL site LMS** để nạp WebView.
 *
 * `tenantid` là KHOÁ TRA CỨU. Không có nó thì không biết nạp site nào.
 * ──────────────────────────────────────────────────────────────────────────── */

export const VNR_TENANT_LOOKUP = {
    // ⚠️ CHỜ BE. Vd: 'https://lmsadmin.vnresource.vn/api/app/amis/resolve'
    url: '',
    method: 'POST',
    timeoutMs: 15000,

    // Tên field app LMS GỬI ĐI. `tenantid` là khoá, phần còn lại gửi kèm cho đủ
    // ngữ cảnh. Đặt '' để không gửi field đó.
    request: {
        tenantId: 'tenantid',
        sid: 'sid',
        userId: 'userid',
        tokenKey: 'tokenkey', // hiện luôn rỗng, xem mục 3
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
 * 5b. GỠ LỖI TẠM THỜI — 🚧 PHẢI TẮT TRƯỚC KHI RELEASE
 *
 * Chưa có endpoint trang QL (mục 4) nên chưa đổi được `tenantid` ra URL site.
 * Trong lúc đó vẫn cần thấy AMIS trả về đúng những gì đã hẹn ⇒ hiện thẳng bộ
 * tham số callback ra Alert.
 *
 * Cố tình KHÔNG khoá bằng `__DEV__`: cần bật được cả trên bản build ký thật
 * gửi MISA test. Bù lại phải nhớ tắt tay — có ghi ở docs/tasks-…
 * ──────────────────────────────────────────────────────────────────────────── */

export const AMIS_DEBUG = {
    // Hiện Alert với toàn bộ tham số AMIS gửi về (kể cả khi rỗng hoặc lỗi).
    alertCallbackParams: true,

    // Bấm OK ở Alert xong thì DỪNG, không đi tiếp bước gọi trang QL.
    // Để `false` là chạy tiếp vào mock (mục 5) / endpoint thật (mục 4).
    stopAfterAlert: true,
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
    // ⏸️ HIỆN KHÔNG DÙNG. Thất bại rồi thì bao lâu nữa mới TỰ ĐỘNG thử lại.
    //
    // Nghiệp vụ đã chốt: máy trắng thông tin mà có AMIS thì **mỗi lần mở app đều
    // sang AMIS**, không chặn lại. Giá trị dưới đây và `shouldAutoRequestToken()`
    // giữ nguyên để bật lại được — xem amisLaunchFlow.js#decideLaunchAction (3).
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
 * ⏸️ TẠM ẨN nút "Đăng nhập bằng AMIS" trên CẢ HAI nền tảng.
 *
 * Nút đó không thêm được gì: app đã tự mở AMIS khi máy trắng thông tin; mở
 * không được (chưa cài AMIS) thì im lặng không làm gì; còn mở được rồi mà người
 * dùng tắt AMIS thì đã có thông báo kèm nút "Thử lại" ngay bên dưới.
 *
 * ⚠️ Chỉ ẩn nút, KHÔNG tắt tính năng: nút "Thử lại" vẫn chạy (cờ riêng
 * `amisAvailable`), và luồng tự mở AMIS lúc khởi động vẫn nguyên vẹn.
 *
 * Đường vào duy nhất bị mất: người dùng đã có site đang lưu, bấm Home về màn
 * Welcome rồi muốn đăng nhập bằng AMIS — lúc đó phải nhập mã cấu hình tay.
 *
 * Bật lại: `return true`, hoặc `return Platform.OS !== 'android'` nếu chỉ muốn
 * hiện trên iOS.
 */
export function shouldShowAmisLoginButton() {
    return false;
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
 * Đường dẫn quay về AMIS của nền tảng hiện tại.
 * MISA chốt hai chuỗi khác nhau: iOS không path, Android phải là '/lms'.
 */
export function getAmisReturnPath() {
    const paths = AMIS_APP.returnPath || {};
    return (Platform.OS === 'android' ? paths.android : paths.ios) || '';
}

/**
 * URL mở lại app AMIS (nút "Quay về AMIS" trong menu).
 *
 * Chuỗi chốt với MISA:
 *     iOS     -> misa.amis.vn://
 *     Android -> https://misajsc.amis.vn/lms
 *
 * Trả '' khi chưa cấu hình ⇒ nút tự ẩn, không hiện nút bấm vào không có gì xảy ra.
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

/**
 * URL callback app LMS công bố cho AMIS gọi ngược.
 * Đây là chuỗi phải gửi cho MISA — AMIS ghép thêm `?tenantid=…&userid=…&sid=…`.
 */
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
 * Cầm `tenantid` về rồi thì có chỗ nào hỏi ra URL site LMS không.
 *
 * Tách riêng khỏi `isAmisConfigured()` vì hai bên chặn ở hai khâu khác nhau —
 * thiếu scheme là không mở được AMIS, thiếu endpoint là mở được nhưng cầm
 * `tenantid` về rồi không biết hỏi ai.
 *
 * Ba đường được tính là "có chỗ hỏi": endpoint thật, mock, và chế độ gỡ lỗi
 * hiện Alert. Nhắc riêng về cái thứ ba: nó là điều kiện để bản build **release**
 * (không có `__DEV__`, chưa có endpoint) vẫn mở được AMIS mà đi hết vòng
 * callback — thiếu nó thì `startAmisLogin` chặn ngay từ đầu và không bao giờ
 * thấy Alert.
 */
export function isTenantLookupConfigured() {
    return (
        Boolean(VNR_TENANT_LOOKUP.url) ||
        AMIS_MOCK.enabled ||
        AMIS_DEBUG.alertCallbackParams
    );
}
