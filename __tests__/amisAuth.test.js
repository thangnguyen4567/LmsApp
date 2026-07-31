/**
 * Test cho vỏ bọc kịch bản A (LMS tự xin token từ app AMIS).
 *
 * Trọng tâm là các hàm THUẦN — phân loại deep link, cây quyết định lúc khởi
 * động, đối chiếu `state` — vì đó là chỗ sai thì hỏng âm thầm, không có
 * exception nào để lần ra.
 */

const mockStore = {};

jest.mock('../src/components/AsyncStorage', () => ({
    saveData: jest.fn((key, value) => {
        mockStore[key] = String(value);
        return Promise.resolve();
    }),
    getData: jest.fn(key =>
        Promise.resolve(
            Object.prototype.hasOwnProperty.call(mockStore, key)
                ? mockStore[key]
                : null,
        ),
    ),
    deleteData: jest.fn(key => {
        delete mockStore[key];
        return Promise.resolve();
    }),
}));

const {
    AMIS_APP,
    AMIS_DEBUG,
    AMIS_DETECT,
    AMIS_KEYS,
    AMIS_MOCK,
    AMIS_TIMING,
    LOOKUP_ERROR,
    VNR_TENANT_LOOKUP,
    canDetectAmisInstalled,
    canRetryAfter,
    errorMessageKey,
    isAlertOnlyError,
    getAmisBaseUrl,
    getAmisReturnUrl,
    getCallbackUrl,
    isAmisConfigured,
    isTenantLookupConfigured,
    joinAmisUrl,
    shouldShowAmisLoginButton,
} = require('../src/services/amisConfig');

const {
    hasAmisSid,
    readAmisSid,
    readAmisTenantId,
} = require('../src/components/amisDeepLink');

const {
    LINK_TYPE,
    buildGetTokenUrl,
    classifyCallbackError,
    clearAmisSession,
    generateState,
    lookupTenant,
    normalizeLookupError,
    parseAmisLink,
    rememberState,
    requestTokenKey,
    shouldAutoRequestToken,
    verifyState,
} = require('../src/services/amisAuth');

const {
    LAUNCH_ACTION,
    decideLaunchAction,
    isCallbackTimedOut,
} = require('../src/services/amisLaunchFlow');

// Giá trị production MISA đã cấp — chụp lại để khôi phục sau mỗi test có sửa.
const REAL = {
    scheme: AMIS_APP.scheme,
    androidUrl: AMIS_APP.androidUrl,
    returnPath: {...AMIS_APP.returnPath},
};

beforeEach(() => {
    Object.keys(mockStore).forEach(key => delete mockStore[key]);
    AMIS_APP.scheme = REAL.scheme;
    AMIS_APP.androidUrl = REAL.androidUrl;
    AMIS_APP.returnPath = {...REAL.returnPath};
    AMIS_APP.schemeTest = '';
    AMIS_MOCK.failWith = '';
    AMIS_MOCK.delayMs = 0;
});

// Jest chạy với Platform.OS = 'ios', nên các test dưới đây đi nhánh custom scheme.
describe('amisConfig — thông tin production MISA đã cấp', () => {
    test('iOS dùng custom scheme misa.amis.vn://', () => {
        expect(AMIS_APP.scheme).toBe('misa.amis.vn');
        expect(isAmisConfigured()).toBe(true);
        expect(getAmisBaseUrl()).toBe('misa.amis.vn://');
    });

    test('Android: mở bằng App Link https, dò bằng package name', () => {
        expect(AMIS_APP.androidUrl).toBe('https://misajsc.amis.vn');
        expect(AMIS_APP.androidPackage).toBe('vn.com.misa.amis');
    });

    test('có returnPath thì mở đúng màn AMIS chỉ định', () => {
        AMIS_APP.returnPath = {ios: 'home', android: 'home'};
        expect(getAmisReturnUrl()).toBe('misa.amis.vn://home');
    });

    test('joinAmisUrl xử lý đúng dấu / cho cả hai dạng gốc URL', () => {
        expect(joinAmisUrl('lms')).toBe('misa.amis.vn://lms');
        expect(joinAmisUrl('')).toBe('misa.amis.vn://');
    });

    test('iOS dò được app AMIS bằng custom scheme', () => {
        expect(canDetectAmisInstalled()).toBe(true);
    });

    /**
     * 🔒 BA CHUỖI CHỐT với MISA. Khoá lại từng ký tự: đổi mà quên báo bên họ là
     * hai app lệch nhau, mà biểu hiện chỉ là "bấm không thấy gì xảy ra" — không
     * có exception nào để lần ra.
     */
    describe('chuỗi deep link đã chốt với MISA', () => {
        const {Platform} = require('react-native');
        const realOS = Platform.OS;
        afterEach(() => {
            Platform.OS = realOS;
        });

        test('① LMS xin quyền: có source, KHÔNG có gì khác', () => {
            Platform.OS = 'ios';
            expect(buildGetTokenUrl()).toBe(
                'misa.amis.vn://lms?source=ailearning',
            );

            Platform.OS = 'android';
            expect(buildGetTokenUrl()).toBe(
                'https://misajsc.amis.vn/lms?source=ailearning',
            );
            // Android còn khoá intent vào đúng package AMIS, xem AmisDetectModule.kt
            expect(AMIS_APP.androidPackage).toBe('vn.com.misa.amis');
        });

        test('② AMIS gọi về LMS', () => {
            expect(getCallbackUrl()).toBe('vnrlms://applms/amis-callback');
        });

        test('③ LMS quay về AMIS — iOS không path, Android phải /lms', () => {
            Platform.OS = 'ios';
            expect(getAmisReturnUrl()).toBe('misa.amis.vn://');

            Platform.OS = 'android';
            expect(getAmisReturnUrl()).toBe('https://misajsc.amis.vn/lms');
        });
    });
});

