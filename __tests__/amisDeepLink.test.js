/**
 * @format
 */

import {
  splitAmisParams,
  withAmisParams,
  hasAmisSid,
  readAmisRouteParams,
  isFromAmisApp,
  normalizeAmisLang,
  deriveWwwroot,
  toSaasLoginUrl,
  toAuthEntryUrl,
  normalizeLegacyMisaUrl,
} from '../src/components/amisDeepLink';

// Đăng nhập bằng AMIS rồi đăng xuất rồi đăng nhập TAY: điểm vào lưu lại phải đổi
// theo, nếu không lần mở app sau bị đá sang trang đăng nhập MISA vì
// `auth/saas/index.php` không nhận username/password.
describe('toAuthEntryUrl — điểm vào cho lần mở app sau', () => {
  it('đăng nhập saas -> giữ điểm vào SaaS', () => {
    expect(toAuthEntryUrl('http://localhost:8990/my/', 'saas')).toBe(
      'http://localhost:8990/auth/saas/index.php',
    );
  });

  it('đăng nhập tay -> chuyển sang điểm vào login thường', () => {
    expect(
      toAuthEntryUrl('http://localhost:8990/auth/saas/index.php', 'manual'),
    ).toBe('http://localhost:8990/login/index.php?applms=true');
  });

  it('giá trị auth lạ cũng coi như đăng nhập thường', () => {
    expect(toAuthEntryUrl('http://localhost:8990/my/', 'sso')).toBe(
      'http://localhost:8990/login/index.php?applms=true',
    );
  });

  it('giữ đúng sub-path của site', () => {
    expect(toAuthEntryUrl('https://misajsc.amis.vn/lms/my/', 'saas')).toBe(
      'https://misajsc.amis.vn/lms/auth/saas/index.php',
    );
    expect(toAuthEntryUrl('https://abc.vn/daotao/my/', 'manual')).toBe(
      'https://abc.vn/daotao/login/index.php?applms=true',
    );
  });

  it('URL rỗng/hỏng -> trả rỗng để bên gọi giữ nguyên URL đang lưu', () => {
    expect(toAuthEntryUrl('', 'manual')).toBe('');
    expect(toAuthEntryUrl('khong-phai-url', 'saas')).toBe('');
  });
});

describe('splitAmisParams', () => {
  it('tách sid + tenantid và trả URL sạch', () => {
    const {cleanUrl, sid, tenantid} = splitAmisParams(
      'https://misajsc.amis.vn/lms/auth/saas/index.php?sid=ABC123&tenantid=T9',
    );
    expect(sid).toBe('ABC123');
    expect(tenantid).toBe('T9');
    expect(cleanUrl).not.toContain('sid');
    expect(cleanUrl).not.toContain('T9');
  });

  it('chấp nhận tên tham số viết hoa (tài liệu MISA ghi "TenantID, SID")', () => {
    const {sid, tenantid} = splitAmisParams(
      'https://misajsc.amis.vn/lms/login/index.php?SID=ABC&TenantID=T1',
    );
    expect(sid).toBe('ABC');
    expect(tenantid).toBe('T1');
  });

  it('giữ nguyên các tham số khác', () => {
    const {cleanUrl} = splitAmisParams(
      'https://misajsc.amis.vn/lms/login/index.php?applms=true&sid=ABC',
    );
    expect(cleanUrl).toContain('applms=true');
    expect(cleanUrl).not.toContain('ABC');
  });

  it('không đụng vào URL không mang tham số AMIS (deep link cũ giữ nguyên hành vi)', () => {
    const raw = 'https://lms.example.com/login/index.php?applms=true';
    const {cleanUrl, sid, tenantid} = splitAmisParams(raw);
    expect(cleanUrl).toBe(raw);
    expect(sid).toBe('');
    expect(tenantid).toBe('');
  });

  it('không ném lỗi với chuỗi không phải URL', () => {
    expect(splitAmisParams('khong-phai-url').cleanUrl).toBe('khong-phai-url');
    expect(splitAmisParams('').cleanUrl).toBe('');
  });
});

