import {useCallback, useEffect, useRef, useState} from 'react';
import {Alert, AppState, Linking} from 'react-native';
import {getData} from '../components/AsyncStorage';
import i18n from '../i18n';
import {
    AMIS_DEBUG,
    AMIS_DETECT,
    AMIS_GETTOKEN,
    AMIS_TIMING,
    LOOKUP_ERROR,
    canRetryAfter,
    errorMessageKey,
    isAlertOnlyError,
    isAmisConfigured,
    isTenantLookupConfigured,
    shouldShowAmisLoginButton,
} from './amisConfig';
import {
    LINK_TYPE,
    classifyCallbackError,
    isAmisInstalled,
    lookupTenant,
    parseAmisLink,
    requestTokenKey,
    // shouldAutoRequestToken,   // ⏸️ backoff đã tắt, xem amisLaunchFlow.js
    verifyState,
} from './amisAuth';
import {
    LAUNCH_ACTION,
    decideLaunchAction,
    isCallbackTimedOut,
} from './amisLaunchFlow';

/**
 * Điều phối kịch bản A (máy chưa có phiên LMS nào, tự xin quyền từ app AMIS).
 *
 * Tách khỏi App.tsx vì có 4 nguồn sự kiện chạy song song: khởi động, deep link
 * đến giữa chừng, app quay lại foreground, người dùng bấm nút.
 *
 * Hook KHÔNG tự nạp WebView — xong việc thì gọi `onSession(...)` để App.tsx đi
 * đúng một đường với deep link của kịch bản B (`applySession`).
 */

/**
 * 🚧 Gỡ lỗi: hiện thẳng bộ tham số AMIS vừa gửi về (bật ở `AMIS_DEBUG`).
 *
 * In cả tham số RỖNG dưới dạng "(rỗng)" — tham số vắng mặt hẳn thì dễ tưởng
 * mình đọc sai tên. `cancelable` + `onDismiss` để đỡ nút back của Android: thiếu
 * nó thì bấm back xong promise treo mãi, app đứng ở màn chờ không thoát ra được.
 */
function showCallbackAlert(parsed, rawUrl) {
    const lines = [
        'tenantid: ' + (parsed.tenantid || '(rỗng)'),
        'userid: ' + (parsed.userid || '(rỗng)'),
        'sid: ' + (parsed.sid || '(rỗng)'),
    ];
    ['tokenKey', 'lang', 'state', 'error'].forEach(key => {
        if (parsed[key]) {
            lines.push(key + ': ' + parsed[key]);
        }
    });
    lines.push('', 'Link gốc:', String(rawUrl || '(không có)'));
    return new Promise(resolve => {
        Alert.alert(
            'AMIS callback',
            lines.join('\n'),
            [{text: 'OK', onPress: () => resolve()}],
            {cancelable: true, onDismiss: () => resolve()},
        );
    });
}

/**
 * Thông báo một lần rồi thôi — cho lỗi mà người dùng không làm gì được nữa.
 * Không truyền `buttons` để hệ điều hành tự dựng nút OK mặc định, giống mọi
 * Alert khác trong app.
 */
function showErrorAlert(errorCode) {
    const key = errorMessageKey(errorCode);
    if (!key) {
        return;
    }
    Alert.alert(i18n.t('amis.noticeTitle'), i18n.t(key));
}

export const AMIS_PHASE = {
    IDLE: 'idle',
    CHECKING: 'checking', // đang dò xem có nên hỏi AMIS không
    WAITING: 'waiting', // đã mở AMIS, đang chờ người dùng bấm đồng ý
    EXCHANGING: 'exchanging', // đang hỏi trang QL bằng `tenantid`
};

/**
 * @typedef {object} AmisSession
 * @property {string} url       wwwroot site LMS của tenant (chưa ghép auth/saas)
 * @property {string} [sid]
 * @property {string} [tenantid]
 * @property {string} [lang]
 * @property {string} [userid]
 *
 * @param {{onSession?: (session: AmisSession) => void, lang?: string,
 *          ready?: boolean}} [options]
 */