/**
 * Định danh AMIS phải khai ĐÚNG HAI CHỖ: file config (JS) và file native.
 * Lệch nhau thì hỏng âm thầm — `canOpenURL`/`getPackageInfo` chỉ trả "chưa cài"
 * chứ không có exception nào để lần ra. Chốt lại bằng test cho chắc.
 */
describe('cấu hình JS phải khớp khai báo native', () => {
    const fs = require('fs');
    const path = require('path');
    const read = rel =>
        fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

    test('AndroidManifest khai <queries><package> đúng package name', () => {
        const manifest = read('android/app/src/main/AndroidManifest.xml');
        expect(manifest).toContain('<queries>');
        expect(manifest).toContain(
            '<package android:name="' + AMIS_APP.androidPackage + '" />',
        );
    });

    test('Info.plist khai LSApplicationQueriesSchemes đúng scheme iOS', () => {
        const plist = read('ios/LMS/Info.plist');
        const key = plist.indexOf('<key>LSApplicationQueriesSchemes</key>');
        expect(key).toBeGreaterThan(-1);
        // Phải nằm NGOÀI vùng comment, nếu không iOS bỏ qua như chưa khai.
        // Nằm trong comment = có '<!--' trước đó mà chưa được '-->' đóng lại.
        const opened = plist.lastIndexOf('<!--', key);
        const closed = plist.lastIndexOf('-->', key);
        const insideComment = opened > -1 && opened > closed;
        expect(insideComment).toBe(false);
        expect(plist.slice(key, key + 200)).toContain(
            '<string>' + AMIS_APP.scheme + '</string>',
        );
    });

    test('module native được đăng ký trong MainApplication', () => {
        const main = read(
            'android/app/src/main/java/com/lms/MainApplication.kt',
        );
        expect(main).toContain('add(AmisDetectPackage())');
    });
});

describe('amisConfig — trạng thái CHƯA điền thông tin', () => {
    beforeEach(() => {
        AMIS_APP.scheme = '';
        AMIS_APP.androidUrl = '';
    });

    test('không có gì thì mọi thứ tự ngủ, không bật nửa vời', () => {
        expect(isAmisConfigured()).toBe(false);
        expect(getAmisReturnUrl()).toBe('');
        expect(buildGetTokenUrl({state: 'abc'})).toBe('');
        expect(canDetectAmisInstalled()).toBe(false);
    });

    test('chỉ có bản test thì vẫn dùng được', () => {
        AMIS_APP.schemeTest = 'amistest';
        expect(isAmisConfigured()).toBe(true);
        expect(getAmisReturnUrl()).toBe('amistest://');
    });
});

describe('buildGetTokenUrl', () => {
    beforeEach(() => {
        AMIS_APP.scheme = 'amis';
    });

    /**
     * MISA chốt: chỉ nhận `source`. Bốn tham số kiểu OAuth còn lại vẫn có chỗ
     * trong config nhưng để tên rỗng — các test dưới khoá đúng điều đó, để lỡ ai
     * điền lại một cái vì tưởng là thiếu thì biết ngay là sai hợp đồng.
     */
    test('KHÔNG gửi redirect_uri (AMIS không nhận qua tham số)', () => {
        expect(buildGetTokenUrl()).not.toContain('redirect_uri');
        // Đường về vẫn phải công bố được — chỉ là gửi cho MISA bằng tài liệu.
        expect(getCallbackUrl()).toBe('vnrlms://applms/amis-callback');
    });

    test('KHÔNG gửi state, dù bên gọi có truyền vào', () => {
        expect(buildGetTokenUrl({state: 'STATE123'})).not.toContain('state');
    });

    test('KHÔNG gửi lang và client_id', () => {
        const url = buildGetTokenUrl({state: 'S', lang: 'vi'});
        expect(url).not.toContain('lang=');
        expect(url).not.toContain('client_id=');
    });

    test('MISA đổi ý thì điền lại tên tham số là chạy, không sửa code', () => {
        const {AMIS_GETTOKEN} = require('../src/services/amisConfig');
        const real = {...AMIS_GETTOKEN.params};
        try {
            AMIS_GETTOKEN.params.state = 'state';
            AMIS_GETTOKEN.params.redirectUri = 'redirect_uri';
            const url = buildGetTokenUrl({state: 'STATE123'});
            expect(url).toContain('state=STATE123');
            expect(url).toContain(
                'redirect_uri=' +
                    encodeURIComponent('vnrlms://applms/amis-callback'),
            );
        } finally {
            AMIS_GETTOKEN.params = real;
        }
    });
});