// Đăng xuất dựng URL bằng deriveWwwroot() thay vì dò '/lms/'. Khoá lại đúng các
// URL gặp trên máy thật (môi trường dev localhost:8990, site cài ở GỐC domain)
// vì đây là chỗ từng làm app chết với `Invalid URL`.
describe('deriveWwwroot — dựng URL đăng xuất', () => {
  const logoutUrl = url => deriveWwwroot(url) + '/login/logout.php?sesskey=K1';

  it('site cài ở gốc domain (localhost:8990 — môi trường dev)', () => {
    expect(logoutUrl('http://localhost:8990/auth/saas/index.php')).toBe(
      'http://localhost:8990/login/logout.php?sesskey=K1',
    );
    expect(logoutUrl('http://localhost:8990/my/')).toBe(
      'http://localhost:8990/login/logout.php?sesskey=K1',
    );
    expect(logoutUrl('http://localhost:8990/examonline.php')).toBe(
      'http://localhost:8990/login/logout.php?sesskey=K1',
    );
  });

  it('MISA JSC — site dưới sub-path /lms', () => {
    expect(logoutUrl('https://misajsc.amis.vn/lms/my/')).toBe(
      'https://misajsc.amis.vn/lms/login/logout.php?sesskey=K1',
    );
  });

  it('sub-path tên khác — chỗ mà cách dò "/lms/" cũ trả về SAI', () => {
    expect(logoutUrl('https://abc.vn/daotao/my/')).toBe(
      'https://abc.vn/daotao/login/logout.php?sesskey=K1',
    );
  });

  it('URL rỗng/hỏng -> wwwroot rỗng, để bên gọi đi nhánh không nạp trang', () => {
    // Trước đây chỗ này là `new URL('')` -> ném TypeError giữa lúc đăng xuất.
    expect(deriveWwwroot('')).toBe('');
    expect(deriveWwwroot('khong-phai-url')).toBe('');
  });
});

describe('deriveWwwroot — site cài ở gốc domain hay dưới sub-path', () => {
  it('site nằm dưới sub-path (bản MISA JSC)', () => {
    expect(deriveWwwroot('https://misajsc.amis.vn/lms/login/index.php')).toBe(
      'https://misajsc.amis.vn/lms',
    );
    expect(deriveWwwroot('https://misajsc.amis.vn/lms/course/view.php?id=5')).toBe(
      'https://misajsc.amis.vn/lms',
    );
  });

  it('site cài ở GỐC domain (bản khách hàng khác — không có sub-path lms)', () => {
    expect(deriveWwwroot('https://elearning.khachhang.vn/login/index.php')).toBe(
      'https://elearning.khachhang.vn',
    );
    expect(deriveWwwroot('https://elearning.khachhang.vn/mod/quiz/attempt.php')).toBe(
      'https://elearning.khachhang.vn',
    );
  });

  it('sub-path tên khác "lms" vẫn suy đúng', () => {
    expect(deriveWwwroot('https://abc.vn/daotao/my/')).toBe('https://abc.vn/daotao');
  });

  it('URL trần (không có thư mục Moodle nào)', () => {
    expect(deriveWwwroot('https://abc.vn/lms/')).toBe('https://abc.vn/lms');
    expect(deriveWwwroot('https://abc.vn')).toBe('https://abc.vn');
  });

  // Đường dẫn chứa NHIỀU tên thư mục Moodle -> phải cắt tại cái xuất hiện SỚM
  // NHẤT, không phụ thuộc thứ tự khai báo trong MOODLE_ROOT_DIRS.
  it('đường dẫn lồng nhiều tên thư mục Moodle', () => {
    expect(
      deriveWwwroot('https://abc.vn/lms/grade/report/user/index.php'),
    ).toBe('https://abc.vn/lms');
    expect(
      deriveWwwroot('https://abc.vn/lms/mod/quiz/report/overview.php?id=3'),
    ).toBe('https://abc.vn/lms');
    expect(deriveWwwroot('https://abc.vn/lms/course/report/outline/index.php')).toBe(
      'https://abc.vn/lms',
    );
  });

  // File .php đặt ngay gốc site — kể cả file riêng của VNR (examonline.php,
  // library.php đang được bottom tab bar dùng).
  it('file .php ở gốc site', () => {
    expect(deriveWwwroot('https://abc.vn/lms/examonline.php')).toBe(
      'https://abc.vn/lms',
    );
    expect(deriveWwwroot('https://abc.vn/lms/library.php?id=1')).toBe(
      'https://abc.vn/lms',
    );
    expect(deriveWwwroot('https://abc.vn/index.php')).toBe('https://abc.vn');
  });
});

