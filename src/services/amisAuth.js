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
 * Kịch bản A — máy CHƯA từng có phiên LMS nào.
 *
 * Người dùng cài app LMS từ store rồi mở thẳng (không qua deep link AMIS), nên
 * app không có URL site nào để nạp. Thay vì bắt nhập mã cấu hình, app tự hỏi
 * app AMIS trên máy xin token, rồi mang token sang trang quản lý VNR đổi lấy
 * link site LMS của tenant.
 *
 *   LMS ──(1) amis://get-token?redirect_uri=…&state=…──▶ AMIS
 *   AMIS ─(2) vnrlms://applms/amis-callback?token=…&state=…──▶ LMS
 *   LMS ──(3) POST trang QL {tokenkey, tenantid}──▶ BE VNR
 *   BE  ─(4) {link, sid, tenantid}──▶ LMS
 *   LMS ──(5) POST <link>/auth/saas/index.php?sid=…──▶ site LMS  ✅ đã đăng nhập
 *
 * Bước (5) DÙNG CHUNG đường đi với deep link của kịch bản B — hai kịch bản hội
 * tụ về đúng một điểm, xem App.tsx#applyAmisSession.
 *
 * ⚠️ Toàn bộ giá trị cần MISA/BE cung cấp nằm ở ./amisConfig.js, không nằm ở
 * file này.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * Phát hiện app AMIS
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Máy có cài app AMIS không. Trả một giá trị của AMIS_DETECT.
 *
 * Mỗi nền tảng một cách hỏi, vì MISA cấp hai loại định danh khác nhau:
 *
 * - **iOS**: `canOpenURL('misa.amis.vn://')`, với điều kiện
 *   `LSApplicationQueriesSchemes` trong Info.plist đã khai scheme đó — thiếu
 *   khai thì iOS trả `false` bất kể máy có cài hay không.
 *
 * - **Android**: hỏi `PackageManager` theo package name `vn.com.misa.amis` qua
 *   module native. KHÔNG dùng `canOpenURL('https://misajsc.amis.vn')` được vì
 *   trình duyệt nào cũng nhận link https nên kết quả luôn `true`.
 *   Bản build chưa có module native ⇒ `UNKNOWN` (không phải `NO`), để tầng
 *   trên vẫn hiện nút cho người dùng bấm thay vì kết luận sai là chưa cài.
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
 * Mở một URL của AMIS.
 *
 * Trên Android đi qua module native với `setPackage('vn.com.misa.amis')` nên
 * intent bị khoá vào đúng app AMIS, **không bao giờ rơi ra trình duyệt** — và
 * nhờ vậy không phụ thuộc việc MISA đã xác thực App Link (`assetlinks.json`)
 * hay chưa, thứ mà link https rất dễ vướng trên Android 12+.
 * Trên iOS custom scheme vốn đã trỏ thẳng vào app nên dùng `Linking` là đủ.
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

/* ────────────────────────────────────────────────────────────────────────────
 * `state` — chống callback giả mạo
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Sinh chuỗi ngẫu nhiên cho tham số `state`.
 *
 * ⚠️ NỢ KỸ THUẬT (task T2.3): repo chưa có nguồn ngẫu nhiên mã hoá nào, đây là
 * `Math.random()` nên ĐOÁN ĐƯỢC về mặt lý thuyết. Đủ để chặn callback lạc và
 * callback lặp, KHÔNG đủ để chặn một app độc hại cùng máy cố tình đoán.
 * Muốn siết: cài `react-native-get-random-values` rồi thay đúng thân hàm này —
 * không chỗ nào khác phụ thuộc cách sinh.
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
 * Đối chiếu `state` trong callback.
 * Đúng một lần: đối chiếu xong là xoá, dù đúng hay sai — callback thứ hai với
 * cùng `state` sẽ bị từ chối.
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

/* ────────────────────────────────────────────────────────────────────────────
 * Bước (1) — gọi sang AMIS xin token
 * ──────────────────────────────────────────────────────────────────────────── */