describe('parseAmisLink — phân loại deep link vào app', () => {
    test('chuỗi rỗng / không phải scheme của app -> unknown', () => {
        expect(parseAmisLink('').type).toBe(LINK_TYPE.UNKNOWN);
        expect(parseAmisLink('https://misajsc.amis.vn/lms').type).toBe(
            LINK_TYPE.UNKNOWN,
        );
        expect(parseAmisLink('amis://get-token?token=X').type).toBe(
            LINK_TYPE.UNKNOWN,
        );
    });

    test('deep link kịch bản B nhận diện là HOME, KHÔNG bóc tách', () => {
        const link =
            'vnrlms://applms/home/https%3A%2F%2Fmisajsc.amis.vn%2Flms%2Fauth%2Fsaas%2Findex.php%3Fsid%3DABC';
        const parsed = parseAmisLink(link);
        expect(parsed.type).toBe(LINK_TYPE.HOME);
        // Quan trọng: không được cầm nhầm sid của kịch bản B, nếu không luồng
        // deep link sẽ bị xử lý hai lần ở hai nơi.
        expect(parsed.sid).toBe('');
    });

    test('callback đầy đủ tham số', () => {
        const parsed = parseAmisLink(
            'vnrlms://applms/amis-callback?token=TK1&sid=SID1&tenantid=T001&userid=U9&lang=vi&state=ST',
        );
        expect(parsed.type).toBe(LINK_TYPE.CALLBACK);
        expect(parsed.tokenKey).toBe('TK1');
        expect(parsed.sid).toBe('SID1');
        expect(parsed.tenantid).toBe('T001');
        expect(parsed.userid).toBe('U9');
        expect(parsed.lang).toBe('vi');
        expect(parsed.state).toBe('ST');
        expect(parsed.error).toBe('');
    });

    test('tên tham số không phân biệt hoa thường', () => {
        const parsed = parseAmisLink(
            'vnrlms://applms/amis-callback?Token=TK1&TenantID=T001&State=ST',
        );
        expect(parsed.tokenKey).toBe('TK1');
        expect(parsed.tenantid).toBe('T001');
        expect(parsed.state).toBe('ST');
    });

    test('giá trị được percent-decode', () => {
        const parsed = parseAmisLink(
            'vnrlms://applms/amis-callback?token=' + encodeURIComponent('a+b/c=='),
        );
        expect(parsed.tokenKey).toBe('a+b/c==');
    });

    test('trùng khoá thì lấy giá trị ĐẦU TIÊN (chống nối thêm tham số ở cuối)', () => {
        const parsed = parseAmisLink(
            'vnrlms://applms/amis-callback?token=THAT&token=GIA',
        );
        expect(parsed.tokenKey).toBe('THAT');
    });

    test('dấu / thừa ở cuối path vẫn nhận', () => {
        expect(parseAmisLink('vnrlms://applms/amis-callback/?token=X').type).toBe(
            LINK_TYPE.CALLBACK,
        );
    });

    test('callback báo lỗi từ chối cấp quyền', () => {
        const parsed = parseAmisLink(
            'vnrlms://applms/amis-callback?error=access_denied&state=ST',
        );
        expect(parsed.type).toBe(LINK_TYPE.CALLBACK);
        expect(parsed.error).toBe('access_denied');
        expect(parsed.tokenKey).toBe('');
    });

    test('deep link `home` TRỐNG (không có URL đích) vẫn là HOME', () => {
        // AMIS có thể gọi thẳng `vnrlms://applms/home` cho gọn. Phải nhận diện
        // được để không xử lý nhầm thành callback.
        expect(parseAmisLink('vnrlms://applms/home').type).toBe(LINK_TYPE.HOME);
        expect(parseAmisLink('vnrlms://applms/home/').type).toBe(LINK_TYPE.HOME);
    });

    test('path lạ -> unknown, không nhận nhầm thành callback', () => {
        expect(parseAmisLink('vnrlms://applms/whatever?token=X').type).toBe(
            LINK_TYPE.UNKNOWN,
        );
    });

    test('sid dài không bị cắt', () => {
        const long = 'S'.repeat(4096);
        const parsed = parseAmisLink(
            'vnrlms://applms/amis-callback?sid=' + long,
        );
        expect(parsed.sid).toHaveLength(4096);
    });
});

describe('classifyCallbackError / normalizeLookupError', () => {
    test('phân biệt "người dùng từ chối" với lỗi kỹ thuật', () => {
        expect(classifyCallbackError('access_denied')).toBe(LOOKUP_ERROR.DENIED);
        expect(classifyCallbackError('USER_CANCELLED')).toBe(
            LOOKUP_ERROR.DENIED,
        );
        expect(classifyCallbackError('token_expired')).toBe(
            LOOKUP_ERROR.EXPIRED,
        );
        expect(classifyCallbackError('something_else')).toBe(
            LOOKUP_ERROR.UNKNOWN,
        );
        expect(classifyCallbackError('')).toBe('');
    });

    test('mã lỗi BE lạ vẫn ra một mã hợp lệ, không undefined', () => {
        expect(normalizeLookupError('NOT_FOUND')).toBe(LOOKUP_ERROR.NOTFOUND);
        expect(normalizeLookupError('xyz')).toBe(LOOKUP_ERROR.UNKNOWN);
        expect(normalizeLookupError(null)).toBe(LOOKUP_ERROR.UNKNOWN);
    });
});