describe('toSaasLoginUrl', () => {
  // Hồi quy cho Lỗi 1: bản cũ gán đè cả chuỗi URL nên nuốt mất query.
  it('ép về auth/saas nhưng GIỮ query string', () => {
    const out = toSaasLoginUrl(
      'https://misajsc.amis.vn/lms/login/index.php?applms=true',
    );
    expect(out).toContain('/lms/auth/saas/index.php');
    expect(out).toContain('applms=true');
  });

  it('site ở gốc domain: KHÔNG chèn sub-path /lms', () => {
    const out = toSaasLoginUrl('https://elearning.khachhang.vn/login/index.php');
    expect(out).toBe('https://elearning.khachhang.vn/auth/saas/index.php');
    expect(out).not.toContain('/lms/');
  });

  it('giữ nguyên URL đã trỏ tới auth/saas', () => {
    const raw = 'https://misajsc.amis.vn/lms/auth/saas/index.php?applms=true';
    expect(toSaasLoginUrl(raw)).toBe(raw);
  });
});

describe('normalizeLegacyMisaUrl — deep link cũ, không kèm sid', () => {
  it('vẫn ép link misajsc về auth/saas như trước', () => {
    expect(
      normalizeLegacyMisaUrl('https://misajsc.amis.vn/lms/login/index.php'),
    ).toContain('/lms/auth/saas/index.php');
  });

  it('không đụng tới host khác (giữ đúng hành vi cũ)', () => {
    const raw = 'https://lms.example.com/login/index.php';
    expect(normalizeLegacyMisaUrl(raw)).toBe(raw);
  });
});

describe('withAmisParams / hasAmisSid', () => {
  it('ghép sid + tenantid + lang vào URL sạch', () => {
    const out = withAmisParams('https://misajsc.amis.vn/lms/auth/saas/index.php', {
      sid: 'ABC123',
      tenantid: 'T9',
      lang: 'en',
    });
    expect(hasAmisSid(out)).toBe(true);
    expect(out).toContain('sid=ABC123');
    expect(out).toContain('tenantid=T9');
    expect(out).toContain('lang=en');
  });

  it('không đổi gì khi không có tham số nào', () => {
    const raw = 'https://lms.example.com/login/index.php';
    expect(withAmisParams(raw, {})).toBe(raw);
    expect(withAmisParams(raw, undefined)).toBe(raw);
    expect(hasAmisSid(raw)).toBe(false);
  });
});

describe('lang từ deep link', () => {
  it('nhận vi/en, không phân biệt hoa thường, chấp nhận cả vi-VN', () => {
    expect(normalizeAmisLang('vi')).toBe('vi');
    expect(normalizeAmisLang('en')).toBe('en');
    expect(normalizeAmisLang('EN')).toBe('en');
    expect(normalizeAmisLang('vi-VN')).toBe('vi');
    expect(normalizeAmisLang('en_US')).toBe('en');
  });

  it('giá trị lạ ⇒ fallback về en', () => {
    expect(normalizeAmisLang('ja')).toBe('en');
    expect(normalizeAmisLang('zh-CN')).toBe('en');
    expect(normalizeAmisLang('xxx')).toBe('en');
  });

  it('KHÔNG truyền lang ⇒ trả rỗng, app giữ nguyên ngôn ngữ đang dùng', () => {
    expect(normalizeAmisLang('')).toBe('');
    expect(normalizeAmisLang(undefined)).toBe('');
    expect(normalizeAmisLang(null)).toBe('');
  });

  it('tách khỏi URL và KHÔNG để sót trong URL lưu lâu dài', () => {
    const {cleanUrl, lang} = splitAmisParams(
      'https://abc.vn/auth/saas/index.php?sid=A&tenantid=T1&lang=en',
    );
    expect(lang).toBe('en');
    // Nếu lang còn nằm trong URL đã lưu thì ContentView sẽ luôn tôn trọng giá
    // trị cũ đó, người dùng đổi ngôn ngữ trong app sẽ không có tác dụng.
    expect(cleanUrl).toBe('https://abc.vn/auth/saas/index.php');
  });

  it('đọc được từ query của chính deep link', () => {
    expect(readAmisRouteParams({sid: 'A', lang: 'VI'}).lang).toBe('vi');
    expect(readAmisRouteParams({sid: 'A', lang: 'ja'}).lang).toBe('en');
    expect(readAmisRouteParams({sid: 'A'}).lang).toBe('');
  });

  it('luồng đầy đủ: lang đi vào URL nạp WebView, không đi vào URL lưu', () => {
    const {cleanUrl, sid, tenantid, lang} = splitAmisParams(
      'https://abc.vn/auth/saas/index.php?sid=A1&tenantid=T1&lang=vi',
    );
    const sessionUrl = withAmisParams(cleanUrl, {sid, tenantid, lang});
    expect(cleanUrl).not.toContain('lang=');
    expect(sessionUrl).toContain('lang=vi');
  });
});

