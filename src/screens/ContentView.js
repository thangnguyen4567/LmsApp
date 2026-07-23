import React, { Component } from 'react';
import { withTranslation } from 'react-i18next';
import { WebView } from 'react-native-webview';
import { URL } from 'react-native-url-polyfill';
import { saveData } from '../components/AsyncStorage';
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
            this.setState({ downloading: true });
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
                // Tên + phần mở rộng file suy từ URL.
                let filename = 'download';
                try {
                    const path = new URL(downloadUrl).pathname;
                    const last = decodeURIComponent(
                        path.split('/').filter(Boolean).pop() || '',
                    );
                    if (last) {
                        filename = last;
                    }
                } catch (e) {
                    // giữ mặc định
                }
                const dot = filename.lastIndexOf('.');
                const ext = dot > -1 ? filename.slice(dot + 1) : '';
                const res = await ReactNativeBlobUtil.config({
                    fileCache: true,
                    ...(ext ? { appendExt: ext } : {}),
                }).fetch(
                    'GET',
                    downloadUrl,
                    cookieHeader ? { Cookie: cookieHeader } : {},
                );
                const status = res.info().status;
                if (!status || status >= 400) {
                    throw new Error('status ' + status);
                }
                // Mở QuickLook — người dùng xem và bấm Share / "Save to Files".
                ReactNativeBlobUtil.ios.previewDocument(res.path());
            } catch (e) {
                Alert.alert(t('download.failedTitle'), t('download.failedMessage'));
            } finally {
                this.setState({ downloading: false });
            }
        };
        const getBody = () => {
            let param = 'fromapp=1';
            if(this.props.username && this.props.password) {
                param +='&username='+this.props.username+'&password='+this.props.password;
            } 
            if(this.props.saas_userdata) {
                // Xử lý truyền thông tin user saas
                param += '&user_saas='+encodeURIComponent(this.props.saas_userdata)
            } 
            return param;
        }
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
            const fields = [['fromapp', '1']];
            if (this.props.username && this.props.password) {
                fields.push(['username', this.props.username]);
                fields.push(['password', this.props.password]);
            }
            if (this.props.saas_userdata) {
                fields.push(['user_saas', this.props.saas_userdata]);
            }
            const inputs = fields
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