describe('requestTokenKey — mở AMIS xin quyền', () => {
    test('gửi đúng chuỗi đã chốt, KHÔNG sinh state vô ích', async () => {
        const res = await requestTokenKey({lang: 'vi'});
        expect(res.ok).toBe(true);
        expect(res.url).toBe('misa.amis.vn://lms?source=ailearning');
        // MISA không đối chiếu state ⇒ sinh rồi để đó chỉ làm rác storage và
        // gây hiểu nhầm cho người đọc MMKV lúc gỡ lỗi.
        expect(mockStore[AMIS_KEYS.state]).toBeUndefined();
        expect(mockStore[AMIS_KEYS.stateAt]).toBeUndefined();
        // Mốc thời gian thử thì vẫn phải ghi — backoff dựa vào nó khi bật lại.
        expect(mockStore[AMIS_KEYS.attemptedAt]).toBeTruthy();
    });
});

/**
 * 🚧 Cờ gỡ lỗi (amisConfig mục 5b). Test ở đây không phải để khoá giá trị `true`
 * — nó sẽ được tắt khi có endpoint — mà để khoá HỆ QUẢ: bật Alert phải đủ điều
 * kiện cho `startAmisLogin` mở AMIS, nếu không thì không bao giờ thấy Alert.
 */
describe('cờ gỡ lỗi tạm thời', () => {
    test('có endpoint thật là đủ, không phụ thuộc mock hay cờ gỡ lỗi', () => {
        const realMock = AMIS_MOCK.enabled;
        const realAlert = AMIS_DEBUG.alertCallbackParams;
        try {
            AMIS_MOCK.enabled = false;
            AMIS_DEBUG.alertCallbackParams = false;
            expect(VNR_TENANT_LOOKUP.url).toBeTruthy();
            expect(isTenantLookupConfigured()).toBe(true);
        } finally {
            AMIS_MOCK.enabled = realMock;
            AMIS_DEBUG.alertCallbackParams = realAlert;
        }
    });

    test('mất endpoint thì Alert vẫn đủ để mở AMIS mà soi callback', () => {
        const realMock = AMIS_MOCK.enabled;
        const realAlert = AMIS_DEBUG.alertCallbackParams;
        const realUrl = VNR_TENANT_LOOKUP.url;
        try {
            AMIS_MOCK.enabled = false;
            VNR_TENANT_LOOKUP.url = '';

            AMIS_DEBUG.alertCallbackParams = true;
            expect(isTenantLookupConfigured()).toBe(true);

            // Tắt cả ba đường thì phải chặn từ đầu, không mở AMIS rồi mắc kẹt.
            AMIS_DEBUG.alertCallbackParams = false;
            expect(isTenantLookupConfigured()).toBe(false);
        } finally {
            AMIS_MOCK.enabled = realMock;
            AMIS_DEBUG.alertCallbackParams = realAlert;
            VNR_TENANT_LOOKUP.url = realUrl;
        }
    });
});

describe('state — chống callback giả mạo / lặp', () => {
    test('sinh chuỗi đủ dài và khác nhau giữa các lần', () => {
        const a = generateState();
        const b = generateState();
        expect(a).toHaveLength(32);
        expect(a).not.toBe(b);
    });

    test('state đúng và còn hạn -> hợp lệ', async () => {
        await rememberState('ST1');
        await expect(verifyState('ST1')).resolves.toBe(true);
    });

    test('state sai -> từ chối', async () => {
        await rememberState('ST1');
        await expect(verifyState('KHAC')).resolves.toBe(false);
    });

    test('không có state đã lưu -> từ chối', async () => {
        await expect(verifyState('ST1')).resolves.toBe(false);
    });

    test('quá TTL -> từ chối', async () => {
        await rememberState('ST1');
        const future = Date.now() + AMIS_TIMING.stateTtlMs + 1000;
        await expect(verifyState('ST1', future)).resolves.toBe(false);
    });

    test('dùng đúng MỘT lần — callback thứ hai bị từ chối', async () => {
        await rememberState('ST1');
        await expect(verifyState('ST1')).resolves.toBe(true);
        await expect(verifyState('ST1')).resolves.toBe(false);
    });

    test('sai state cũng phải xoá, không để thử lại nhiều lần', async () => {
        await rememberState('ST1');
        await verifyState('SAI');
        expect(mockStore[AMIS_KEYS.state]).toBeUndefined();
    });
});

// ⏸️ `shouldAutoRequestToken` hiện KHÔNG được gọi trong luồng khởi động — nghiệp
// vụ chốt là không chặn. Vẫn giữ test để hàm không mục nát nếu sau này bật lại.
describe('backoff chống ping-pong giữa hai app (hiện không dùng)', () => {
    test('chưa từng thử -> cho phép tự động', async () => {
        await expect(shouldAutoRequestToken()).resolves.toBe(true);
    });

    test('vừa thử xong -> KHÔNG tự động gửi lại', async () => {
        mockStore[AMIS_KEYS.attemptedAt] = String(Date.now());
        await expect(shouldAutoRequestToken()).resolves.toBe(false);
    });

    test('quá thời hạn backoff -> cho phép lại', async () => {
        mockStore[AMIS_KEYS.attemptedAt] = String(Date.now());
        const future = Date.now() + AMIS_TIMING.retryBackoffMs + 1000;
        await expect(shouldAutoRequestToken(future)).resolves.toBe(true);
    });
});

