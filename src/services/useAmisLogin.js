import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState, Linking} from 'react-native';
import {getData} from '../components/AsyncStorage';
import {
    AMIS_DETECT,
    AMIS_GETTOKEN,
    AMIS_TIMING,
    LOOKUP_ERROR,
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
    // shouldAutoRequestToken,   // ⏸️ TẠM TẮT — backoff 24h, xem amisLaunchFlow.js
    verifyState,
} from './amisAuth';
import {
    LAUNCH_ACTION,
    decideLaunchAction,
    isCallbackTimedOut,
} from './amisLaunchFlow';

/**
 * Điều phối kịch bản A (máy chưa có phiên LMS nào, tự xin token từ app AMIS).
 *
 * Tách khỏi App.tsx vì phần này có 4 nguồn sự kiện chạy song song — khởi động,
 * deep link đến giữa chừng, app quay lại foreground, người dùng bấm nút — và
 * nhồi hết vào màn hình thì rất khó đọc.
 *
 * Hook KHÔNG tự nạp WebView. Xong việc nó gọi `onSession(...)`, để App.tsx dùng
 * đúng một đường đi với deep link của kịch bản B (`applyAmisSession`).
 */

export const AMIS_PHASE = {
    IDLE: 'idle',
    CHECKING: 'checking', // đang dò xem có nên hỏi AMIS không
    WAITING: 'waiting', // đã mở AMIS, đang chờ người dùng bấm đồng ý
    EXCHANGING: 'exchanging', // đang đổi token key ở trang quản lý VNR
};

/**
 * @typedef {object} AmisSession
 * @property {string} url       wwwroot site LMS của tenant (chưa ghép auth/saas)
 * @property {string} [sid]
 * @property {string} [tenantid]
 * @property {string} [lang]
 * @property {string} [userid]
 *
 * @param {{onSession?: (session: AmisSession) => void, lang?: string}} [options]
 */
