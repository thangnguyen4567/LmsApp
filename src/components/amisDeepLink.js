import {URL} from 'react-native-url-polyfill';

/**
 * Xử lý deep link do app AMIS gửi sang.
 *
 * AMIS mở app LMS bằng `vnrlms://applms/home/<url-đã-encode>`; khi người dùng đã
 * đăng nhập AMIS thì URL đó mang thêm `sid` + `tenantid` để LMS tự đăng nhập.
 *
 * Hai thứ này là thông tin DÙNG MỘT LẦN cho phiên hiện tại, KHÔNG được lưu xuống
 * MMKV: lần mở app sau sẽ nạp lại `sid` đã hết hạn, mà backend ưu tiên `sid` hơn
 * `user_saas` nên sẽ rớt về trang đăng nhập dù phiên SaaS còn tốt.
 */

// Tài liệu tích hợp viết là "TenantID, SID" nên không chắc AMIS gửi hoa hay thường
// -> mọi thao tác đọc/xoá đều so khớp không phân biệt hoa thường.
const AMIS_PARAMS = ['sid', 'tenantid', 'lang', 'userid'];

// Ngôn ngữ app hỗ trợ. AMIS gửi giá trị lạ -> ép về 'en' (không phải 'vi'): coi
// như người dùng không thuộc nhóm tiếng Việt thì tiếng Anh dễ hiểu hơn.
const SUPPORTED_LANGS = ['vi', 'en'];
const FALLBACK_LANG = 'en';

// ⚠️ Định danh app AMIS (scheme, package name, endpoint trang QL…) nằm ở
// src/services/amisConfig.js — một chỗ duy nhất để điền khi MISA/BE cung cấp.

/**
 * Deep link này có phải do app AMIS mở không.
 * Căn cứ: có mang tham số định danh của AMIS (`sid`/`tenantid`/`userid`).
 * `lang` KHÔNG tính — nó chỉ là tuỳ chọn hiển thị, không định danh nguồn gọi.
 */
export function isFromAmisApp(amisParams) {
    const {sid = '', tenantid = '', userid = ''} = amisParams || {};
    return Boolean(sid || tenantid || userid);
}

// Điểm vào đăng nhập SaaS, tính từ wwwroot của site.
const SAAS_LOGIN_PATH = '/auth/saas/index.php';
const SAAS_MARKER = 'auth/saas/index.php';
// Điểm vào đăng nhập thường. `applms=true` là cờ mà web dùng để biết request
// đến từ app — giữ đúng dạng mà luồng nhập link tay đang lưu.
const LOGIN_ENTRY_PATH = '/login/index.php?applms=true';

// LƯỚI ĐỠ, không phải luồng chính: theo hợp đồng đã chốt, AMIS gửi thẳng
// `https://<wwwroot>/auth/saas/index.php` nên toSaasLoginUrl() thoát sớm và
// KHÔNG dùng tới phần suy đoán dưới đây. Chỗ này chỉ để không vỡ nếu AMIS (hoặc
// một nguồn deep link khác) gửi URL dạng khác.
//
// LMS có thể cài ở GỐC domain (khách hàng thường) hoặc dưới SUB-PATH (MISA JSC
// dùng /lms) — nên tuyệt đối không hard-code sub-path.
// Cách suy: cắt tại thư mục cấp 1 của Moodle; phần đứng trước chính là wwwroot:
//   https://host/lms/course/view.php  -> https://host/lms
//   https://host/course/view.php      -> https://host
//
// Danh sách đối chiếu từ source LMS thực tế (Moodle 4.4 + plugin VNR). Đã bỏ các
// thư mục chỉ có khi dev (node_modules, vendor, moodledata_dev) vì không bao giờ
// xuất hiện trong URL người dùng.
const MOODLE_ROOT_DIRS = [
    'admin', 'analytics', 'auth', 'availability', 'backup', 'badges', 'blocks',
    'blog', 'cache', 'calendar', 'cohort', 'comment', 'communication',
    'competency', 'completion', 'contentbank', 'course', 'customfield',
    'dataformat', 'enrol', 'error', 'favourites', 'files', 'filter', 'grade',
    'group', 'h5p', 'install', 'iplookup', 'lang', 'lib', 'local', 'login',
    'masterpage', 'media', 'message', 'mnet', 'mod', 'moodlenet', 'my', 'notes',
    'payment', 'pix', 'plagiarism', 'portfolio', 'privacy', 'question', 'rating',
    'report', 'reportbuilder', 'repository', 'rss', 'saas', 'search', 'shop',
    'tag', 'theme', 'user', 'userpix', 'webservice',
].map(dir => '/' + dir + '/');