const appendParam = (parts, name, value) => {
    if (!name || !value) {
        return;
    }
    parts.push(
        encodeURIComponent(name) + '=' + encodeURIComponent(String(value)),
    );
};

/**
 * Dựng URL deep link gọi sang AMIS xin quyền. Thuần — không đụng Linking.
 *
 * Chuỗi chốt với MISA:
 *     iOS     -> misa.amis.vn://lms?source=ailearning
 *     Android -> https://misajsc.amis.vn/lms?source=ailearning
 *
 * Gốc URL khác nhau theo nền tảng nên đi qua `joinAmisUrl` chứ không tự ghép
 * chuỗi. Tham số nào có tên rỗng trong `AMIS_GETTOKEN.params` thì tự bị bỏ —
 * hiện MISA chỉ nhận `source`, phần còn lại nằm đó cho tương lai.
 *
 * Trả '' khi chưa cấu hình gốc URL AMIS.
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
 * Mở app AMIS để xin quyền.
 * Ghi mốc thời gian thử để lần khởi động sau không tự động gửi lại ngay
 * (chống ping-pong giữa hai app) — xem `shouldAutoRequestToken`.
 */
export async function requestTokenKey({lang = ''} = {}) {
    if (!isAmisConfigured()) {
        return {ok: false, error: LOOKUP_ERROR.CONFIG};
    }
    // MISA không nhận `state` (xem amisConfig mục 2) ⇒ không sinh, không lưu.
    // Sinh rồi bỏ đó thì lần sau còn `state` cũ trong MMKV, mà bên nhận lại
    // không đối chiếu — vừa vô ích vừa gây hiểu nhầm khi đọc storage lúc debug.
    const sendsState = Boolean(AMIS_GETTOKEN.params?.state);
    const state = sendsState ? generateState() : '';
    if (sendsState) {
        await rememberState(state);
    }
    await saveData(AMIS_KEYS.attemptedAt, String(Date.now()));
    const url = buildGetTokenUrl({state, lang});
    const opened = await openAmisUrl(url);
    if (!opened) {
        // Máy chưa cài AMIS, hoặc AMIS không nhận URL này (bản cũ chưa hỗ trợ
        // `gettoken`). Không phân biệt được từ phía app nên gộp làm một.
        return {ok: false, error: LOOKUP_ERROR.UNKNOWN};
    }
    return {ok: true, state, url};
}