describe('luồng deep link đầy đủ (như trong App.tsx)', () => {
  // Đúng chuỗi bước App.tsx đang chạy khi deep link có sid.
  const runFlow = decoded => {
    const fromUrl = splitAmisParams(decoded);
    const {cleanUrl, sid, tenantid} = fromUrl;
    const baseUrl = sid
      ? toSaasLoginUrl(cleanUrl)
      : normalizeLegacyMisaUrl(cleanUrl);
    return {baseUrl, sessionUrl: withAmisParams(baseUrl, {sid, tenantid, lang: fromUrl.lang})};
  };

  // AMIS gửi URL KHÔNG chứa auth/saas nhưng có sid — trước đây sid bị nuốt mất.
  it('bản MISA JSC: URL lưu lâu dài sạch sid, URL nạp WebView vẫn có sid', () => {
    const {baseUrl, sessionUrl} = runFlow(
      'https://misajsc.amis.vn/lms/login/index.php?sid=ABC123&tenantid=T9',
    );
    expect(baseUrl).toContain('/lms/auth/saas/index.php');
    expect(hasAmisSid(baseUrl)).toBe(false); // ← bản ghi vào MMKV
    expect(hasAmisSid(sessionUrl)).toBe(true); // ← bản nạp WebView
    expect(sessionUrl).toContain('tenantid=T9');
  });

  // HÌNH DẠNG SẼ DÙNG KHI TRIỂN KHAI: AMIS đưa thẳng URL auth/saas, app không
  // phải suy wwwroot. deriveWwwroot chỉ còn là lưới đỡ cho các dạng URL khác.
  it('AMIS gửi thẳng URL auth/saas — app dùng nguyên, không suy đoán gì', () => {
    const {baseUrl, sessionUrl} = runFlow(
      'https://misajsc.amis.vn/lms/auth/saas/index.php?sid=ABC123&tenantid=T001',
    );
    // Không dư dấu '?' sau khi gỡ sid/tenantid.
    expect(baseUrl).toBe('https://misajsc.amis.vn/lms/auth/saas/index.php');
    expect(sessionUrl).toContain('sid=ABC123');
    expect(sessionUrl).toContain('tenantid=T001');
  });

  it('AMIS gửi thẳng URL auth/saas — site cài ở gốc domain', () => {
    const {baseUrl} = runFlow(
      'https://elearning.khachhang.vn/auth/saas/index.php?sid=XYZ&tenantid=T2',
    );
    expect(baseUrl).toBe('https://elearning.khachhang.vn/auth/saas/index.php');
  });

  it('bản khách hàng khác: domain riêng, KHÔNG có sub-path lms', () => {
    const {baseUrl, sessionUrl} = runFlow(
      'https://elearning.khachhang.vn/login/index.php?sid=XYZ&tenantid=T2',
    );
    expect(baseUrl).toBe('https://elearning.khachhang.vn/auth/saas/index.php');
    expect(baseUrl).not.toContain('misajsc');
    expect(hasAmisSid(baseUrl)).toBe(false);
    expect(sessionUrl).toContain('sid=XYZ');
  });

  it('deep link cũ không kèm sid: hành vi không đổi', () => {
    const raw = 'https://lms.example.com/login/index.php?applms=true';
    const {baseUrl, sessionUrl} = runFlow(raw);
    expect(baseUrl).toBe(raw);
    expect(sessionUrl).toBe(raw);
  });

  // Chính xác deep link AMIS đang gọi hôm nay:
  // vnrlms://applms/home/https%3A%2F%2Fmisajsc.amis.vn%2Flms%2Flogin%2Findex.php
  it('KHÔNG hồi quy deep link AMIS đang chạy hiện tại', () => {
    const decoded = decodeURIComponent(
      'https%3A%2F%2Fmisajsc.amis.vn%2Flms%2Flogin%2Findex.php',
    );
    const {baseUrl, sessionUrl} = runFlow(decoded);
    // Đúng y chuỗi mà bản cũ (hard-code) tạo ra.
    expect(baseUrl).toBe('https://misajsc.amis.vn/lms/auth/saas/index.php');
    expect(sessionUrl).toBe(baseUrl);
  });
});