describe('decideLaunchAction — cây quyết định lúc khởi động', () => {
    const base = {
        initialUrl: '',
        storedUrl: '',
        storedSaas: '',
        amisDetection: AMIS_DETECT.YES,
        canAutoRequest: true,
    };

    test('(1) có deep link -> đi luồng deep link, KHÔNG đụng AMIS', () => {
        // Bẫy race condition: thiếu nhánh này thì app vừa được AMIS mở bằng deep
        // link đã lập tức nhảy ngược sang AMIS -> người dùng bị đá qua đá lại.
        const r = decideLaunchAction({
            ...base,
            initialUrl: 'vnrlms://applms/home/https%3A%2F%2Fx.vn',
        });
        expect(r.action).toBe(LAUNCH_ACTION.DEEP_LINK);
    });

    test('(2) đã có url đã lưu -> đăng nhập như thường', () => {
        const r = decideLaunchAction({
            ...base,
            storedUrl: 'https://misajsc.amis.vn/lms',
        });
        expect(r.action).toBe(LAUNCH_ACTION.EXISTING_SESSION);
    });

    test('(2b) chỉ có saas_userdata cũng đủ để không đụng AMIS', () => {
        const r = decideLaunchAction({...base, storedSaas: 'abc'});
        expect(r.action).toBe(LAUNCH_ACTION.EXISTING_SESSION);
    });

    test('(3) máy không có AMIS -> về Welcome', () => {
        const r = decideLaunchAction({
            ...base,
            amisDetection: AMIS_DETECT.NO,
        });
        expect(r.action).toBe(LAUNCH_ACTION.WELCOME);
    });

    test('(3b) KHÔNG DÒ ĐƯỢC (Android) -> Welcome, TUYỆT ĐỐI không tự mở AMIS', () => {
        // MISA chỉ cấp App Link https nên Android không biết máy có AMIS không.
        // Đoán bừa rồi tự mở = ném người dùng chưa cài AMIS vào trình duyệt.
        const r = decideLaunchAction({
            ...base,
            amisDetection: AMIS_DETECT.UNKNOWN,
        });
        expect(r.action).toBe(LAUNCH_ACTION.WELCOME);
        expect(r.reason).toBe('khong-do-duoc-amis');
    });

    test('(4) ⏸️ backoff ĐÃ TẮT — vừa thất bại vẫn tự động thử lại ngay', () => {
        // Nghiệp vụ chốt: máy trắng thông tin + có AMIS ⇒ mở app là sang AMIS,
        // không chặn lại. Test khoá đúng điều đó — bật backoff lại thì test SẼ
        // ĐỎ, đúng chủ đích, đổi kỳ vọng thành WELCOME là xong.
        const r = decideLaunchAction({...base, canAutoRequest: false});
        expect(r.action).toBe(LAUNCH_ACTION.REQUEST_TOKEN);
    });

    test('(5) đủ điều kiện -> tự động xin token', () => {
        expect(decideLaunchAction(base).action).toBe(
            LAUNCH_ACTION.REQUEST_TOKEN,
        );
    });

    test('deep link được ưu tiên hơn mọi điều kiện khác', () => {
        const r = decideLaunchAction({
            ...base,
            initialUrl: 'vnrlms://applms/home/x',
            storedUrl: 'https://x.vn',
            amisDetection: AMIS_DETECT.NO,
            canAutoRequest: false,
        });
        expect(r.action).toBe(LAUNCH_ACTION.DEEP_LINK);
    });
});

describe('isCallbackTimedOut', () => {
    test('chưa bắt đầu chờ thì không bao giờ timeout', () => {
        expect(isCallbackTimedOut(0, Date.now())).toBe(false);
    });

    test('trong hạn -> chưa timeout', () => {
        const t0 = 1000;
        expect(isCallbackTimedOut(t0, t0 + 1000)).toBe(false);
    });

    test('quá hạn -> timeout', () => {
        const t0 = 1000;
        expect(
            isCallbackTimedOut(t0, t0 + AMIS_TIMING.callbackTimeoutMs + 1),
        ).toBe(true);
    });
});

describe('lookupTenant — nhánh MOCK (chỉ chạy khi chưa có endpoint)', () => {
    // Mock tự nhường đường cho endpoint thật, nên phải gỡ url ra mới test được.
    const realUrl = VNR_TENANT_LOOKUP.url;
    beforeEach(() => {
        VNR_TENANT_LOOKUP.url = '';
    });
    afterEach(() => {
        VNR_TENANT_LOOKUP.url = realUrl;
    });

    // MISA đã chốt: AMIS trả sid + tenantid + userid, KHÔNG có token key.
    // `tenantid` là thứ trang QL dùng để trả về URL site LMS.
    test('chỉ cần tenantid là tra được, không cần token key', async () => {
        const res = await lookupTenant({tenantid: 'T001', sid: 'S1'});
        expect(res.ok).toBe(true);
        expect(res.mocked).toBe(true);
        expect(res.link).toBe(AMIS_MOCK.response.link);
        expect(res.tenantid).toBe('T001');
    });

    test('tham số AMIS gửi sang được ưu tiên hơn dữ liệu giả', async () => {
        const res = await lookupTenant({
            sid: 'SID_THAT',
            tenantid: 'T999',
            userid: 'U7',
        });
        expect(res.sid).toBe('SID_THAT');
        expect(res.tenantid).toBe('T999');
        expect(res.userid).toBe('U7');
    });

    test('đặt failWith là thử được nhánh lỗi mà không cần BE', async () => {
        AMIS_MOCK.failWith = LOOKUP_ERROR.NOTFOUND;
        const res = await lookupTenant({tenantid: 'T001'});
        expect(res.ok).toBe(false);
        expect(res.error).toBe(LOOKUP_ERROR.NOTFOUND);
    });
});