// Link cũ của MISA JSC — giữ để deep link phiên bản AMIS cũ (không kèm sid)
// hoạt động y như trước.
const MISA_LMS_PREFIX = 'https://misajsc.amis.vn/lms';

const parseUrl = rawUrl => {
    try {
        return new URL(String(rawUrl));
    } catch (e) {
        return null;
    }
};

const readParam = (searchParams, name) => {
    const target = name.toLowerCase();
    let found = '';
    searchParams.forEach((value, key) => {
        if (!found && key.toLowerCase() === target) {
            found = value;
        }
    });
    return found;
};

const removeParam = (searchParams, name) => {
    const target = name.toLowerCase();
    const matched = [];
    searchParams.forEach((_value, key) => {
        if (key.toLowerCase() === target) {
            matched.push(key);
        }
    });
    matched.forEach(key => searchParams.delete(key));
};

/**
 * Chuẩn hoá `lang` nhận từ AMIS.
 * - Không truyền / rỗng  -> '' (giữ nguyên ngôn ngữ app đang dùng)
 * - 'vi' hoặc 'en'       -> nhận (không phân biệt hoa thường, chấp nhận 'vi-VN')
 * - Giá trị khác         -> 'en'
 */
export function normalizeAmisLang(rawLang) {
    const value = String(rawLang || '').trim();
    if (!value) {
        return '';
    }
    // 'vi-VN', 'en_US'... -> lấy phần mã ngôn ngữ đứng trước.
    const code = value.toLowerCase().split(/[-_]/)[0];
    return SUPPORTED_LANGS.indexOf(code) > -1 ? code : FALLBACK_LANG;
}

/**
 * Tách `sid`/`tenantid`/`lang`/`userid` ra khỏi URL deep link.
 * Trả về `{cleanUrl, sid, tenantid, lang, userid}` — `cleanUrl` là bản an toàn
 * để lưu lâu dài. URL sai định dạng hoặc không mang tham số nào thì trả lại
 * nguyên bản (không chuẩn hoá lại chuỗi) để deep link cũ giữ nguyên hành vi.
 *
 * Cả 4 tham số đều bị gỡ khỏi `cleanUrl`, mỗi cái vì một lý do:
 * - `sid`: hết hạn theo phiên, dùng lại ở lần mở app sau sẽ rớt đăng nhập.
 * - `tenantid`, `userid`: gắn với người dùng/đơn vị của phiên đó; giữ lại rồi
 *   dùng cho người khác là sai dữ liệu.
 * - `lang`: để nằm lại thì ContentView luôn tôn trọng giá trị cũ, người dùng
 *   đổi ngôn ngữ trong app sẽ không có tác dụng (ngôn ngữ nhớ qua `app_locale`).
 */
export function splitAmisParams(rawUrl) {
    const url = String(rawUrl || '');
    const empty = {cleanUrl: url, sid: '', tenantid: '', lang: '', userid: ''};
    const parsed = parseUrl(url);
    if (!parsed) {
        return empty;
    }
    const sid = readParam(parsed.searchParams, 'sid');
    const tenantid = readParam(parsed.searchParams, 'tenantid');
    const lang = normalizeAmisLang(readParam(parsed.searchParams, 'lang'));
    const userid = readParam(parsed.searchParams, 'userid');
    if (!sid && !tenantid && !lang && !userid) {
        return empty;
    }
    AMIS_PARAMS.forEach(name => removeParam(parsed.searchParams, name));
    return {cleanUrl: parsed.toString(), sid, tenantid, lang, userid};
}

