import {Linking, Platform} from 'react-native';
import {saveData, getData, deleteData} from '../components/AsyncStorage';
import {isPackageInstalled, openUrlInApp} from './amisNative';
import {
    AMIS_APP,
    AMIS_CALLBACK,
    AMIS_DETECT,
    AMIS_GETTOKEN,
    AMIS_KEYS,
    AMIS_MOCK,
    AMIS_TIMING,
    LOOKUP_ERROR,
    VNR_TENANT_LOOKUP,
    canDetectAmisInstalled,
    getCallbackUrl,
    isAmisConfigured,
    isTenantLookupConfigured,
    joinAmisUrl,
} from './amisConfig';

/**
 * Kịch bản A — máy chưa từng có phiên LMS nào.
 *
 * Người dùng cài app từ store rồi mở thẳng (không qua deep link AMIS) nên app
 * không có URL site nào để nạp. Thay vì bắt nhập mã cấu hình, app hỏi app AMIS
 * trên máy xin quyền, rồi mang `tenantid` sang trang QL đổi lấy link site.
 *
 *   LMS ──(1) misa.amis.vn://lms?source=ailearning ─────────────▶ AMIS
 *   AMIS ─(2) vnrlms://applms/amis-callback?tenantid=…&sid=… ───▶ LMS
 *   LMS ──(3) POST trang QL {tenantid} ─────────────────────────▶ BE VNR
 *   BE  ─(4) {link, sid, tenantid} ─────────────────────────────▶ LMS
 *   LMS ──(5) POST <link>/auth/saas/index.php?sid=… ───────────▶ site LMS ✅
 *
 * Bước (5) dùng chung đường đi với deep link của kịch bản B — hai kịch bản hội
 * tụ về đúng một điểm, xem App.tsx#applySession.
 *
 * ⚠️ Mọi giá trị cần MISA/BE cung cấp nằm ở ./amisConfig.js, không nằm ở đây.
 */

/* ── Phát hiện app AMIS ───────────────────────────────────────────────────── */

/**
 * Máy có cài app AMIS không. Trả một giá trị của AMIS_DETECT.
 *
 * - **iOS**: `canOpenURL('misa.amis.vn://')` — đòi `LSApplicationQueriesSchemes`
 *   trong Info.plist, thiếu khai thì luôn `false` bất kể máy có cài hay không.
 * - **Android**: hỏi `PackageManager` qua module native. Không dùng được
 *   `canOpenURL` vì trình duyệt nào cũng nhận link https nên luôn `true`. Bản
 *   build chưa có module ⇒ `UNKNOWN` (không phải `NO`), để tầng trên vẫn hiện
 *   nút thay vì kết luận sai là chưa cài.
 */
export async function isAmisInstalled() {
    if (!isAmisConfigured()) {
        return AMIS_DETECT.NO;
    }
    if (!canDetectAmisInstalled()) {
        return AMIS_DETECT.UNKNOWN;
    }

    if (Platform.OS === 'android') {
        const installed = await isPackageInstalled(AMIS_APP.androidPackage);
        if (installed === null) {
            // Chưa build lại Android nên chưa có module native.
            return AMIS_DETECT.UNKNOWN;
        }
        return installed ? AMIS_DETECT.YES : AMIS_DETECT.NO;
    }

    // Thử prod trước rồi tới bản test — máy QA thường chỉ có một trong hai.
    const candidates = [AMIS_APP.scheme, AMIS_APP.schemeTest].filter(Boolean);
    for (let i = 0; i < candidates.length; i++) {
        try {
            const ok = await Linking.canOpenURL(candidates[i] + '://');
            if (ok) {
                return AMIS_DETECT.YES;
            }
        } catch (_e) {
            // canOpenURL ném lỗi khi scheme chưa được khai quyền hỏi — coi như
            // không có, đừng để vỡ cả luồng khởi động.
        }
    }
    return AMIS_DETECT.NO;
}

/**
 * Mở một URL của AMIS. Android đi qua module native (`setPackage`) nên intent
 * bị khoá vào đúng app AMIS, không rơi ra trình duyệt; iOS dùng custom scheme
 * nên `Linking` là đủ.
 */