/** Đã tự động thử gần đây chưa (chỉ áp cho lần TỰ ĐỘNG, nút bấm tay bỏ qua). */
export async function shouldAutoRequestToken(now) {
    const raw = await getData(AMIS_KEYS.attemptedAt);
    const at = Number(raw || 0);
    if (!at) {
        return true;
    }
    const current = typeof now === 'number' ? now : Date.now();
    return current - at >= AMIS_TIMING.retryBackoffMs;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Bước (2) — bóc callback từ AMIS
 * ──────────────────────────────────────────────────────────────────────────── */

export const LINK_TYPE = {
    HOME: 'home', // vnrlms://applms/home/<url>  — kịch bản B, React Navigation lo
    CALLBACK: 'callback', // vnrlms://applms/amis-callback?…   — kịch bản A, file này lo
    UNKNOWN: 'unknown',
};

/**
 * Đọc query string thành object, khoá hạ về chữ thường.
 *
 * Cố tình KHÔNG dùng `new URL()`: custom scheme không phải "special scheme"
 * theo chuẩn WHATWG nên cách phân tách host/path khác với http(s), dễ lệch
 * giữa các bản polyfill. Tách tay thì hành vi cố định, không phụ thuộc ai.
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
                // Chuỗi encode hỏng: giữ nguyên bản thô còn hơn vứt cả link.
            }
            key = key.toLowerCase();
            // Trùng khoá thì lấy giá trị ĐẦU TIÊN — kẻ tấn công nối thêm tham số
            // ở cuối sẽ không ghi đè được giá trị thật ở đầu.
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
};

/**
 * Phân loại một deep link vào app và bóc tham số nếu là callback của AMIS.
 * Thuần, không side effect — đây là hàm có unit test dày nhất của luồng này.
 */
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
    // Chưa có '/' nghĩa là chỉ có host, không có path ⇒ không phải link ta xử lý.
    const afterHost = slash === -1 ? '' : rest.slice(slash + 1);
    const q = afterHost.indexOf('?');
    const path = (q === -1 ? afterHost : afterHost.slice(0, q)).replace(
        /\/+$/,
        '',
    );
    const search = q === -1 ? '' : afterHost.slice(q + 1);

    const lowerPath = path.toLowerCase();
    if (lowerPath !== AMIS_CALLBACK.path.toLowerCase()) {
        // `home/<url>` do React Navigation `linking` xử lý, ở đây chỉ nhận diện
        // để bên gọi biết mà bỏ qua chứ không bóc tách gì thêm.
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
    };
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

/* ────────────────────────────────────────────────────────────────────────────
 * Bước (3)(4) — đổi token key lấy link site LMS ở trang quản lý VNR
 * ──────────────────────────────────────────────────────────────────────────── */

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
        // Ưu tiên giá trị AMIS vừa gửi sang, thiếu mới lấy của mock — nhờ vậy
        // sửa tham số lúc test là thấy nó chảy đúng qua cả luồng.
        sid: payload.sid || r.sid || '',
        tenantid: payload.tenantid || r.tenantid || '',
        lang: payload.lang || r.lang || '',
        userid: payload.userid || '',
    };
}

/**
 * Gọi trang QL đổi `token key` lấy `{link, sid, tenantid}`.
 *
 * Mọi lỗi đều được quy về một mã trong LOOKUP_ERROR — bên gọi không phải biết
 * gì về HTTP. Không nhánh nào để người dùng kẹt màn hình chờ.
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

    const req = VNR_TENANT_LOOKUP.request || {};
    const body = {};
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

    const controller = new AbortController();
    const timer = setTimeout(
        () => controller.abort(),
        VNR_TENANT_LOOKUP.timeoutMs,
    );
    try {
        const res = await fetch(VNR_TENANT_LOOKUP.url, {
            method: VNR_TENANT_LOOKUP.method || 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
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
        const readField = name => (name && json ? json[name] || '' : '');
        const failure = readField(map.error);
        if (failure) {
            return {ok: false, error: normalizeLookupError(failure)};
        }
        const link = String(readField(map.link) || '');
        if (!link) {
            // BE trả 200 nhưng không có link ⇒ chưa có bản ghi cho token key này
            // (case T0.5: người dùng cài app thẳng từ store, AMIS chưa đẩy gì lên).
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

/** Quy mã lỗi BE trả về thành mã nội bộ. Lạ thì về `unknown`. */
export function normalizeLookupError(raw) {
    const value = String(raw || '').toLowerCase();
    if (value.indexOf('expire') > -1) {
        return LOOKUP_ERROR.EXPIRED;
    }
    if (value.indexOf('not_found') > -1 || value.indexOf('notfound') > -1) {
        return LOOKUP_ERROR.NOTFOUND;
    }
    if (value.indexOf('deni') > -1) {
        return LOOKUP_ERROR.DENIED;
    }
    return LOOKUP_ERROR.UNKNOWN;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Dọn dẹp
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Xoá mọi dấu vết AMIS. Gọi khi người dùng đăng xuất thủ công, để lần sau bấm
 * "Đăng nhập bằng AMIS" chạy lại được từ đầu (kể cả khi backoff chưa hết hạn).
 */
export async function clearAmisSession() {
    await Promise.all([
        deleteData(AMIS_KEYS.state),
        deleteData(AMIS_KEYS.stateAt),
        deleteData(AMIS_KEYS.attemptedAt),
        deleteData(AMIS_KEYS.tenantId),
    ]);
}