/**
 * Hợp đồng với API QL Tenant thật:
 *   GET .../api/Tenant/GetByTenantId/<tenantid>
 *   {"IsSuccess":true,"Message":"Success","Data":{…,"Code":"…","Link":"https://…"}}
 *
 * Hai điểm dễ sai nhất, cả hai đều được khoá ở đây:
 * - Không tìm thấy tenant vẫn trả **HTTP 200**, chỉ đổi `IsSuccess:false`.
 * - `Message` mang "Success" lúc thành công, nên chỉ được đọc như lỗi SAU KHI
 *   `IsSuccess` đã false.
 *
 * Dùng `fetch` giả: đây là hợp đồng với BE, không phải với mock.
 */
describe('API QL Tenant — hợp đồng thật', () => {
    const realFetch = global.fetch;
    let lastCall = null;

    const answer = (body, status = 200) => {
        global.fetch = jest.fn((url, options) => {
            lastCall = {url, options};
            return Promise.resolve({
                ok: status >= 200 && status < 300,
                status,
                json: () => Promise.resolve(body),
            });
        });
    };

    // Bản sao rút gọn của response thật, giữ nguyên cách lồng.
    const okBody = (link = 'https://elearning.vnresource.net') => ({
        IsSuccess: true,
        Message: 'Success',
        Data: {Id: 141, Code: 'T-CODE', Status: 'UnActive', Link: link},
    });

    afterEach(() => {
        global.fetch = realFetch;
        lastCall = null;
    });

    test('gọi GET, tenantid nằm trong PATH, không kèm body', async () => {
        answer(okBody());
        await lookupTenant({tenantid: 'abc-123', sid: 'S1'});
        expect(lastCall.url).toBe(
            'https://lmsadminapi.vnresource.vn/api/Tenant/GetByTenantId/abc-123',
        );
        expect(lastCall.options.method).toBe('GET');
        // GET kèm body là sai chuẩn, một số proxy chặn thẳng.
        expect(lastCall.options.body).toBeUndefined();
    });

    test('tenantid lạ được encode, không phá cấu trúc đường dẫn', async () => {
        answer(okBody());
        await lookupTenant({tenantid: 'a/b?c=1'});
        expect(lastCall.url).toContain('GetByTenantId/a%2Fb%3Fc%3D1');
    });

    test('đọc được link lồng trong Data, sid lấy từ deep link', async () => {
        answer(okBody());
        const res = await lookupTenant({tenantid: 'T1', sid: 'SID_DEEPLINK'});
        expect(res.ok).toBe(true);
        expect(res.link).toBe('https://elearning.vnresource.net');
        expect(res.tenantid).toBe('T-CODE');
        // API không trả sid ⇒ phải giữ nguyên sid AMIS vừa gửi sang.
        expect(res.sid).toBe('SID_DEEPLINK');
    });

    test('Message="Success" KHÔNG được hiểu là lỗi', async () => {
        // Đọc `Message` trước khi xét `IsSuccess` thì chuyến nào cũng hỏng.
        answer(okBody());
        const res = await lookupTenant({tenantid: 'T1'});
        expect(res.ok).toBe(true);
    });

    const expectNotFound = async () => {
        const res = await lookupTenant({tenantid: 'T404'});
        expect(res.ok).toBe(false);
        expect(res.error).toBe(LOOKUP_ERROR.NOTFOUND);
    };

    test('IsSuccess:false + TenantNotFound (HTTP vẫn 200)', async () => {
        answer({IsSuccess: false, Message: 'TenantNotFound', Data: null});
        await expectNotFound();
    });

    test('404 — URL thiếu hẳn tenantid', async () => {
        answer({}, 404);
        await expectNotFound();
    });

    test('body rỗng/sai cấu trúc -> unknown, KHÔNG phải notfound', async () => {
        // Cố ý phân biệt: `IsSuccess:false + TenantNotFound` là câu trả lời hợp
        // lệ của API ⇒ ca nghiệp vụ "chưa cài đặt AILearning". Còn body không
        // đúng cấu trúc là API hỏng ⇒ báo lỗi kỹ thuật kèm nút Thử lại, chứ
        // đừng nói với người dùng rằng công ty họ chưa cài — vừa sai vừa là ngõ cụt.
        answer(null);
        const res = await lookupTenant({tenantid: 'T404'});
        expect(res.ok).toBe(false);
        expect(res.error).toBe(LOOKUP_ERROR.UNKNOWN);
    });

    test('IsSuccess:true nhưng Data KHÔNG có Link', async () => {
        answer({
            IsSuccess: true,
            Message: 'Success',
            Data: {Id: 1, Code: 'T1', Link: null},
        });
        await expectNotFound();
    });

    test('Link chỉ có khoảng trắng cũng coi như không có', async () => {
        // Bỏ `.trim()` thì ca này lọt qua, rồi WebView nạp ' /auth/saas/index.php'
        // — hỏng ở rất xa chỗ gây lỗi.
        answer(okBody('   '));
        await expectNotFound();
    });

    test('BE báo lỗi bằng chữ — nhận nhiều biến thể, không rơi vào unknown', async () => {
        const variants = [
            'NOT_FOUND',
            'tenant_not_exist',
            'TenantNotExist',
            'no_tenant',
            'NO_DATA',
        ];
        for (let i = 0; i < variants.length; i++) {
            expect(normalizeLookupError(variants[i])).toBe(
                LOOKUP_ERROR.NOTFOUND,
            );
        }
    });

});