describe('isFromAmisApp — phiên có vào từ app AMIS không', () => {
  it('có tham số định danh của AMIS ⇒ true', () => {
    expect(isFromAmisApp({sid: 'A1'})).toBe(true);
    expect(isFromAmisApp({tenantid: 'T1'})).toBe(true);
    expect(isFromAmisApp({userid: 'U1'})).toBe(true);
  });

  it('chỉ có lang ⇒ false (lang không định danh nguồn gọi)', () => {
    expect(isFromAmisApp({lang: 'vi'})).toBe(false);
  });

  it('deep link cũ không kèm tham số ⇒ false', () => {
    expect(isFromAmisApp({})).toBe(false);
    expect(isFromAmisApp(undefined)).toBe(false);
    expect(
      isFromAmisApp(
        splitAmisParams('https://misajsc.amis.vn/lms/login/index.php'),
      ),
    ).toBe(false);
  });

  it('nhận trực tiếp kết quả của splitAmisParams', () => {
    expect(
      isFromAmisApp(
        splitAmisParams(
          'https://elearning.vnresource.net/auth/saas/index.php?sid=A1&tenantid=T1&lang=vi',
        ),
      ),
    ).toBe(true);
  });
});

describe('userid — tham số optional, dành cho về sau', () => {
  it('tách ra và chuyển tiếp sang URL nạp WebView', () => {
    const {cleanUrl, sid, tenantid, lang, userid} = splitAmisParams(
      'https://elearning.vnresource.net/auth/saas/index.php?sid=A1&tenantid=T1&lang=vi&userid=U12345',
    );
    expect(userid).toBe('U12345');
    // Không để sót trong URL lưu lâu dài: userid gắn với một người dùng cụ thể,
    // giữ lại rồi dùng cho người khác là sai dữ liệu.
    expect(cleanUrl).toBe('https://elearning.vnresource.net/auth/saas/index.php');
    expect(withAmisParams(cleanUrl, {sid, tenantid, lang, userid})).toContain(
      'userid=U12345',
    );
  });

  it('không truyền userid ⇒ rỗng, không thêm vào URL', () => {
    const r = splitAmisParams(
      'https://elearning.vnresource.net/auth/saas/index.php?sid=A1&tenantid=T1',
    );
    expect(r.userid).toBe('');
    expect(withAmisParams(r.cleanUrl, r)).not.toContain('userid');
  });

  it('deep link CHỈ có userid vẫn được làm sạch đúng', () => {
    const {cleanUrl, userid} = splitAmisParams(
      'https://elearning.vnresource.net/auth/saas/index.php?userid=U9',
    );
    expect(userid).toBe('U9');
    expect(cleanUrl).toBe('https://elearning.vnresource.net/auth/saas/index.php');
  });

  it('đọc được từ query của chính deep link, không phân biệt hoa thường', () => {
    expect(readAmisRouteParams({UserID: 'U777'}).userid).toBe('U777');
    expect(readAmisRouteParams({sid: 'A'}).userid).toBe('');
  });
});

describe('sid dài — không có giới hạn ký tự nào phía app', () => {
  // sid thật có thể dài hàng nghìn ký tự. Không hàm nào cắt/giới hạn độ dài.
  const longSid = 'A1b2C3d4'.repeat(512); // 4096 ký tự
  const longTenant = 'T'.repeat(256);

  it('tách và ghép lại nguyên vẹn sid 4096 ký tự', () => {
    const target = `https://misajsc.amis.vn/lms/auth/saas/index.php?sid=${longSid}&tenantid=${longTenant}`;
    const {cleanUrl, sid, tenantid} = splitAmisParams(target);

    expect(sid).toHaveLength(4096);
    expect(sid).toBe(longSid); // nguyên vẹn, không bị cắt
    expect(tenantid).toBe(longTenant);
    expect(cleanUrl).toBe('https://misajsc.amis.vn/lms/auth/saas/index.php');

    const sessionUrl = withAmisParams(cleanUrl, {sid, tenantid});
    expect(hasAmisSid(sessionUrl)).toBe(true);
    // Đọc ngược lại vẫn khớp từng ký tự.
    expect(splitAmisParams(sessionUrl).sid).toBe(longSid);
  });

  it('sid chứa ký tự cần encode vẫn khôi phục đúng qua vòng encode deep link', () => {
    const trickySid = 'ab+cd/ef=gh ij&kl';
    const target = `https://abc.vn/auth/saas/index.php?sid=${encodeURIComponent(
      trickySid,
    )}&tenantid=T1`;
    // Mô phỏng đúng vòng đời: encode vào deep link -> app decodeURIComponent.
    const decodedByApp = decodeURIComponent(encodeURIComponent(target));
    expect(splitAmisParams(decodedByApp).sid).toBe(trickySid);
  });
});