/**
 * Đọc `sid`/`tenantid` từ params của deep link.
 *
 * AMIS có thể đặt chúng ở một trong hai chỗ:
 *   (b1) nhúng trong URL đích  — `.../home/<encode(...index.php?sid=X)>`
 *   (b2) query của deep link   — `.../home/<encode(...index.php)>?sid=X`
 * Ở dạng (b2), React Navigation gộp query vào `route.params`, nên phải đọc thêm
 * từ đây. Hỗ trợ cả hai để không phải chờ chốt hợp đồng mới chạy được.
 */
export function readAmisRouteParams(params) {
    let sid = '';
    let tenantid = '';
    let lang = '';
    let userid = '';
    if (params && typeof params === 'object') {
        Object.keys(params).forEach(key => {
            const value = params[key];
            if (typeof value !== 'string' || !value) {
                return;
            }
            const lower = key.toLowerCase();
            if (!sid && lower === 'sid') {
                sid = value;
            }
            if (!tenantid && lower === 'tenantid') {
                tenantid = value;
            }
            if (!lang && lower === 'lang') {
                lang = value;
            }
            if (!userid && lower === 'userid') {
                userid = value;
            }
        });
    }
    return {sid, tenantid, lang: normalizeAmisLang(lang), userid};
}

/**
 * Ghép `sid`/`tenantid`/`lang` vào URL để nạp WebView cho phiên hiện tại.
 * Kết quả CHỈ dùng để nạp — đừng lưu xuống MMKV (xem chú thích đầu file).
 *
 * Nhận nguyên object mà `splitAmisParams` trả về cho tiện.
 */
export function withAmisParams(rawUrl, amisParams) {
    const url = String(rawUrl || '');
    const {sid = '', tenantid = '', lang = '', userid = ''} = amisParams || {};
    if (!sid && !tenantid && !lang && !userid) {
        return url;
    }
    const parsed = parseUrl(url);
    if (!parsed) {
        return url;
    }
    if (sid) {
        parsed.searchParams.set('sid', sid);
    }
    if (tenantid) {
        parsed.searchParams.set('tenantid', tenantid);
    }
    if (lang) {
        parsed.searchParams.set('lang', lang);
    }
    if (userid) {
        parsed.searchParams.set('userid', userid);
    }
    return parsed.toString();
}

/**
 * Đọc `sid` từ URL sắp nạp. Trả '' nếu không có.
 * Backend còn nhận `sid` qua cookie `x-sessionid` nữa nên cần chính giá trị,
 * không chỉ cần biết có hay không.
 */
export function readAmisSid(rawUrl) {
    const parsed = parseUrl(rawUrl);
    if (!parsed) {
        return '';
    }
    return readParam(parsed.searchParams, 'sid');
}

/**
 * Đọc `tenantid` từ URL sắp nạp. Trả '' nếu không có.
 * Backend đọc tenant qua cookie `TENANT` nên cần chính giá trị.
 */
export function readAmisTenantId(rawUrl) {
    const parsed = parseUrl(rawUrl);
    if (!parsed) {
        return '';
    }
    return readParam(parsed.searchParams, 'tenantid');
}

/**
 * URL sắp nạp có mang `sid` không. Dùng để quyết định body POST: có `sid` thì
 * `sid` là danh tính duy nhất, không gửi kèm username/password/user_saas.
 */
export function hasAmisSid(rawUrl) {
    return Boolean(readAmisSid(rawUrl));
}

/**
 * Suy wwwroot (gốc site LMS) từ một URL bất kỳ trong site đó.
 * Hoạt động cho cả site cài ở gốc domain lẫn site nằm dưới sub-path.
 * Trả '' nếu URL không phân tích được.
 */