/**
 * Hai cách báo lỗi khác nhau — chọn sai là hoặc bỏ sót thông báo, hoặc để người
 * dùng mắc ở màn hình không có đường ra.
 */
describe('cách báo lỗi: Alert-rồi-về-Welcome vs hộp lỗi tại chỗ', () => {
    test('chưa mở Elearning -> Alert rồi về Welcome', () => {
        // AMIS đã cấp quyền xong mà LMS không có link cho đơn vị ⇒ app hết việc
        // làm được: không có gì để thử lại, cũng không có gì để chờ.
        expect(isAlertOnlyError(LOOKUP_ERROR.NOTFOUND)).toBe(true);
    });

    test('các lỗi khác vẫn hiện hộp lỗi tại chỗ', () => {
        [
            LOOKUP_ERROR.CONFIG,
            LOOKUP_ERROR.DENIED,
            LOOKUP_ERROR.CANCELLED,
            LOOKUP_ERROR.TIMEOUT,
            LOOKUP_ERROR.NETWORK,
            LOOKUP_ERROR.STATE,
            LOOKUP_ERROR.EXPIRED,
            LOOKUP_ERROR.UNKNOWN,
        ].forEach(code => {
            expect(isAlertOnlyError(code)).toBe(false);
        });
    });

    test('không có lỗi thì không Alert gì', () => {
        expect(isAlertOnlyError('')).toBe(false);
        expect(isAlertOnlyError(undefined)).toBe(false);
    });

    test('errorMessageKey — một quy ước dùng chung cho hook và màn hình', () => {
        expect(errorMessageKey(LOOKUP_ERROR.NOTFOUND)).toBe(
            'amis.errorNotfound',
        );
        expect(errorMessageKey(LOOKUP_ERROR.CANCELLED)).toBe(
            'amis.errorCancelled',
        );
        expect(errorMessageKey('')).toBe('');
    });

    test('tiêu đề Alert có ở cả hai ngôn ngữ', () => {
        // Thiếu khoá này thì tiêu đề hộp thoại in ra 'amis.noticeTitle'.
        const vi = require('../src/i18n/resources/vi.json');
        const en = require('../src/i18n/resources/en.json');
        expect(vi.amis.noticeTitle.length).toBeGreaterThan(0);
        expect(en.amis.noticeTitle.length).toBeGreaterThan(0);
    });
});

describe('nút "Thử lại" — ẩn với lỗi mà thử lại vô nghĩa', () => {
    test('chưa mở Elearning / chưa cấu hình -> KHÔNG hiện', () => {
        expect(canRetryAfter(LOOKUP_ERROR.NOTFOUND)).toBe(false);
        expect(canRetryAfter(LOOKUP_ERROR.CONFIG)).toBe(false);
    });

    test('các lỗi do hoàn cảnh -> vẫn hiện', () => {
        [
            LOOKUP_ERROR.DENIED,
            LOOKUP_ERROR.CANCELLED,
            LOOKUP_ERROR.TIMEOUT,
            LOOKUP_ERROR.NETWORK,
            LOOKUP_ERROR.STATE,
            LOOKUP_ERROR.EXPIRED,
            LOOKUP_ERROR.UNKNOWN,
        ].forEach(code => {
            expect(canRetryAfter(code)).toBe(true);
        });
    });

    test('không có lỗi thì không có gì để thử lại', () => {
        expect(canRetryAfter('')).toBe(false);
    });
});

/**
 * Mọi mã lỗi phải có câu dịch ở CẢ HAI ngôn ngữ. Thiếu một khoá thì i18next hiện
 * nguyên chuỗi khoá (`amis.errorNotfound`) ra giữa màn hình — lỗi chỉ QC thấy,
 * không có exception nào.
 */
describe('mã lỗi ↔ khoá i18n', () => {
    const vi = require('../src/i18n/resources/vi.json');
    const en = require('../src/i18n/resources/en.json');

    const keyOf = code =>
        'error' + code.charAt(0).toUpperCase() + code.slice(1);

    test('mỗi mã trong LOOKUP_ERROR đều có câu vi + en', () => {
        Object.keys(LOOKUP_ERROR).forEach(name => {
            const key = keyOf(LOOKUP_ERROR[name]);
            expect(typeof vi.amis[key]).toBe('string');
            expect(typeof en.amis[key]).toBe('string');
            expect(vi.amis[key].length).toBeGreaterThan(0);
            expect(en.amis[key].length).toBeGreaterThan(0);
        });
    });

    test('câu "chưa mở Elearning" KHÔNG mời thử lại', () => {
        // Câu chuẩn đang chờ nghiệp vụ cấp. Điều bất biến là: đã ẩn nút Thử lại
        // thì câu chữ cũng không được nhắc tới việc thử lại.
        expect(canRetryAfter(LOOKUP_ERROR.NOTFOUND)).toBe(false);
        expect(vi.amis.errorNotfound.toLowerCase()).not.toContain('thử lại');
        expect(en.amis.errorNotfound.toLowerCase()).not.toContain('try again');
    });
});