// Dán nguyên chuỗi deep link trong docs/spec-deeplink-amis-gui-misa.md §3.1.
// Mục đích: ví dụ trong tài liệu gửi MISA và hành vi code không được lệch nhau.
describe('ví dụ trong spec gửi MISA (§3.1)', () => {
    const runDeepLink = deeplink => {
        // Mô phỏng App.tsx: lấy segment sau 'home/' rồi decodeURIComponent.
        const encoded = deeplink.replace('vnrlms://applms/home/', '');
        const fromUrl = splitAmisParams(decodeURIComponent(encoded));
        const baseUrl = fromUrl.sid
            ? toSaasLoginUrl(fromUrl.cleanUrl)
            : normalizeLegacyMisaUrl(fromUrl.cleanUrl);
        return {...fromUrl, baseUrl, sessionUrl: withAmisParams(baseUrl, fromUrl)};
    };

  it('① MISA JSC — sub-path /lms, lang=vi', () => {
    const r = runDeepLink(
      'vnrlms://applms/home/https%3A%2F%2Fmisajsc.amis.vn%2Flms%2Fauth%2Fsaas%2Findex.php%3Fsid%3DABC123%26tenantid%3DT001%26lang%3Dvi',
    );
    expect(r.sid).toBe('ABC123');
    expect(r.tenantid).toBe('T001');
    expect(r.lang).toBe('vi');
    expect(r.baseUrl).toBe('https://misajsc.amis.vn/lms/auth/saas/index.php');
    expect(r.sessionUrl).toContain('lang=vi');
  });

  it('② VNR — site cài ở gốc domain', () => {
    const r = runDeepLink(
      'vnrlms://applms/home/https%3A%2F%2Felearning.vnresource.net%2Fauth%2Fsaas%2Findex.php%3Fsid%3DXYZ789%26tenantid%3DT002%26lang%3Dvi',
    );
    expect(r.sid).toBe('XYZ789');
    expect(r.tenantid).toBe('T002');
    expect(r.lang).toBe('vi');
    expect(r.baseUrl).toBe('https://elearning.vnresource.net/auth/saas/index.php');
    expect(r.sessionUrl).toContain('lang=vi');
  });

  it('③ Biến thể không truyền lang ⇒ không ép ngôn ngữ', () => {
    const r = runDeepLink(
      'vnrlms://applms/home/https%3A%2F%2Felearning.vnresource.net%2Fauth%2Fsaas%2Findex.php%3Fsid%3DXYZ789%26tenantid%3DT002',
    );
    expect(r.lang).toBe('');
    expect(r.sessionUrl).not.toContain('lang=');
  });
});

describe('readAmisRouteParams — AMIS gắn sid ở query của chính deep link', () => {
  it('đọc được sid/tenantid từ route params', () => {
    const {sid, tenantid} = readAmisRouteParams({
      url: 'https%3A%2F%2Fmisajsc.amis.vn%2Flms%2Flogin%2Findex.php',
      sid: 'ABC',
      tenantid: 'T1',
    });
    expect(sid).toBe('ABC');
    expect(tenantid).toBe('T1');
  });

  it('không phân biệt hoa thường', () => {
    const {sid, tenantid} = readAmisRouteParams({SID: 'ABC', TenantID: 'T1'});
    expect(sid).toBe('ABC');
    expect(tenantid).toBe('T1');
  });

  it('an toàn với params rỗng / không phải chuỗi', () => {
    expect(readAmisRouteParams(undefined)).toEqual({
      sid: '',
      tenantid: '',
      lang: '',
      userid: '',
    });
    expect(readAmisRouteParams({sid: 123})).toEqual({
      sid: '',
      tenantid: '',
      lang: '',
      userid: '',
    });
  });
});