export async function openAmisUrl(url) {
    if (!url) {
        return false;
    }
    if (Platform.OS === 'android') {
        return openUrlInApp(url, AMIS_APP.androidPackage);
    }
    try {
        await Linking.openURL(url);
        return true;
    } catch (_e) {
        return false;
    }
}

/* ── `state` — chống callback giả mạo (hiện MISA không dùng) ──────────────── */

/**
 * Sinh chuỗi ngẫu nhiên cho tham số `state`.
 *
 * ⚠️ NỢ KỸ THUẬT (T2.3): `Math.random()` nên đoán được về mặt lý thuyết. Đủ để
 * chặn callback lạc và callback lặp, KHÔNG đủ để chặn app độc hại cùng máy cố
 * tình đoán. Siết lại thì cài `react-native-get-random-values` và thay đúng
 * thân hàm này — không chỗ nào khác phụ thuộc cách sinh.
 */
export function generateState() {
    let out = '';
    while (out.length < 32) {
        out += Math.random().toString(36).slice(2);
    }
    return out.slice(0, 32);
}

/** Lưu `state` kèm mốc thời gian để đối chiếu khi callback về. */
export async function rememberState(state) {
    await saveData(AMIS_KEYS.state, state);
    await saveData(AMIS_KEYS.stateAt, String(Date.now()));
}

/**
 * Đối chiếu `state` trong callback. Dùng đúng một lần: đối chiếu xong là xoá dù
 * đúng hay sai, nên callback thứ hai cùng `state` sẽ bị từ chối.
 */
export async function verifyState(state, now) {
    const [saved, savedAt] = await Promise.all([
        getData(AMIS_KEYS.state),
        getData(AMIS_KEYS.stateAt),
    ]);
    await Promise.all([
        deleteData(AMIS_KEYS.state),
        deleteData(AMIS_KEYS.stateAt),
    ]);
    if (!saved || !state || saved !== state) {
        return false;
    }
    const at = Number(savedAt || 0);
    if (!at) {
        return false;
    }
    const current = typeof now === 'number' ? now : Date.now();
    return current - at <= AMIS_TIMING.stateTtlMs;
}

/* ── Bước (1) — gọi sang AMIS xin quyền ───────────────────────────────────── */

const appendParam = (parts, name, value) => {
    if (!name || !value) {
        return;
    }
    parts.push(
        encodeURIComponent(name) + '=' + encodeURIComponent(String(value)),
    );
};

/**
 * Dựng URL deep link xin quyền. Thuần — không đụng Linking.
 *   iOS     -> misa.amis.vn://lms?source=ailearning
 *   Android -> https://misajsc.amis.vn/lms?source=ailearning
 *
 * Tham số nào có tên rỗng trong `AMIS_GETTOKEN.params` thì tự bị bỏ. Trả '' khi
 * chưa cấu hình gốc URL AMIS.
 */
export function buildGetTokenUrl({state = '', lang = ''} = {}) {
    const base = joinAmisUrl(AMIS_GETTOKEN.path || '');
    if (!base) {
        return '';
    }
    const names = AMIS_GETTOKEN.params || {};
    const parts = [];
    appendParam(parts, names.source, AMIS_APP.source);
    appendParam(parts, names.redirectUri, getCallbackUrl());
    appendParam(parts, names.state, state);
    appendParam(parts, names.clientId, AMIS_GETTOKEN.clientId);
    appendParam(parts, names.lang, lang);
    return parts.length ? base + '?' + parts.join('&') : base;
}

/**
 * Mở app AMIS để xin quyền. Dùng chung cho lượt tự động lúc khởi động lẫn nút
 * bấm tay, nên KHÔNG đụng vào cờ một-lần ở đây — chỉ nhánh tự động mới đánh dấu
 * (xem `markAmisAutoLaunched` trong useAmisLogin.js).
 */
