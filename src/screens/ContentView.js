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
} from 'react-native';
import { setAppLanguage } from '../i18n';
import { colors, spacing, commonStyles } from '../constants';

class ContentView extends Component {
    constructor(props) {
        super(props);
        this.state = {
            visible: true,
            webview: '',
            loadFailed: false,
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
        // Memo source.uri theo loadUrl: chỉ dựng lại URI khi loadUrl đổi (đổi project /
        // login / web yêu cầu điều hướng). Nhờ vậy khi ĐỔI NGÔN NGỮ trên web (synclang
        // làm i18n.language đổi → render lại) thì source.uri KHÔNG đổi ⇒ WebView không tự
        // reload thêm — web đã tự reload theo ?lang rồi. Tránh việc reload 2 lần.
        if (loadUrl !== this._sourceLoadUrl) {
            this._sourceLoadUrl = loadUrl;
            const nextUrl = new URL(loadUrl);
            if (!nextUrl.searchParams.get('lang')) {
                nextUrl.searchParams.set('lang', currentLanguage);
            }
            this._sourceUri = nextUrl.toString();
        }
        const source = {
            uri: this._sourceUri,
            method: usePost ? 'POST' : 'GET',
        };
        if (usePost) {
            source.body = getBody();
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
                    javaScriptEnabled={true}
                    onError={() => this.setState({loadFailed:true})}
                    onHttpError={(e) => {
                        const status = e.nativeEvent?.statusCode;
                        if (status >= 400) {
                            this.setState({ loadFailed: true });
                        }
                    }}
                />
                {this.state.visible === true && <ActivityIndicator
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