export default function useAmisLogin(options = {}) {
    // `ready` là chốt chặn trước khi được phép khởi động luồng — hiện dùng để
    // chờ trả lời xong hộp thoại xin quyền thông báo, xem App.tsx.
    // Mặc định `true` để nơi gọi nào không cần chờ thì khỏi khai.
    const {onSession, lang = '', ready = true} = options;
    const [phase, setPhase] = useState(AMIS_PHASE.CHECKING);
    const [error, setError] = useState('');
    const [amisAvailable, setAmisAvailable] = useState(false);

    // Các listener dưới đây đăng ký MỘT LẦN lúc mount, nên đọc state qua ref để
    // không dính giá trị cũ của lần render đầu.
    const phaseRef = useRef(phase);
    const waitStartedAtRef = useRef(0);
    const returnTimerRef = useRef(null);
    const onSessionRef = useRef(onSession);
    const langRef = useRef(lang);
    const handledRef = useRef(false);

    useEffect(() => {
        onSessionRef.current = onSession;
    }, [onSession]);
    useEffect(() => {
        langRef.current = lang;
    }, [lang]);

    /**
     * Đổi phase và cập nhật ref NGAY trong cùng lời gọi. Không đồng bộ ref bằng
     * `useEffect`: effect chỉ chạy sau khi render xong, mà bộ đếm giờ ở dưới có
     * thể nổ trước đó và đọc phải phase cũ → huỷ nhầm một phiên đang chạy tốt.
     */
    const applyPhase = useCallback(next => {
        phaseRef.current = next;
        setPhase(next);
    }, []);

    const clearReturnTimer = useCallback(() => {
        if (returnTimerRef.current) {
            clearTimeout(returnTimerRef.current);
            returnTimerRef.current = null;
        }
    }, []);

    const goIdle = useCallback(
        (code = '') => {
            clearReturnTimer();
            waitStartedAtRef.current = 0;
            applyPhase(AMIS_PHASE.IDLE);
            setError(code);
        },
        [applyPhase, clearReturnTimer],
    );

    /** Người dùng chủ động bấm "Huỷ" trên màn chờ — không phải lỗi. */
    const cancelAmisLogin = useCallback(() => goIdle(''), [goIdle]);

    /**
     * Kết thúc phiên bằng một lỗi. Hai cách báo tuỳ mã lỗi:
     * - `ALERT_ONLY_ERRORS` → Alert rồi về Welcome sạch. `goIdle('')` phải chạy
     *   TRƯỚC để màn chờ tắt trước khi Alert hiện; đảo lại thì người dùng nhìn
     *   Alert đè trên spinner, tưởng app vẫn đang làm gì đó.
     * - còn lại → hộp lỗi tại chỗ, kèm nút Thử lại nếu đáng thử.
     */
    const raiseError = useCallback(
        code => {
            if (isAlertOnlyError(code)) {
                goIdle('');
                showErrorAlert(code);
                return;
            }
            goIdle(code);
        },
        [goIdle],
    );

    /** Bước (2)(3)(4): nhận callback → đối chiếu state → đổi lấy link site. */
    const handleCallback = useCallback(
        async (parsed, rawUrl = '') => {
            // Callback đã về ⇒ huỷ ngay bộ đếm "quay lại mà chưa xác nhận", kẻo
            // nó nổ giữa chừng và giết một phiên đang chạy tốt.
            clearReturnTimer();
            // Đặt TRƯỚC mọi nhánh kiểm tra để thấy được cả ca AMIS gửi rỗng,
            // sai tên tham số, hay báo lỗi từ chối.
            if (AMIS_DEBUG.alertCallbackParams) {
                await showCallbackAlert(parsed, rawUrl);
                if (AMIS_DEBUG.stopAfterAlert) {
                    // `goIdle('')` chứ không phải mã lỗi: không có gì sai ở đây.
                    goIdle('');
                    return;
                }
            }
            const denied = classifyCallbackError(parsed.error);
            if (denied) {
                raiseError(denied);
                return;
            }
            // Chỉ đòi `state` khi chính ta có gửi đi. MISA hiện không nhận
            // `state`, nên bỏ trống tên tham số ở amisConfig là bước này tự tắt.
            if (AMIS_GETTOKEN.params && AMIS_GETTOKEN.params.state) {
                const stateOk = await verifyState(parsed.state);
                if (!stateOk) {
                    raiseError(LOOKUP_ERROR.STATE);
                    return;
                }
            }
            // `tenantid` là khoá tra cứu — thiếu nó thì không biết nạp site nào,
            // có `sid` cũng vô dụng. Chấp nhận `tokenKey` thay thế phòng khi
            // MISA đổi lại cách trả.
            if (!parsed.tenantid && !parsed.tokenKey) {
                // AMIS gọi về nhưng rỗng — thường là bản AMIS chưa hỗ trợ.
                raiseError(LOOKUP_ERROR.UNKNOWN);
                return;
            }
            applyPhase(AMIS_PHASE.EXCHANGING);
            const res = await lookupTenant({
                tokenKey: parsed.tokenKey,
                sid: parsed.sid,
                tenantid: parsed.tenantid,
                userid: parsed.userid,
                lang: parsed.lang,
            });
            if (!res.ok) {
                raiseError(res.error || LOOKUP_ERROR.UNKNOWN);
                return;
            }
            waitStartedAtRef.current = 0;
            applyPhase(AMIS_PHASE.IDLE);
            setError('');
            onSessionRef.current?.({
                url: res.link,
                sid: res.sid,
                tenantid: res.tenantid,
                lang: res.lang,
                userid: res.userid,
            });
        },
        [applyPhase, clearReturnTimer, goIdle, raiseError],
    );

    /**
     * Bước (1): mở AMIS xin quyền. Dùng chung cho lần tự động lúc khởi động lẫn
     * lần người dùng bấm nút — backoff (nếu bật) chỉ chặn ở cây quyết định.
     */
    const startAmisLogin = useCallback(async () => {
        if (!isAmisConfigured()) {
            raiseError(LOOKUP_ERROR.CONFIG);
            return;
        }
        if (!isTenantLookupConfigured()) {
            // Mở được AMIS nhưng về rồi không biết hỏi ai — chặn từ đây còn hơn
            // để người dùng đi hết một vòng rồi mới báo lỗi.
            raiseError(LOOKUP_ERROR.CONFIG);
            return;
        }
        setError('');
        applyPhase(AMIS_PHASE.WAITING);
        waitStartedAtRef.current = Date.now();
        const res = await requestTokenKey({lang: langRef.current});
        if (!res.ok) {
            raiseError(res.error || LOOKUP_ERROR.UNKNOWN);
        }
        // Thành công thì không làm gì thêm: chờ callback, hoặc chờ người dùng
        // quay lại app (xem effect AppState bên dưới).
    }, [applyPhase, raiseError]);

    /** Cây quyết định lúc khởi động. Chạy đúng một lần, sau khi `ready`. */
    useEffect(() => {
        // ⚠️ KHÔNG đặt `handledRef` ở nhánh này — đặt là lần `ready` sau bị bỏ
        // qua luôn, luồng AMIS không bao giờ chạy.
        if (!ready) {
            return undefined;
        }
        let cancelled = false;
        (async () => {
            if (handledRef.current) {
                return;
            }
            handledRef.current = true;

            if (!isAmisConfigured()) {
                // Chưa có scheme AMIS ⇒ tính năng ngủ, app chạy y như cũ.
                setAmisAvailable(false);
                applyPhase(AMIS_PHASE.IDLE);
                return;
            }

            let initialUrl = '';
            try {
                initialUrl = (await Linking.getInitialURL()) || '';
            } catch (_e) {
                initialUrl = '';
            }
            if (cancelled) {
                return;
            }

            // Cold start CHÍNH LÀ callback: xảy ra khi app LMS bị hệ điều hành
            // thu hồi lúc người dùng đang ở màn cấp quyền của AMIS.
            const parsed = parseAmisLink(initialUrl);
            if (parsed.type === LINK_TYPE.CALLBACK) {
                setAmisAvailable(true);
                applyPhase(AMIS_PHASE.EXCHANGING);
                await handleCallback(parsed, initialUrl);
                return;
            }

            const [storedUrl, storedSaas, detection] = await Promise.all([
                getData('url'),
                getData('saas_userdata'),
                isAmisInstalled(),
                // ⏸️ backoff đã tắt, xem amisLaunchFlow.js
                // shouldAutoRequestToken(),
            ]);
            if (cancelled) {
                return;
            }
            // Hiện nút khi CÓ, và cả khi KHÔNG DÒ ĐƯỢC — thà để người dùng bấm
            // thử còn hơn giấu mất lối vào của người thật sự có AMIS.
            setAmisAvailable(detection !== AMIS_DETECT.NO);

            const {action} = decideLaunchAction({
                initialUrl,
                storedUrl: storedUrl || '',
                storedSaas: storedSaas || '',
                amisDetection: detection,
                // canAutoRequest,   // ⏸️ backoff đã tắt
            });
            if (action !== LAUNCH_ACTION.REQUEST_TOKEN) {
                applyPhase(AMIS_PHASE.IDLE);
                return;
            }
            await startAmisLogin();
        })();
        return () => {
            cancelled = true;
        };
    }, [ready, applyPhase, handleCallback, startAmisLogin]);

    /** Deep link đến khi app đang chạy. */
    useEffect(() => {
        const onUrl = ({url}) => {
            const parsed = parseAmisLink(url);
            // `home/<url>` là kịch bản B — React Navigation `linking` lo, đụng
            // vào đây sẽ xử lý hai lần.
            if (parsed.type !== LINK_TYPE.CALLBACK) {
                return;
            }
            applyPhase(AMIS_PHASE.EXCHANGING);
            handleCallback(parsed, url);
        };
        const sub = Linking.addEventListener('url', onUrl);
        return () => sub.remove();
    }, [applyPhase, handleCallback]);

    /**
     * Người dùng quay lại app trong lúc còn đang chờ ⇒ thôi chờ.
     *
     * Chính việc quay lại LÀ tín hiệu: nếu AMIS có gọi về thì deep link đã tới
     * trước (iOS `openURL` trước `didBecomeActive`, Android `singleTask`
     * `onNewIntent` trước `onResume`). Vẫn còn ở trạng thái chờ nghĩa là họ rời
     * AMIS mà chưa bấm đồng ý.
     *
     * Vẫn đệm `returnGraceMs` rồi mới kết luận, phòng hai sự kiện về sát nhau và
     * lệch thứ tự — hai module native khác nhau bắn ra, không có bảo đảm tuyệt đối.
     */
    useEffect(() => {
        const onChange = next => {
            if (next !== 'active') {
                // Rời app: bỏ bộ đếm cũ, lát quay lại sẽ đếm lại từ đầu.
                clearReturnTimer();
                return;
            }
            if (phaseRef.current !== AMIS_PHASE.WAITING) {
                return;
            }
            // Ở lì bên AMIS quá lâu thì khỏi chờ thêm, kết luận luôn.
            if (isCallbackTimedOut(waitStartedAtRef.current, Date.now())) {
                raiseError(LOOKUP_ERROR.TIMEOUT);
                return;
            }
            clearReturnTimer();
            returnTimerRef.current = setTimeout(() => {
                returnTimerRef.current = null;
                if (phaseRef.current === AMIS_PHASE.WAITING) {
                    raiseError(LOOKUP_ERROR.CANCELLED);
                }
            }, AMIS_TIMING.returnGraceMs);
        };
        const sub = AppState.addEventListener('change', onChange);
        return () => {
            sub.remove();
            clearReturnTimer();
        };
    }, [clearReturnTimer, raiseError]);

    const dismissError = useCallback(() => setError(''), []);

    const usable = amisAvailable && isAmisConfigured();

    return {
        phase,
        error,
        amisAvailable: usable,
        // Ba cờ hiển thị tách riêng vì trả lời ba câu hỏi khác nhau: AMIS có
        // dùng được không / có mời thử lại không / có hiện nút đăng nhập không.
        showRetry: usable && canRetryAfter(error),
        showLoginButton: usable && shouldShowAmisLoginButton(),
        busy:
            phase === AMIS_PHASE.WAITING || phase === AMIS_PHASE.EXCHANGING,
        // Chỉ cho huỷ tay khi đang chờ AMIS. Lúc đang gọi trang QL thì không —
        // request đó đã có timeout riêng và sắp xong tới nơi.
        canCancel: phase === AMIS_PHASE.WAITING,
        startAmisLogin,
        cancelAmisLogin,
        dismissError,
    };
}