export async function requestTokenKey({lang = ''} = {}) {
    if (!isAmisConfigured()) {
        return {ok: false, error: LOOKUP_ERROR.CONFIG};
    }
    // MISA không nhận `state` ⇒ không sinh, không lưu. Sinh rồi bỏ đó thì lần
    // sau còn `state` cũ trong MMKV mà không ai đối chiếu — vừa vô ích vừa gây
    // hiểu nhầm khi đọc storage lúc gỡ lỗi.
    const sendsState = Boolean(AMIS_GETTOKEN.params?.state);
    const state = sendsState ? generateState() : '';
    if (sendsState) {
        await rememberState(state);
    }
    const url = buildGetTokenUrl({state, lang});
    const opened = await openAmisUrl(url);
    if (!opened) {
        // Chưa cài AMIS, hoặc AMIS không nhận URL này — từ phía app không phân
        // biệt được nên gộp làm một.
        return {ok: false, error: LOOKUP_ERROR.UNKNOWN};
    }
    return {ok: true, state, url};
}

/**
 * App đã từng TỰ ĐỘNG bay sang AMIS chưa. Nút bấm tay không tính.
 *
 * Lưu mốc thời gian chứ không lưu `'1'` — đọc thì chỉ cần biết có hay không,
 * nhưng lúc soi storage để gỡ lỗi thì biết được nó xảy ra khi nào.
 */
export async function hasAutoLaunchedAmis() {
    const raw = await getData(AMIS_KEYS.autoLaunched);
    return Boolean(raw);
}

/**
 * Đánh dấu đã dùng hết lượt tự động.
 *
 * Phải gọi TRƯỚC khi mở AMIS, không phải sau khi biết kết quả: app rời màn hình
 * ngay sau đó và có thể bị hệ điều hành thu hồi luôn (ROM dọn nền hung như
 * HyperOS/MIUI). Ghi sau ⇒ đúng những máy đó không bao giờ ghi được ⇒ mở app lần
 * nào cũng bị đá sang AMIS.
 *
 * Nuốt lỗi: ghi hỏng thì cùng lắm lần sau hỏi lại một lần, không đáng để chặn cả
 * luồng đăng nhập.
 */
export async function markAmisAutoLaunched() {
    try {
        await saveData(AMIS_KEYS.autoLaunched, String(Date.now()));
    } catch (_e) {
        // bỏ qua — xem giải thích ở trên
    }
}

/* ── Bước (2) — bóc callback từ AMIS ──────────────────────────────────────── */

export const LINK_TYPE = {
    HOME: 'home', // vnrlms://applms/home/<url> — kịch bản B, React Navigation lo
    CALLBACK: 'callback', // vnrlms://applms/amis-callback?… — kịch bản A
    UNKNOWN: 'unknown',
};

/**
 * Đọc query string thành object, khoá hạ về chữ thường.
 *
 * Cố tình KHÔNG dùng `new URL()`: custom scheme không phải "special scheme"
 * theo chuẩn WHATWG nên cách tách host/path khác http(s), dễ lệch giữa các bản
 * polyfill. Tách tay thì hành vi cố định.
 */
function parseQueryString(search) {
    const out = {};
    String(search || '')
        .replace(/^\?/, '')
        .split('&')
        .forEach(pair => {
            if (!pair) {
                return;
            }
            const eq = pair.indexOf('=');
            const rawKey = eq === -1 ? pair : pair.slice(0, eq);
            const rawValue = eq === -1 ? '' : pair.slice(eq + 1);
            if (!rawKey) {
                return;
            }
            let key = rawKey;
            let value = rawValue;
            try {
                key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
                value = decodeURIComponent(rawValue.replace(/\+/g, ' '));
            } catch (_e) {
                // Chuỗi encode hỏng: giữ bản thô còn hơn vứt cả link.
            }
            key = key.toLowerCase();
            // Trùng khoá thì lấy giá trị ĐẦU TIÊN — nối thêm tham số ở cuối sẽ
            // không ghi đè được giá trị thật ở đầu.
            if (!Object.prototype.hasOwnProperty.call(out, key)) {
                out[key] = value;
            }
        });
    return out;
}