export default function useAmisLogin(options = {}) {
    const {onSession, lang = ''} = options;
    const [phase, setPhase] = useState(AMIS_PHASE.CHECKING);
    const [error, setError] = useState('');
    const [amisAvailable, setAmisAvailable] = useState(false);

    // Các sự kiện dưới đây bắn ra từ listener đăng ký MỘT LẦN lúc mount, nên
    // đọc state qua ref để không dính giá trị cũ của lần render đầu.
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
     * Đổi phase và cập nhật ref NGAY trong cùng lời gọi.
     * Không dùng `useEffect` để đồng bộ ref: effect chỉ chạy sau khi render
     * xong, mà bộ đếm giờ ở dưới có thể nổ trước đó và đọc phải phase cũ →
     * huỷ nhầm một phiên đang chạy tốt.
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

    /** Bước (2)(3)(4): nhận callback → đối chiếu state → đổi lấy link site. */
    const handleCallback = useCallback(
        async parsed => {
            // Callback đã về ⇒ huỷ ngay bộ đếm "quay lại mà chưa xác nhận",
            // kẻo nó nổ giữa chừng và giết một phiên đang chạy tốt.
            clearReturnTimer();
            const denied = classifyCallbackError(parsed.error);
            if (denied) {
                goIdle(denied);
                return;
            }
            // Chỉ đòi `state` khi chính ta có gửi đi. MISA chưa chốt có hỗ trợ
            // `state` hay không (spec §9.1 mục ⑤); nếu bỏ trống tên tham số ở
            // amisConfig thì bước đối chiếu này tự tắt theo.
            if (AMIS_GETTOKEN.params && AMIS_GETTOKEN.params.state) {
                const stateOk = await verifyState(parsed.state);
                if (!stateOk) {
                    goIdle(LOOKUP_ERROR.STATE);
                    return;
                }
            }
            // `tenantid` là khoá tra cứu ở trang QL — thiếu nó thì không biết
            // nạp site LMS nào, có `sid` cũng vô dụng. Chấp nhận `tokenKey`
            // thay thế phòng khi sau này MISA đổi lại cách trả.
            if (!parsed.tenantid && !parsed.tokenKey) {
                // AMIS gọi về nhưng rỗng — thường là bản AMIS chưa hỗ trợ.
                goIdle(LOOKUP_ERROR.UNKNOWN);
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
                goIdle(res.error || LOOKUP_ERROR.UNKNOWN);
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
        [applyPhase, clearReturnTimer, goIdle],
    );

    /**
     * Bước (1): mở AMIS xin token.
     * Dùng chung cho cả lần tự động lúc khởi động lẫn lần người dùng bấm nút —
     * backoff chỉ chặn ở cây quyết định, nút bấm tay luôn đi thẳng vào đây.
     */
    const startAmisLogin = useCallback(async () => {
        if (!isAmisConfigured()) {
            goIdle(LOOKUP_ERROR.CONFIG);
            return;
        }
        if (!isTenantLookupConfigured()) {
            // Mở được AMIS nhưng cầm token về rồi không biết hỏi ai — chặn từ
            // đây còn hơn để người dùng đi hết một vòng rồi mới báo lỗi.
            goIdle(LOOKUP_ERROR.CONFIG);
            return;
        }
        setError('');
        applyPhase(AMIS_PHASE.WAITING);
        waitStartedAtRef.current = Date.now();
        const res = await requestTokenKey({lang: langRef.current});
        if (!res.ok) {
            goIdle(res.error || LOOKUP_ERROR.UNKNOWN);
        }
        // Thành công thì không làm gì thêm: chờ callback, hoặc chờ người dùng
        // quay lại app (xem bộ đếm ở effect AppState bên dưới).
    }, [applyPhase, goIdle]);

    /** Cây quyết định lúc khởi động. Chạy đúng một lần. */
    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (handledRef.current) {
                return;
            }
            handledRef.current = true;

            if (!isAmisConfigured()) {
                // Chưa có scheme AMIS ⇒ toàn bộ tính năng ngủ, app chạy y như cũ.
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
                await handleCallback(parsed);
                return;
            }

            const [storedUrl, storedSaas, detection] = await Promise.all([
                getData('url'),
                getData('saas_userdata'),
                isAmisInstalled(),
                // ⏸️ TẠM TẮT — backoff 24h, xem amisLaunchFlow.js
                // shouldAutoRequestToken(),
            ]);
            if (cancelled) {
                return;
            }
            // Hiện nút khi CÓ, và cả khi KHÔNG DÒ ĐƯỢC (Android) — thà để người
            // dùng bấm thử còn hơn giấu mất lối vào của người thật sự có AMIS.
            setAmisAvailable(detection !== AMIS_DETECT.NO);

            const {action} = decideLaunchAction({
                initialUrl,
                storedUrl: storedUrl || '',
                storedSaas: storedSaas || '',
                amisDetection: detection,
                // canAutoRequest,   // ⏸️ TẠM TẮT — backoff 24h
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
    }, [applyPhase, handleCallback, startAmisLogin]);

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
            handleCallback(parsed);
        };
        const sub = Linking.addEventListener('url', onUrl);
        return () => sub.remove();
    }, [applyPhase, handleCallback]);

    /**
     * Người dùng quay lại app LMS trong lúc còn đang chờ ⇒ thôi chờ.
     *
     * **Chính việc quay lại LÀ tín hiệu.** Nếu AMIS có gọi về thì deep link đã
     * tới TRƯỚC rồi — iOS chạy `openURL` trước `didBecomeActive`, Android
     * `singleTask` chạy `onNewIntent` trước `onResume`. Vẫn còn ở trạng thái
     * chờ nghĩa là họ rời AMIS mà chưa bấm đồng ý: đóng app, bấm Home, bấm back.
     *
     * Vẫn chờ thêm `returnGraceMs` (~1,2 giây) rồi mới kết luận, phòng trường
     * hợp hai sự kiện về sát nhau và lệch thứ tự — hai module native khác nhau
     * bắn ra nên không có bảo đảm tuyệt đối về thứ tự.
     *
     * Trước đây chỗ này chờ đủ `callbackTimeoutMs` (60 giây) mới kết luận, nên
     * quay về sau 5 giây là phải nhìn spinner thêm 55 giây vô ích.
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
                goIdle(LOOKUP_ERROR.TIMEOUT);
                return;
            }
            clearReturnTimer();
            returnTimerRef.current = setTimeout(() => {
                returnTimerRef.current = null;
                if (phaseRef.current === AMIS_PHASE.WAITING) {
                    goIdle(LOOKUP_ERROR.CANCELLED);
                }
            }, AMIS_TIMING.returnGraceMs);
        };
        const sub = AppState.addEventListener('change', onChange);
        return () => {
            sub.remove();
            clearReturnTimer();
        };
    }, [clearReturnTimer, goIdle]);

    const dismissError = useCallback(() => setError(''), []);

    // AMIS có dùng được không. Điều khiển nút "Thử lại" sau khi báo lỗi —
    // nút đó phải còn ở MỌI nền tảng, kể cả nơi nút đăng nhập bị ẩn.
    const usable = amisAvailable && isAmisConfigured();

    return {
        phase,
        error,
        amisAvailable: usable,
        // Nút "Đăng nhập bằng AMIS" đứng sẵn ở màn Welcome — hiện tại ẩn trên
        // Android, xem `shouldShowAmisLoginButton()`.
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