export function deriveWwwroot(rawUrl) {
    const parsed = parseUrl(rawUrl);
    if (!parsed) {
        return '';
    }
    const pathname = parsed.pathname || '/';
    // Lấy thư mục Moodle xuất hiện SỚM NHẤT trong đường dẫn, không phải thư mục
    // khớp đầu tiên trong danh sách — thứ tự khai báo không được ảnh hưởng kết
    // quả. Vd '/lms/grade/report/user/index.php' phải cắt tại '/grade/' (vị trí
    // 4), nếu bắt trúng '/user/' (vị trí 17) thì wwwroot ra '/lms/grade/report'.
    let cutAt = -1;
    for (let i = 0; i < MOODLE_ROOT_DIRS.length; i++) {
        const at = pathname.indexOf(MOODLE_ROOT_DIRS[i]);
        if (at > -1 && (cutAt === -1 || at < cutAt)) {
            cutAt = at;
        }
    }
    if (cutAt > -1) {
        return parsed.origin + pathname.slice(0, cutAt);
    }
    // Không nhận ra thư mục quen thuộc: bỏ phần tệp *.php ở cuối (nếu có) rồi bỏ
    // dấu '/' thừa — coi phần còn lại là gốc site.
    const base = pathname.replace(/\/[^/]*\.php$/, '').replace(/\/+$/, '');
    return parsed.origin + base;
}

/**
 * Dựng URL trang đăng nhập SaaS từ một URL LMS bất kỳ.
 *
 * KHÔNG hard-code host hay sub-path: AMIS có bản cho MISA JSC (site nằm dưới
 * `/lms`) và bản cho khách hàng khác (domain riêng, thường cài ở gốc, không có
 * sub-path). wwwroot được suy từ chính URL nhận được.
 *
 * Query string được giữ nguyên — đây là điểm bản cũ làm sai: nó gán đè cả chuỗi
 * URL nên deep link kiểu `.../login/index.php?sid=...` mất luôn `sid`.
 */
export function toSaasLoginUrl(rawUrl) {
    const url = String(rawUrl || '');
    if (url.indexOf(SAAS_MARKER) > -1) {
        return url;
    }
    const wwwroot = deriveWwwroot(url);
    if (!wwwroot) {
        return url;
    }
    const parsed = parseUrl(url);
    return wwwroot + SAAS_LOGIN_PATH + (parsed && parsed.search ? parsed.search : '');
}

/**
 * Điểm vào cần nạp ở lần mở app SAU, chọn theo cách người dùng VỪA đăng nhập.
 *
 * Vì sao phải đổi theo: hai điểm vào nhận hai loại thông tin khác nhau.
 * - `auth/saas/index.php` chỉ hiểu `sid` / `user_saas`. Nó **không xử lý**
 *   `username`/`password` — gửi vào cũng bị bỏ qua, rồi vì không có phiên SaaS
 *   nào nên backend đẩy thẳng người dùng sang trang đăng nhập MISA.
 * - `login/index.php` mới là chỗ nhận `username`/`password`.
 *
 * Đăng nhập tay xong mà vẫn giữ điểm vào SaaS thì lần mở app sau bị đá sang
 * MISA, dù máy đang có đủ tài khoản thường để tự đăng nhập.
 *
 * Trả '' khi không suy được wwwroot — bên gọi giữ nguyên URL đang lưu.
 */
export function toAuthEntryUrl(rawUrl, authMethod) {
    const wwwroot = deriveWwwroot(rawUrl);
    if (!wwwroot) {
        return '';
    }
    return authMethod === 'saas'
        ? wwwroot + SAAS_LOGIN_PATH
        : wwwroot + LOGIN_ENTRY_PATH;
}

/**
 * Hành vi cũ dành cho deep link KHÔNG kèm sid (AMIS bản cũ): chỉ ép link
 * `misajsc.amis.vn/lms` về trang đăng nhập SaaS, các host khác giữ nguyên.
 *
 * Giữ nguyên phạm vi hẹp này có chủ đích — mở rộng cho mọi host sẽ đổi hành vi
 * của những deep link đang chạy (vd site của khách hàng không cài plugin
 * `auth_saas` thì `/auth/saas/index.php` sẽ 404).
 */
export function normalizeLegacyMisaUrl(rawUrl) {
    const url = String(rawUrl || '');
    if (!url.startsWith(MISA_LMS_PREFIX)) {
        return url;
    }
    return toSaasLoginUrl(url);
}