const EMPTY_LINK = {
    type: LINK_TYPE.UNKNOWN,
    tokenKey: '',
    sid: '',
    tenantid: '',
    userid: '',
    lang: '',
    state: '',
    error: '',
    rejected: '',
};

/** Phân loại deep link vào app và bóc tham số nếu là callback của AMIS. Thuần. */
export function parseAmisLink(rawUrl) {
    const url = String(rawUrl || '').trim();
    if (!url) {
        return {...EMPTY_LINK};
    }
    const prefix = AMIS_CALLBACK.scheme + '://';
    if (url.toLowerCase().indexOf(prefix.toLowerCase()) !== 0) {
        return {...EMPTY_LINK};
    }
    const rest = url.slice(prefix.length);
    const slash = rest.indexOf('/');
    // Không có '/' nghĩa là chỉ có host ⇒ không phải link ta xử lý.
    const afterHost = slash === -1 ? '' : rest.slice(slash + 1);
    const q = afterHost.indexOf('?');
    const path = (q === -1 ? afterHost : afterHost.slice(0, q)).replace(
        /\/+$/,
        '',
    );
    const search = q === -1 ? '' : afterHost.slice(q + 1);

    const lowerPath = path.toLowerCase();
    if (lowerPath !== AMIS_CALLBACK.path.toLowerCase()) {
        // `home/<url>` do React Navigation `linking` xử lý — ở đây chỉ nhận
        // diện để bên gọi biết mà bỏ qua, không bóc tách gì thêm.
        const type =
            lowerPath === 'home' || lowerPath.indexOf('home/') === 0
                ? LINK_TYPE.HOME
                : LINK_TYPE.UNKNOWN;
        return {...EMPTY_LINK, type};
    }

    const p = parseQueryString(search);
    const names = AMIS_CALLBACK.params || {};
    const pick = name => (name ? p[String(name).toLowerCase()] || '' : '');
    return {
        type: LINK_TYPE.CALLBACK,
        tokenKey: pick(names.tokenKey),
        sid: pick(names.sid),
        tenantid: pick(names.tenantId),
        userid: pick(names.userId),
        lang: pick(names.lang),
        state: pick(names.state),
        error: pick(names.error),
        rejected: pick(names.rejected),
    };
}

/**
 * Người dùng đã bấm Từ chối ở popup cấp quyền AMIS chưa — đọc tham số
 * `rejected` của callback.
 *
 * ⏳ HỨNG TRƯỚC: AMIS chưa gửi tham số này, nên hàm gần như luôn trả `false`.
 * Vắng mặt hay giá trị lạ đều là `false` ⇒ luồng chạy y như hôm nay; ngày AMIS
 * bắt đầu gửi thì tự nhận, không phải sửa gì.
 *
 * ⚠️ Chỉ đúng các giá trị trong `rejectedValues` mới tính là từ chối — kiểu
 * "có mặt tham số là coi như true" sẽ hiểu ngược `rejected=false`.
 */
export function isCallbackRejected(rawValue) {
    const value = String(rawValue || '').trim().toLowerCase();
    if (!value) {
        return false;
    }
    return (AMIS_CALLBACK.rejectedValues || []).indexOf(value) > -1;
}

/** Quy `error` trong callback về mã lỗi nội bộ để chọn đúng câu thông báo. */
export function classifyCallbackError(rawError) {
    const value = String(rawError || '').toLowerCase();
    if (!value) {
        return '';
    }
    if (value === String(AMIS_CALLBACK.deniedValue).toLowerCase()) {
        return LOOKUP_ERROR.DENIED;
    }
    if (value.indexOf('deni') > -1 || value.indexOf('cancel') > -1) {
        return LOOKUP_ERROR.DENIED;
    }
    if (value.indexOf('expire') > -1) {
        return LOOKUP_ERROR.EXPIRED;
    }
    return LOOKUP_ERROR.UNKNOWN;
}