/**
 * `link` trang QL trả về là **wwwroot**, app tự ghép điểm vào. Đây là chỗ dễ sai
 * nhất của cả luồng vì hai kiểu cài site cho ra hai dạng link khác nhau — mà sai
 * thì biểu hiện là 404 hoặc màn trắng, không phải lỗi rõ ràng.
 */
describe('link trang QL trả về -> điểm vào đăng nhập SaaS', () => {
    const {toSaasLoginUrl} = require('../src/components/amisDeepLink');
    const ENTRY = '/auth/saas/index.php';

    test('dữ liệu giả đang dùng dẫn tới đúng điểm vào', () => {
        expect(toSaasLoginUrl(AMIS_MOCK.response.link)).toBe(
            'https://elearning.vnresource.net' + ENTRY,
        );
    });

    test('site cài ở GỐC domain — không nhân đôi dấu /', () => {
        // Cả hai dạng đều phải ra một kết quả: BE trả kèm '/' cuối là chuyện
        // thường, mà nhân đôi thành '//auth/saas' là 404.
        expect(toSaasLoginUrl('https://elearning.vnresource.net')).toBe(
            'https://elearning.vnresource.net' + ENTRY,
        );
        expect(toSaasLoginUrl('https://elearning.vnresource.net/')).toBe(
            'https://elearning.vnresource.net' + ENTRY,
        );
    });

    test('site cài dưới SUB-PATH — giữ nguyên sub-path', () => {
        expect(toSaasLoginUrl('https://misajsc.amis.vn/lms')).toBe(
            'https://misajsc.amis.vn/lms' + ENTRY,
        );
    });
});

describe('readAmisTenantId — nguồn giá trị cho cookie TENANT', () => {
    test('lấy đúng tenantid', () => {
        expect(
            readAmisTenantId('https://x.vn/auth/saas/index.php?sid=A&tenantid=T001'),
        ).toBe('T001');
    });

    test('không phân biệt hoa thường tên tham số', () => {
        expect(readAmisTenantId('https://x.vn/a.php?TenantID=T001')).toBe('T001');
    });

    test('không có tenantid -> chuỗi rỗng (tín hiệu để XOÁ cookie cũ)', () => {
        expect(readAmisTenantId('https://x.vn/a.php?sid=A')).toBe('');
        expect(readAmisTenantId('')).toBe('');
    });

    test('đọc được độc lập với sid — hai cookie hai giá trị khác nhau', () => {
        const url = 'https://x.vn/a.php?sid=SID9&tenantid=T007';
        expect(readAmisSid(url)).toBe('SID9');
        expect(readAmisTenantId(url)).toBe('T007');
    });
});

describe('readAmisSid — nguồn giá trị cho cookie x-sessionid', () => {
    test('lấy đúng giá trị sid, không chỉ có/không', () => {
        expect(
            readAmisSid('https://x.vn/auth/saas/index.php?sid=ABC&tenantid=T1'),
        ).toBe('ABC');
    });

    test('không phân biệt hoa thường tên tham số', () => {
        expect(readAmisSid('https://x.vn/a.php?SID=ABC')).toBe('ABC');
    });

    test('không có sid -> chuỗi rỗng (tín hiệu để XOÁ cookie cũ)', () => {
        expect(readAmisSid('https://x.vn/auth/saas/index.php')).toBe('');
        expect(readAmisSid('')).toBe('');
        expect(readAmisSid('khong-phai-url')).toBe('');
    });

    test('hasAmisSid vẫn nhất quán với readAmisSid', () => {
        expect(hasAmisSid('https://x.vn/a.php?sid=ABC')).toBe(true);
        expect(hasAmisSid('https://x.vn/a.php')).toBe(false);
    });
});

describe('nút "Đăng nhập bằng AMIS" — tạm ẩn cả hai nền tảng', () => {
    test('ẩn trên cả iOS lẫn Android', () => {
        const {Platform} = require('react-native');
        const realOS = Platform.OS;
        try {
            Platform.OS = 'ios';
            expect(shouldShowAmisLoginButton()).toBe(false);
            Platform.OS = 'android';
            expect(shouldShowAmisLoginButton()).toBe(false);
        } finally {
            Platform.OS = realOS;
        }
    });
});

describe('clearAmisSession', () => {
    test('xoá sạch dấu vết AMIS khi người dùng đăng xuất thủ công', async () => {
        mockStore[AMIS_KEYS.state] = 'ST';
        mockStore[AMIS_KEYS.stateAt] = '123';
        mockStore[AMIS_KEYS.attemptedAt] = '123';
        mockStore[AMIS_KEYS.tenantId] = 'T001';
        await clearAmisSession();
        expect(Object.keys(mockStore)).toHaveLength(0);
    });
});
