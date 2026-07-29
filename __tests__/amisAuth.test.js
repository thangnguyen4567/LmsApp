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
    AMIS_DETECT,
    AMIS_KEYS,
    AMIS_MOCK,
    AMIS_TIMING,
    LOOKUP_ERROR,
    canDetectAmisInstalled,
    getAmisBaseUrl,
    getAmisReturnUrl,
    getCallbackUrl,
    isAmisConfigured,
    joinAmisUrl,
} = require('../src/services/amisConfig');

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
};

beforeEach(() => {
    Object.keys(mockStore).forEach(key => delete mockStore[key]);
    AMIS_APP.scheme = REAL.scheme;
    AMIS_APP.androidUrl = REAL.androidUrl;
    AMIS_APP.schemeTest = '';
    AMIS_APP.returnPath = '';
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

    test('nút quay về AMIS mang tham số nhận diện nguồn gọi là VNR', () => {
        // Bảng phối hợp dòng 5: "VNR tự quy định cấu trúc deeplink bắn về AMIS".
        expect(getAmisReturnUrl()).toBe('misa.amis.vn://?source=ailearning');
    });

    test('có returnPath thì mở đúng màn AMIS chỉ định', () => {
        AMIS_APP.returnPath = 'home';
        expect(getAmisReturnUrl()).toBe('misa.amis.vn://home?source=ailearning');
    });

    test('joinAmisUrl xử lý đúng dấu / cho cả hai dạng gốc URL', () => {
        expect(joinAmisUrl('get-token')).toBe('misa.amis.vn://get-token');
        expect(joinAmisUrl('')).toBe('misa.amis.vn://');
    });

    test('iOS dò được app AMIS bằng custom scheme', () => {
        expect(canDetectAmisInstalled()).toBe(true);
    });

    // Chuỗi chính xác app LMS bắn sang AMIS — đây là thứ đã gửi cho MISA nên
    // khoá lại, đổi mà quên báo là hai bên lệch nhau ngay.
    test('deep link quay về AMIS — chuỗi chốt của cả hai nền tảng', () => {
        const {Platform} = require('react-native');
        const realOS = Platform.OS;
        try {
            Platform.OS = 'ios';
            expect(getAmisReturnUrl()).toBe('misa.amis.vn://?source=ailearning');

            Platform.OS = 'android';
            expect(getAmisReturnUrl()).toBe(
                'https://misajsc.amis.vn/?source=ailearning',
            );
            // Android còn khoá intent vào đúng package AMIS, xem AmisDetectModule.kt
            expect(AMIS_APP.androidPackage).toBe('vn.com.misa.amis');
        } finally {
            Platform.OS = realOS;
        }
    });

    test('URL callback đưa cho MISA đúng cấu trúc đã công bố', () => {
        expect(getCallbackUrl()).toBe('vnrlms://applms/amis-callback');
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
        const commented = plist.lastIndexOf('<!--', key);
        const closed = plist.lastIndexOf('-->', key);
        expect(commented).toBeLessThan(closed);
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
        expect(getAmisReturnUrl()).toBe('amistest://?source=ailearning');
    });
});

describe('buildGetTokenUrl', () => {
    beforeEach(() => {
        AMIS_APP.scheme = 'amis';
    });

    test('ghép đủ redirect_uri + state, encode đúng', () => {
        const url = buildGetTokenUrl({state: 'STATE123'});
        expect(url.indexOf('amis://get-token?')).toBe(0);
        expect(url).toContain(
            'redirect_uri=' +
                encodeURIComponent('vnrlms://applms/amis-callback'),
        );
        expect(url).toContain('state=STATE123');
    });

    test('không truyền lang thì không kèm tham số rỗng', () => {
        expect(buildGetTokenUrl({state: 'S'})).not.toContain('lang=');
    });

    test('có lang thì gửi kèm để AMIS hiện popup đúng tiếng', () => {
        expect(buildGetTokenUrl({state: 'S', lang: 'vi'})).toContain('lang=vi');
    });

    test('chưa được MISA cấp client_id thì không gửi tham số rỗng', () => {
        expect(buildGetTokenUrl({state: 'S'})).not.toContain('client_id=');
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

// ⏸️ `shouldAutoRequestToken` hiện KHÔNG được gọi trong luồng khởi động (backoff
// tạm tắt). Vẫn giữ test để hàm không mục nát trước khi bật lại.
describe('backoff chống ping-pong giữa hai app (tạm chưa dùng)', () => {
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

    test('(4) ⏸️ backoff ĐANG TẠM TẮT — vừa thất bại vẫn tự động thử lại ngay', () => {
        // Test này khoá đúng hành vi tạm thời của giai đoạn vừa làm vừa test.
        // Khi bật lại backoff trong amisLaunchFlow.js, test này SẼ ĐỎ — đó là
        // chủ đích, đổi lại thành WELCOME là xong.
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

describe('lookupTenant — endpoint giả khi BE chưa cấp endpoint thật', () => {
    test('trả link + sid để chạy trọn luồng ngay hôm nay', async () => {
        const res = await lookupTenant({tokenKey: 'TK1'});
        expect(res.ok).toBe(true);
        expect(res.mocked).toBe(true);
        expect(res.link).toBe(AMIS_MOCK.response.link);
        expect(res.sid).toBeTruthy();
    });

    test('tham số AMIS gửi sang được ưu tiên hơn dữ liệu giả', async () => {
        const res = await lookupTenant({
            tokenKey: 'TK1',
            sid: 'SID_THAT',
            tenantid: 'T999',
        });
        expect(res.sid).toBe('SID_THAT');
        expect(res.tenantid).toBe('T999');
    });

    test('đặt failWith là thử được nhánh lỗi mà không cần BE', async () => {
        AMIS_MOCK.failWith = LOOKUP_ERROR.NOTFOUND;
        const res = await lookupTenant({tokenKey: 'TK1'});
        expect(res.ok).toBe(false);
        expect(res.error).toBe(LOOKUP_ERROR.NOTFOUND);
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