/* ── Bước (3)(4) — đổi `tenantid` lấy link site ở trang QL VNR ────────────── */

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function mockLookup(payload) {
    await wait(AMIS_MOCK.delayMs);
    if (AMIS_MOCK.failWith) {
        return {ok: false, error: AMIS_MOCK.failWith};
    }
    const r = AMIS_MOCK.response || {};
    return {
        ok: true,
        mocked: true,
        link: r.link || '',
        // Ưu tiên giá trị AMIS vừa gửi sang, thiếu mới lấy của mock.
        sid: payload.sid || r.sid || '',
        tenantid: payload.tenantid || r.tenantid || '',
        lang: payload.lang || r.lang || '',
        userid: payload.userid || '',
    };
}

/**
 * Đọc field theo đường dẫn lồng: `readPath(json, 'Data.Link')`.
 * Null-safe vì API trả `Data: null` khi không tìm thấy tenant.
 * Tên rỗng ⇒ '' (field API không trả, bên gọi tự có đường lùi).
 */
function readPath(source, path) {
    if (!path || !source) {
        return '';
    }
    const parts = String(path).split('.');
    let cur = source;
    for (let i = 0; i < parts.length; i++) {
        if (cur === null || typeof cur !== 'object') {
            return '';
        }
        cur = cur[parts[i]];
    }
    return cur === null || cur === undefined ? '' : cur;
}

/**
 * Thay `{tenantid}` / `{sid}` / `{userid}` trong URL bằng giá trị thật.
 * `encodeURIComponent` để giá trị lạ không phá cấu trúc đường dẫn.
 */
function buildLookupUrl(template, data) {
    return String(template || '').replace(/\{(tenantid|sid|userid)\}/g, (_m, key) =>
        encodeURIComponent(data[key] || ''),
    );
}

/**
 * Gọi trang QL đổi `tenantid` lấy `{link, sid, tenantid}`.
 *
 * Mọi lỗi đều quy về một mã trong LOOKUP_ERROR — bên gọi không phải biết gì về
 * HTTP, và không nhánh nào để người dùng kẹt màn hình chờ.
 */
