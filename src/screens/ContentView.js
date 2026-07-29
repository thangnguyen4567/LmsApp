import React, { Component } from 'react';
import { withTranslation } from 'react-i18next';
import { WebView } from 'react-native-webview';
import { URL } from 'react-native-url-polyfill';
import { saveData } from '../components/AsyncStorage';
import { hasAmisSid } from '../components/amisDeepLink';
import {
  StyleSheet,
  View,
  BackHandler,
  ActivityIndicator,
  Linking,
  Platform,
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { setAppLanguage } from '../i18n';
import { colors, spacing, commonStyles } from '../constants';
import ReactNativeBlobUtil from 'react-native-blob-util';
import CookieManager from '@preeternal/react-native-cookie-manager';

class ContentView extends Component {
    constructor(props) {
        super(props);
        this.state = {
            visible: true,
            webview: '',
            loadFailed: false,
            downloading: false, // iOS: đang tải file qua onFileDownload
        };
    }
    componentDidMount() {
        this._backHandler = BackHandler.addEventListener(
            'hardwareBackPress',
            () => {
                if (this.props.webViewRef.current) {
                    this.props.webViewRef.current.goBack();
                    return true;
                }
                return false;
            },
        );
    }
    componentWillUnmount() {
        this._backHandler?.remove();
    }
    render() {
        const { t, i18n } = this.props;
        const currentLanguage = i18n.language;
        const INJECTED_JAVASCRIPT = `
            document.cookie = 'appuserid=${this.props.oneSignalId}';
            (function(){
                if (!document.getElementById('app-hide-webnav')) {
                    var s = document.createElement('style');
                    s.id = 'app-hide-webnav';
                    s.appendChild(document.createTextNode('.navbar-footer-applms{display:none !important;} body #page.container-fluid{margin-bottom:0 !important;} body#page-course-view-topcoll #page.container-fluid{margin-bottom:0 !important;}'));
                    (document.head || document.documentElement).appendChild(s);
                }
            })();
            setTimeout(() => {
                const targetElements = document.querySelectorAll('[target]');
                targetElements.forEach(element => {
                    element.removeAttribute('target');
                });
            }, 2000)
            // Pull-to-reload: kéo xuống đủ lực khi đang ở ĐỈNH trang -> báo native
            // tải lại trang. Dùng listener passive (không preventDefault) nên KHÔNG
            // ảnh hưởng cuộn/gesture sẵn có của trang. ';' dẫn đầu tránh lỗi ASI với
            // setTimeout ở trên.
            ;(function(){
                if (window.__appPtrInstalled) { return; }
                window.__appPtrInstalled = true;
                var startY = 0, startX = 0, tracking = false, fired = false;
                var THRESHOLD = 280; // px — phải kéo DÀI, dứt khoát mới reload (điều chỉnh được)
                var atTop = function(){
                    return (window.pageYOffset || document.documentElement.scrollTop || 0) <= 0;
                };
                document.addEventListener('touchstart', function(e){
                    if (e.touches && e.touches.length === 1 && atTop()) {
                        startY = e.touches[0].clientY;
                        startX = e.touches[0].clientX;
                        tracking = true; fired = false;
                    } else { tracking = false; }
                }, {passive: true});
                document.addEventListener('touchmove', function(e){
                    if (!tracking || fired || !e.touches || e.touches.length !== 1) { return; }
                    // Rời khỏi đỉnh (đang cuộn) -> huỷ, tránh reload nhầm khi cuộn.
                    if (!atTop()) { tracking = false; return; }
                    var dy = e.touches[0].clientY - startY;
                    var dx = Math.abs(e.touches[0].clientX - startX);
                    // Kéo XUỐNG, đủ dài, và chủ yếu theo chiều dọc (không phải vuốt ngang/xiên).
                    if (dy > THRESHOLD && dy > dx * 2) {
                        fired = true; tracking = false;
                        window.ReactNativeWebView.postMessage(JSON.stringify({ ptrReload: true }));
                    }
                }, {passive: true});
                document.addEventListener('touchend', function(){ tracking = false; }, {passive: true});
            })();
            true;
        `;
        // Ẩn bottom navbar do web vẽ (.navbar-footer-applms) NGAY trước khi trang render,
        // vì app này đã có bottom tab bar native. App MỚI chạy đoạn này → không trùng 2
        // navbar; app CŨ không có đoạn này → footer web vẫn hiện (tương thích ngược).
        const INJECTED_BEFORE_CONTENT = `
            (function(){
                var css = '.navbar-footer-applms{display:none !important;}'
                    + 'body #page.container-fluid{margin-bottom:0 !important;}'
                    + 'body#page-course-view-topcoll #page.container-fluid{margin-bottom:0 !important;}';
                var style = document.createElement('style');
                style.setAttribute('data-app-hide-webnav','1');
                style.appendChild(document.createTextNode(css));
                (document.head || document.documentElement).appendChild(style);
            })();
            true;
        `;
        // Xư lý các thông tin được gửi từ web
        const listenFromWeb = async (event) => {
            let data = null;
            try {
                data = JSON.parse(event.nativeEvent.data)
            } catch (error) {
                data = event.nativeEvent.data
            }
            // Pull-to-reload từ web: kéo đủ lực ở đỉnh trang -> tải lại trang hiện tại.
            if (data && data.ptrReload) {
                this.props.webViewRef.current?.reload();
                return;
            }
            if (data.session && data.session !== this.props.sessKey) {
                this.props.setSession(data.session);
            }
            // Lưu thông tin đăng nhập của saas
            if(data.saas_userdata) {
                saveData('saas_userdata',data.saas_userdata)
            }
            if(data.username) {
                saveData('username',data.username);
            }
            if(data.password) {
                saveData('password',data.password);
            }
            if(data.url) {
                this.setState({webview: data.url})
            }
            if (data.syncUrl && data.syncUrl !== this.props.url) {
                this.props.setUrl(data.syncUrl);
            }
            if (data.synclang && data.synclang !== currentLanguage) {
                setAppLanguage(data.synclang);
            }
            // Cấu hình bottom navbar do web (mỗi tenant) cấp — label đã dịch sẵn
            if (data.navConfig) {
                this.props.setNavConfig?.(data.navConfig);
            }
        }
        // iOS: WKWebView không tự tải file về máy như Android. Bắt sự kiện tải (file
        // có Content-Disposition: attachment — vd Moodle forcedownload=1), tải kèm
        // cookie session của WebView rồi mở QuickLook (sẵn nút Share / Save to Files).
        // Android KHÔNG dùng hàm này: onFileDownload là no-op trên Android, hệ thống
        // đã tự tải qua DownloadManager — vẫn guard Platform cho chắc chắn.
        const handleFileDownload = async ({ nativeEvent }) => {
            if (Platform.OS !== 'ios') {
                return;
            }
            const downloadUrl = nativeEvent?.downloadUrl;
            if (!downloadUrl) {
                return;
            }
            // WKWebView coi đây là "tải file" (không phải điều hướng trang) nên đã HỦY
            // navigation -> onLoadEnd sẽ KHÔNG bắn. Phải tự tắt spinner trang (visible),
            // nếu không nó xoay mãi. Bật spinner riêng cho việc tải (downloading).
            this.setState({ visible: false, downloading: true });

            const getHeader = (headers, key) => {
                const h = headers || {};
                let val = '';
                Object.keys(h).forEach(k => {
                    if (k.toLowerCase() === key) {
                        val = h[k];
                    }
                });
                return val;
            };
            const sanitizeName = name =>
                (name || '')
                    .replace(/[/\\:*?"<>|]/g, '_')
                    .replace(/\s+/g, ' ')
                    .trim();
            // Tên file: ưu tiên Content-Disposition (Moodle forcedownload luôn set),
            // fallback theo segment cuối của URL.
            const pickName = (headers, url) => {
                const cd = getHeader(headers, 'content-disposition');
                if (cd) {
                    // filename*=UTF-8''ten%20file.pdf  (RFC 5987, có dấu/Unicode)
                    let m = cd.match(/filename\*\s*=\s*[^']*''([^;]+)/i);
                    if (m && m[1]) {
                        try {
                            return sanitizeName(decodeURIComponent(m[1].replace(/["']/g, '').trim()));
                        } catch (e) {
                            return sanitizeName(m[1]);
                        }
                    }
                    m = cd.match(/filename\s*=\s*"?([^";]+)"?/i);
                    if (m && m[1]) {
                        return sanitizeName(m[1]);
                    }
                }
                try {
                    const seg = new URL(url).pathname.split('/').filter(Boolean).pop();
                    if (seg) {
                        return sanitizeName(decodeURIComponent(seg));
                    }
                } catch (e) {
                    // bỏ qua
                }
                return '';
            };
            // Nếu tên chưa có đuôi, đoán từ Content-Type để iOS mở đúng ứng dụng.
            const extFromType = headers => {
                const ct = String(getHeader(headers, 'content-type'))
                    .split(';')[0]
                    .trim()
                    .toLowerCase();
                const map = {
                    'application/pdf': 'pdf',
                    'application/msword': 'doc',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
                    'application/vnd.ms-excel': 'xls',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
                    'application/vnd.ms-powerpoint': 'ppt',
                    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
                    'image/png': 'png',
                    'image/jpeg': 'jpg',
                    'text/plain': 'txt',
                    'application/zip': 'zip',
                };
                return map[ct] || '';
            };

            try {
                // Cookie session của WKWebView cho origin của file (useWebKit = true).
                // Cần vì session Moodle thường là HttpOnly, không đọc được bằng JS.
                let cookieHeader = '';
                try {
                    const origin = new URL(downloadUrl).origin;
                    const cookies = await CookieManager.get(origin, true);
                    cookieHeader = Object.keys(cookies || {})
                        .map(name => `${name}=${cookies[name].value}`)
                        .join('; ');
                } catch (e) {
                    // Không lấy được cookie (file public) → vẫn thử tải.
                }
                const res = await ReactNativeBlobUtil.config({ fileCache: true }).fetch(
                    'GET',
                    downloadUrl,
                    cookieHeader ? { Cookie: cookieHeader } : {},
                );
                const info = res.info();
                if (!info.status || info.status >= 400) {
                    throw new Error('status ' + info.status);
                }
                // Đặt lại tên đẹp (thay tên tạm ReactNativeBlobUtilTmp_...) rồi mới preview,
                // để "Save to Files" lưu đúng tên gốc.
                let name = pickName(info.headers, downloadUrl) || 'download';
                if (name.indexOf('.') === -1) {
                    const ext = extFromType(info.headers);
                    if (ext) {
                        name = name + '.' + ext;
                    }
                }
                let finalPath = res.path();
                try {
                    const dir = ReactNativeBlobUtil.fs.dirs.CacheDir + '/appdownloads';
                    if (!(await ReactNativeBlobUtil.fs.isDir(dir))) {
                        await ReactNativeBlobUtil.fs.mkdir(dir);
                    }
                    const dest = dir + '/' + name;
                    if (await ReactNativeBlobUtil.fs.exists(dest)) {
                        await ReactNativeBlobUtil.fs.unlink(dest);
                    }
                    await ReactNativeBlobUtil.fs.mv(res.path(), dest);
                    finalPath = dest;
                } catch (e) {
                    // Không đổi tên được → mở file tạm (vẫn tải được, chỉ xấu tên).
                }
                // Mở trình xem tài liệu — sẵn nút Share / "Save to Files".
                ReactNativeBlobUtil.ios.previewDocument(finalPath);
            } catch (e) {
                Alert.alert(t('download.failedTitle'), t('download.failedMessage'));
            } finally {
                this.setState({ downloading: false });
            }
        };
        const loadUrl = this.state.webview
            ? this.state.webview
            : this.props.url;
        const usePost =
            typeof loadUrl === 'string' &&
            (loadUrl.includes('/login/index.php') ||
                loadUrl.includes('/auth/saas/index.php') ||
                loadUrl.includes('/login/logout.php'));

        if (loadUrl !== this._sourceLoadUrl) {
            this._sourceLoadUrl = loadUrl;
            const nextUrl = new URL(loadUrl);
            if (!nextUrl.searchParams.get('lang')) {
                nextUrl.searchParams.set('lang', currentLanguage);
            }
            this._sourceUri = nextUrl.toString();
        }
        // URL mang sid (vào từ deep link AMIS) ⇒ sid LÀ danh tính của request này.
        const requestHasSid = hasAmisSid(this._sourceUri);
        // Danh sách field của body POST. Dùng CHUNG cho Android (getBody) và iOS
        // (buildAutoPostHtml): hai nền tảng phải gửi y hệt nhau, tách thành 2 bản
        // logic thì sớm muộn cũng lệch — mà lệch kiểu này không văng lỗi, chỉ là
        // đăng nhập không vào.
        const buildAuthFields = () => {
            if (requestHasSid) {
                // Có sid: KHÔNG kèm username/password/user_saas. Không trộn hai
                // nguồn danh tính trong cùng một request.
                return [['fromapp', '1']];
            }
            const fields = [['fromapp', '1']];
            if (this.props.username && this.props.password) {
                fields.push(['username', this.props.username]);
                fields.push(['password', this.props.password]);
            }
            if (this.props.saas_userdata) {
                // Xử lý truyền thông tin user saas
                fields.push(['user_saas', this.props.saas_userdata]);
            }
            return fields;
        };
        const getBody = () =>
            buildAuthFields()
                .map(([name, value]) => name + '=' + encodeURIComponent(value))
                .join('&');
        // iOS: WKWebView.loadRequest BỎ HTTP body của POST (giới hạn của WebKit) → nạp source POST kiểu Android sẽ mất username/password ⇒ mở lại app không auto-login, hiện lại trang login.
        const htmlEscape = s => {
            const str = s === undefined || s === null ? '' : String(s);
            return str
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        };
        const buildAutoPostHtml = actionUrl => {
            // Cùng bộ field với getBody() để giữ nguyên contract đăng nhập với backend.
            const inputs = buildAuthFields()
                .map(
                    ([name, value]) =>
                        `<input type="hidden" name="${htmlEscape(name)}" value="${htmlEscape(value)}">`,
                )
                .join('');
            return (
                '<!DOCTYPE html><html><head><meta charset="utf-8"></head>' +
                '<body onload="document.forms[0].submit()">' +
                `<form action="${htmlEscape(actionUrl)}" method="POST">${inputs}</form>` +
                '</body></html>'
            );
        };
        let source;
        if (usePost && Platform.OS === 'ios') {
            source = {
                html: buildAutoPostHtml(this._sourceUri),
                baseUrl: this._sourceUri,
            };
        } else {
            source = {
                uri: this._sourceUri,
                method: usePost ? 'POST' : 'GET',
            };
            if (usePost) {
                source.body = getBody();
            }
        }
        return (
            <View style={styles.container}>
                <WebView
                    ref={this.props.webViewRef}
                    source={source}
                    onNavigationStateChange={navState => {
                        this.props.setCurrentUrl(navState.url)
                        this.props.setCanGoBack?.(navState.canGoBack)
                    }}
                    injectedJavaScript={INJECTED_JAVASCRIPT}
                    injectedJavaScriptBeforeContentLoaded={INJECTED_BEFORE_CONTENT}
                    onLoadStart={() => this.setState({visible:true})}
                    setSupportMultipleWindows={false}
                    onShouldStartLoadWithRequest={request => {
                        if(Platform.OS === 'android') {
                            let rooturl;
                            try {
                                rooturl = new URL(this.props.url);
                            } catch (e) {
                                Linking.openURL(request.url);
                                return false;
                            }
                            // Normalize: so sánh không phân biệt http/https
                            const normalizeUrl = (url) => url.replace(/^https?:\/\//, '');
                            const reqNorm = normalizeUrl(request.url);
                            const isWhitelisted = (
                                reqNorm.startsWith(normalizeUrl(rooturl.origin)) ||
                                reqNorm.startsWith('amisapp.misa.vn/') ||
                                reqNorm.startsWith('misajsc.amis.vn/') ||
                                reqNorm.startsWith('testmisajsc.amis.vn/') ||
                                reqNorm.startsWith('testamisapp.misa.vn/') ||
                                reqNorm.startsWith('lmsadmin.vnresource.vn/')
                            );
                            if (isWhitelisted) {
                                return true; // Cho phép tải trang mới
                            }
                            if (!request.url.includes('google.com') && !request.url.includes('notify.misa')) {
                                Linking.openURL(request.url);
                                return false; // Chặn yêu cầu tải trang mới
                            }
                            return true;
                        } else {
                            return true;
                        }
                    }}
                    onLoadEnd={() => {
                        this.setState({visible:false})
                    }}
                    onMessage={(event) => listenFromWeb(event)}
                    onFileDownload={handleFileDownload}
                    javaScriptEnabled={true}
                    onError={() => this.setState({loadFailed:true})}
                    onHttpError={(e) => {
                        const status = e.nativeEvent?.statusCode;
                        if (status >= 400) {
                            this.setState({ loadFailed: true });
                        }
                    }}
                />
                {(this.state.visible === true || this.state.downloading === true) && <ActivityIndicator
                    style={commonStyles.overlayCenter}
                    size="large"
                />}
                {this.state.loadFailed && (
                    <View style={[commonStyles.overlayCenter, styles.errorOverlay]}>
                        <Text>{t('content.loadError')}</Text>
                        <TouchableOpacity
                            onPress={() => {
                                this.setState({ loadFailed: false, visible: true });
                                this.props.webViewRef.current?.reload();
                            }}
                        >
                            <Text>{t('content.retry')}</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        )
    };
}

const styles = StyleSheet.create({
    container : {
        flex:10,
        width: '100%'
    },
    // Dùng kèm commonStyles.overlayCenter (phủ kín + căn giữa); ở đây chỉ giữ phần đặc thù.
    errorOverlay: {
        paddingHorizontal: spacing.xl, // 24
        backgroundColor: colors.surfaceGlassStrong, // rgba(255,255,255,0.95)
    }
});

export default withTranslation()(ContentView);