export async function lookupTenant(payload = {}) {
    const data = {
        tokenKey: payload.tokenKey || '',
        sid: payload.sid || '',
        tenantid: payload.tenantid || '',
        userid: payload.userid || '',
        lang: payload.lang || '',
    };

    if (AMIS_MOCK.enabled && !VNR_TENANT_LOOKUP.url) {
        return mockLookup(data);
    }
    if (!isTenantLookupConfigured()) {
        return {ok: false, error: LOOKUP_ERROR.CONFIG};
    }

    const method = (VNR_TENANT_LOOKUP.method || 'POST').toUpperCase();
    const sendsBody = method !== 'GET' && method !== 'HEAD';

    const req = VNR_TENANT_LOOKUP.request || {};
    const body = {};
    if (sendsBody) {
        if (req.tokenKey) {
            body[req.tokenKey] = data.tokenKey;
        }
        if (req.tenantId) {
            body[req.tenantId] = data.tenantid;
        }
        if (req.sid) {
            body[req.sid] = data.sid;
        }
        if (req.userId) {
            body[req.userId] = data.userid;
        }
    }

    const controller = new AbortController();
    const timer = setTimeout(
        () => controller.abort(),
        VNR_TENANT_LOOKUP.timeoutMs,
    );
    try {
        const options = {
            method,
            headers: {Accept: 'application/json'},
            signal: controller.signal,
        };
        // GET kèm body là sai chuẩn và một số proxy sẽ chặn thẳng.
        if (sendsBody) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }
        const res = await fetch(
            buildLookupUrl(VNR_TENANT_LOOKUP.url, data),
            options,
        );
        if (res.status === 404) {
            return {ok: false, error: LOOKUP_ERROR.NOTFOUND};
        }
        if (res.status === 401 || res.status === 403 || res.status === 410) {
            return {ok: false, error: LOOKUP_ERROR.EXPIRED};
        }
        if (!res.ok) {
            return {ok: false, error: LOOKUP_ERROR.NETWORK};
        }
        const json = await res.json();
        const map = VNR_TENANT_LOOKUP.response || {};
        const readField = name => readPath(json, name);
        // API báo lỗi trong THÂN JSON chứ không bằng mã HTTP: không tìm thấy
        // tenant vẫn trả 200 kèm `IsSuccess:false, Message:"TenantNotFound"`.
        //
        // ⚠️ Phải xét `success` TRƯỚC: lúc thành công `Message` mang giá trị
        // "Success", đọc thẳng nó như lỗi là chuyến nào cũng hỏng.
        if (map.success) {
            if (!readField(map.success)) {
                return {
                    ok: false,
                    error: normalizeLookupError(readField(map.error)),
                };
            }
        } else {
            const failure = readField(map.error);
            if (failure) {
                return {ok: false, error: normalizeLookupError(failure)};
            }
        }
        // ⚠️ Ca NGHIỆP VỤ chứ không phải sự cố: đơn vị chưa mở Elearning.
        //
        // `link` là điều kiện DUY NHẤT. API còn trả `Status`/`ExpirationDate`
        // nhưng cố tình bỏ qua: `UnActive` dành cho tenant nội bộ, khách ngoài
        // luôn `Active` — chặn theo `Status` chỉ khoá mất nhóm nội bộ.
        //
        // `.trim()` là chỗ dễ bỏ sót nhất: link toàn khoảng trắng lọt qua thì
        // WebView nạp ' /auth/saas/index.php' — hỏng ở rất xa chỗ gây lỗi.
        const link = String(readField(map.link) || '').trim();
        if (!link) {
            return {ok: false, error: LOOKUP_ERROR.NOTFOUND};
        }
        return {
            ok: true,
            link,
            sid: String(readField(map.sid) || data.sid || ''),
            tenantid: String(readField(map.tenantId) || data.tenantid || ''),
            lang: String(readField(map.lang) || data.lang || ''),
            userid: data.userid,
        };
    } catch (_e) {
        // Gồm cả abort do quá `timeoutMs` và JSON hỏng.
        return {ok: false, error: LOOKUP_ERROR.NETWORK};
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Quy mã lỗi BE trả về thành mã nội bộ. Lạ thì về `unknown`.
 *
 * ⚠️ Danh sách khớp cho `NOTFOUND` là PHỎNG ĐOÁN — BE chưa chốt mã lỗi (T0.4).
 * Cố tình nhận rộng: rơi sai vào `unknown` sẽ hiện "Không xác thực được với
 * AMIS" thay cho "đơn vị chưa mở Elearning", tức sai hẳn nguyên nhân và còn
 * mời người dùng thử lại một việc không bao giờ xong.
 */
export function normalizeLookupError(raw) {
    const value = String(raw || '').toLowerCase();
    if (value.indexOf('expire') > -1) {
        return LOOKUP_ERROR.EXPIRED;
    }
    if (
        value.indexOf('not_found') > -1 ||
        value.indexOf('notfound') > -1 ||
        value.indexOf('not_exist') > -1 ||
        value.indexOf('notexist') > -1 ||
        value.indexOf('no_tenant') > -1 ||
        value.indexOf('no_data') > -1
    ) {
        return LOOKUP_ERROR.NOTFOUND;
    }
    if (value.indexOf('deni') > -1) {
        return LOOKUP_ERROR.DENIED;
    }
    return LOOKUP_ERROR.UNKNOWN;
}

/* ── Dọn dẹp ─────────────────────────────────────────────────────────────── */

/**
 * Xoá dấu vết của MỘT PHIÊN AMIS. Gọi khi người dùng đăng xuất thủ công.
 *
 * ⚠️ Cố ý KHÔNG xoá `AMIS_KEYS.autoLaunched`: lượt tự-mở-AMIS là một lần cho mỗi
 * lần cài app. Xoá ở đây thì cứ đăng xuất là lại bị đá sang AMIS.
 */
export async function clearAmisSession() {
    await Promise.all([
        deleteData(AMIS_KEYS.state),
        deleteData(AMIS_KEYS.stateAt),
        deleteData(AMIS_KEYS.tenantId),
    ]);
}
