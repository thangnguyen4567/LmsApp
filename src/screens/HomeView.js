import React, {Component} from 'react';
import {withTranslation} from 'react-i18next';
import ContentView from "./ContentView";
import Validate from '../components/Validate';
import UIHeader from '../components/UIHeader';
import {setAppLanguage} from '../i18n';
import {colors} from '../constants'
import {URL,URLSearchParams} from 'react-native-url-polyfill';
import {OneSignal} from 'react-native-onesignal';
import {PERMISSIONS, request} from 'react-native-permissions';
import {saveData,getData,deleteData} from '../components/AsyncStorage';
import ActionGridModal from '../components/ActionGridModal';
import {
  StyleSheet,
  View,
  Keyboard,
  Alert,
  ActivityIndicator
} from 'react-native';
import Scanner from './Scanner';
import WelcomePlaceholder from './WelcomePlaceholder';
import BottomTabBar from '../components/BottomTabBar';

const ONESIGNAL_APP_ID = '5fedb6e7-a3d6-4767-ae98-5d17e30dc778';
let oneSignalNativeInitialized = false;

// Bottom navbar mặc định (optimistic) — hiện ngay bằng label i18n trước khi web
// gửi navConfig; sau đó navConfig từ web sẽ override label/url theo từng tenant.
const TAB_DEFS = [
    {key: 'dashboard', path: '/my/', match: '/my/', icon: 'home'},
    {key: 'course', path: '/course/index.php', match: '/course/', icon: 'book'},
    {key: 'exam', path: '/examonline.php', match: '/examonline.php', icon: 'pen'},
    {key: 'library', path: '/library.php', match: '/library.php', icon: 'book-reader'},
    {key: 'forum', path: '/local/forum/view.php', match: '/local/forum/view.php', icon: 'comments'},
];
const TAB_ICONS = {
    dashboard: 'home',
    course: 'book',
    exam: 'pen',
    library: 'book-reader',
    forum: 'comments',
};
const QUIZ_ATTEMPT_PATH = '/mod/quiz/attempt';

class HomeView extends Component {
    constructor(props) {
        super(props);
        this.webViewRef = React.createRef();
        this.state = {
            url: "", // url của web lms
            keyBoard: false, // bàn phím bật hay tắt
            scanQRCode: false, // bật mã QR hay ko
            webTitle: "", // tiêu dề web
            session:"", // sessiong đăng nhập của web
            oneSignalId: "", // Push subscription id (dùng với include_player_ids trên backend)
            username: "",
            password: "",
            currentUrl: "",
            canGoBack: false, // WebView còn trang để quay lại hay không
            navConfig: null, // cấu hình bottom navbar do web cấp (đã dịch theo tenant)
            firstMount: false,
            isMenuOpen: false,
            storageReady: false,
            saas_userdata: "",
        };
        this.componentDidMount = this.componentDidMount.bind(this);
        this._onOneSignalNotificationClick = this._onOneSignalNotificationClick.bind(
            this,
        );
        this._onOneSignalForegroundWillDisplay =
            this._onOneSignalForegroundWillDisplay.bind(this);
        this._onOneSignalUserOrSubscriptionChanged =
            this._onOneSignalUserOrSubscriptionChanged.bind(this);
    }

    componentWillUnmount() {
        this._keyboardShowSub?.remove();
        this._keyboardHideSub?.remove();
        OneSignal.Notifications.removeEventListener(
            'click',
            this._onOneSignalNotificationClick,
        );
        OneSignal.Notifications.removeEventListener(
            'foregroundWillDisplay',
            this._onOneSignalForegroundWillDisplay,
        );
        OneSignal.User.removeEventListener(
            'change',
            this._onOneSignalUserOrSubscriptionChanged,
        );
        OneSignal.User.pushSubscription.removeEventListener(
            'change',
            this._onOneSignalUserOrSubscriptionChanged,
        );
    }

    _onOneSignalNotificationClick(event) {
        console.log('OneSignal: notification opened:', event);
    }

    _onOneSignalForegroundWillDisplay(event) {
        event.getNotification().display();
    }

    _onOneSignalUserOrSubscriptionChanged(_event) {
        this._syncOneSignalIdToState();
    }

    async _syncOneSignalIdToState() {
        try {
            const id = await OneSignal.User.pushSubscription.getIdAsync();
            if (id) {
                this.setState({oneSignalId: id});
            }
        } catch (_e) {
            // ignore
        }
    }

    _setupOneSignal() {
        if (!oneSignalNativeInitialized) {
            OneSignal.initialize(ONESIGNAL_APP_ID);
            oneSignalNativeInitialized = true;
        }
        OneSignal.Notifications.removeEventListener(
            'click',
            this._onOneSignalNotificationClick,
        );
        OneSignal.Notifications.addEventListener(
            'click',
            this._onOneSignalNotificationClick,
        );
        OneSignal.Notifications.removeEventListener(
            'foregroundWillDisplay',
            this._onOneSignalForegroundWillDisplay,
        );
        OneSignal.Notifications.addEventListener(
            'foregroundWillDisplay',
            this._onOneSignalForegroundWillDisplay,
        );
        OneSignal.User.addEventListener(
            'change',
            this._onOneSignalUserOrSubscriptionChanged,
        );
        OneSignal.User.pushSubscription.addEventListener(
            'change',
            this._onOneSignalUserOrSubscriptionChanged,
        );
        OneSignal.Notifications.requestPermission(false).catch(() => {});
        this._syncOneSignalIdToState();
    }
    handleGoBack = () => {
        const ref = this.webViewRef.current;
        if (!ref) {
            return;
        }
        if (this.state.canGoBack) {
            ref.goBack();
            return;
        }
        // WebView không còn trang để lùi (vd trang con là điểm vào đầu tiên) → đưa về
        // Dashboard cho khỏi kẹt, thay vì bấm nút mà không có phản hồi.
        const dashboard = this.buildTabItems().find(it => it.key === 'dashboard');
        if (dashboard && dashboard.url) {
            this.handleTabPress(dashboard.url);
        }
    };
    // Nhận cấu hình navbar từ web (label đã dịch theo tenant) + cache lại
    setNavConfig = (navConfig) => {
        if (!navConfig || !Array.isArray(navConfig.items)) {
            return;
        }
        this.setState({navConfig});
        saveData('navConfig', JSON.stringify(navConfig));
    };
    _safeOrigin = (u) => {
        try {
            return new URL(u).origin;
        } catch (_e) {
            return null;
        }
    };
    // Danh sách tab hiển thị: ưu tiên navConfig từ web (label đã dịch), nếu chưa có
    // thì dùng label i18n mặc định (optimistic) — cùng key nên khi web về không giật.
    buildTabItems = () => {
        const {t} = this.props;
        const origin = this._safeOrigin(this.state.currentUrl || this.state.url);
        const web = this.state.navConfig && this.state.navConfig.items;
        // Chỉ dùng navConfig từ web nếu URL của nó CÙNG origin với site đang mở. Tránh
        // trường hợp: đăng xuất rồi vào site khác nhưng navConfig cache của site cũ vẫn
        // còn → bấm tab bị đẩy sang link cũ (ngoài whitelist → mở trình duyệt ngoài).
        const webUsable =
            web &&
            web.length &&
            origin &&
            web.every(it => this._safeOrigin(it.url) === origin);
        if (webUsable) {
            return web.map(it => ({
                key: it.key,
                label: it.label,
                url: it.url,
                match: it.match,
                icon: TAB_ICONS[it.key] || 'circle',
            }));
        }
        return TAB_DEFS.map(d => ({
            key: d.key,
            label: t('navbar.' + d.key),
            url: origin ? origin + d.path : null,
            match: d.match,
            icon: d.icon,
        }));
    };
    handleTabPress = (targetUrl) => {
        if (!targetUrl) {
            return;
        }
        const ref = this.webViewRef.current;
        if (ref && ref.injectJavaScript) {
            ref.injectJavaScript(`
                document.getElementsByTagName('body')[0].classList.add('loading');window.location.href=${JSON.stringify(targetUrl)};true;
            `);
        }
    };
    async componentDidMount() {
        const [storedUrl, username, password, saas_userdata, navConfigRaw] = await Promise.all([
            getData('url'),
            getData('username'),
            getData('password'),
            getData('saas_userdata'),
            getData('navConfig'),
        ]);
        let cachedNavConfig = null;
        if (navConfigRaw) {
            try {
                cachedNavConfig = JSON.parse(navConfigRaw);
            } catch (_e) {
                cachedNavConfig = null;
            }
        }
        const resolvedUrl = this.props.redirectUrl
            ? this.props.redirectUrl
            : storedUrl
              ? storedUrl
              : '';
        this.setState({
            url: resolvedUrl,
            username: username ?? '',
            password: password ?? '',
            saas_userdata: saas_userdata ?? '',
            navConfig: cachedNavConfig,
            firstMount: true,
            storageReady: true,
        });

        this._keyboardShowSub = Keyboard.addListener('keyboardDidShow', () => {
            this.setState({keyBoard: true});
        });
        this._keyboardHideSub = Keyboard.addListener('keyboardDidHide', () => {
            this.setState({keyBoard: false});
        });
        this._setupOneSignal();
    }

    setUrlDev = () => {
        let url = 'your-url-when-developing';
        let newurl = new URL(url);
        let searchParams  = new URLSearchParams(newurl.search);
        if(Validate.isUrlValid(url) && this.state.session) {
            this.props.onClearRedirectUrl?.();
            this.setState({url:url,scanQRCode:false})
        } else if(Validate.isUrlValid(url) && (searchParams.get('applms') === 'true')) {
            this.props.onClearRedirectUrl?.();
            this.setState({url:url,scanQRCode:false})
            saveData('url',url)
        } else {
            const {t} = this.props;
            Alert.alert(t('alert.invalidUrlTitle'), t('alert.invalidUrlMessage'),[
                {text: t('common.goBack'),onPress: () => 
                    {
                        this.setState({scanQRCode:false})
                    }
                },
            ]);
        }
    }
    render() {
        const {t} = this.props;
        const dataMenu = [
            { icon: 'qrcode', title: t('menu.scanQr'), onPress: () => this.setState({scanQRCode:true, isMenuOpen:false})},
            { icon: 'sign-out-alt', title: t('menu.logout'), onPress: () => Alert.alert(
                t('logout.confirmTitle'),
                t('logout.confirmMessage'),
                [
                    { text: t('common.cancel'), style: 'cancel' },
                    { text: t('common.agree'), onPress: () => {
                        let newurl = new URL(this.state.url);
                        const logoutPath =
                            this.state.url.indexOf('/lms/') > -1
                                ? '/lms/login/logout.php?sesskey='
                                : '/login/logout.php?sesskey=';
                        this.setState({
                            url: newurl.origin + logoutPath + this.state.session,
                            session: '',
                            isMenuOpen: false,
                            username: '',
                            password: '',
                            saas_userdata: '',
                            navConfig: null,
                        });
                        deleteData('username');
                        deleteData('password');
                        deleteData('saas_userdata');
                        deleteData('navConfig');
                    }},
                ]
            )
            },
        ];
        const webUrl = (this.props.redirectUrl || this.state.url || '').trim();
        const hasWebUrl = webUrl.length > 0;
        let leftIconName = null;
        if (this.state.session) {
            // Hiện nút back ở mọi trang, TRỪ trang gốc /my/ (dashboard) thì ẩn.
            if (!this.state.scanQRCode && this.state.currentUrl.indexOf('/my/') === -1) {
                leftIconName = 'angle-left';
            }
        } else {
            if (!this.state.scanQRCode) {
                leftIconName = 'qrcode';
            }
        }
        // Suy ra "đã đăng nhập" từ dữ liệu đã cache (MMKV) — có ngay khi storageReady,
        // KHÔNG chờ session postMessage từ web (vốn chỉ về sau khi trang load xong).
        const isLoggedIn =
            Boolean(this.state.session) ||
            Boolean(this.state.saas_userdata) ||
            (Boolean(this.state.username) && Boolean(this.state.password));
        const showTabBar =
            !this.state.scanQRCode &&
            this.state.storageReady &&
            hasWebUrl &&
            isLoggedIn &&
            !this.state.keyBoard &&
            this.state.currentUrl.indexOf(QUIZ_ATTEMPT_PATH) === -1;
        return (
            <View style={styles.container}>
                {/* header */}
                <UIHeader 
                    title={this.state.scanQRCode ? t('header.scanQr') : this.state.webTitle}
                    rightIconName={(this.state.session && !this.state.scanQRCode) ? 'ellipsis-v' : undefined}
                    leftIconName={leftIconName ? leftIconName : undefined}
                    onPressRightIcon={() => {
                        this.setState(s => ({ isMenuOpen: !s.isMenuOpen }));
                    }}
                    onPressLeftIcon={() => {
                        if(this.state.session) {
                            this.handleGoBack()
                        } else {
                            this.setState({scanQRCode:true})
                            // uncomment this to use dev url
                            // this.setUrlDev()
                        }
                    }}
                />
                <ActionGridModal
                    visible={
                        Boolean(
                            this.state.isMenuOpen &&
                                this.state.session &&
                                hasWebUrl &&
                                this.state.storageReady &&
                                !this.state.scanQRCode,
                        )
                    }
                    onRequestClose={() => this.setState({ isMenuOpen: false })}
                    actions={dataMenu}
                />
                {/* Webview load trang web */}
                {this.state.scanQRCode === false ? ( 
                    !this.state.storageReady ? (
                        <View style={styles.contentLoading}>
                            <ActivityIndicator size="large" />
                        </View>
                    ) : !hasWebUrl ? (
                        <WelcomePlaceholder
                            setScanQRCode={(data) => this.setState({scanQRCode:data})}
                        />
                    ) : (
                        <ContentView 
                            oneSignalId={this.state.oneSignalId} 
                            url={this.props.redirectUrl || this.state.url} 
                            setTitle={(data) => this.setState({webTitle:data})}
                            setSession={(data) => this.setState({session:data})}
                            username={this.state.username}
                            password={this.state.password}
                            saas_userdata={this.state.saas_userdata}
                            webViewRef={this.webViewRef}
                            setCurrentUrl={(data) => this.setState({currentUrl:data})}
                            setCanGoBack={(data) => this.setState({canGoBack:data})}
                            setNavConfig={this.setNavConfig}
                            sessKey={this.state.session}
                            setUrl={(data) => this.setState({url:data})}
                        />
                    )
                ) : (
                // Quét mã QR
                    <Scanner 
                        onPress={() => {
                            request(PERMISSIONS.IOS.CAMERA).then(cameraStatus => {});
                        }} 
                        onBack={() => {
                            this.setState({scanQRCode:false})
                        }} 
                        onScanner={e => {
                            let newurl = new URL(e.data);
                            let searchParams  = new URLSearchParams(newurl.search);
                            if(Validate.isUrlValid(e.data) && this.state.session) {
                                this.props.onClearRedirectUrl?.();
                                this.setState({url:e.data,scanQRCode:false})
                            } else if(Validate.isUrlValid(e.data) && (searchParams.get('applms') === 'true')) {
                                this.props.onClearRedirectUrl?.();
                                this.setState({url:e.data,scanQRCode:false})
                                saveData('url',e.data)
                            } else {
                                Alert.alert('Cảnh báo', 'Địa chỉ không hợp lệ',[
                                    {text: 'Trở về',onPress: () => 
                                        {
                                            this.setState({scanQRCode:false})
                                        }
                                    },
                                ]);
                            }
                        }}
                    />
                )}
                {showTabBar && (
                    <BottomTabBar
                        items={this.buildTabItems()}
                        currentUrl={this.state.currentUrl}
                        onPress={this.handleTabPress}
                    />
                )}
            </View>
        )
    }
};

const styles = StyleSheet.create({
    contentLoading: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surface,
    },
    container : {
        flex:1,
        backgroundColor: colors.surface,
        color: colors.black,
    },
    header : {
        flex:0.15,
        padding: 10,
        backgroundColor:colors.systemcolor,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent:'space-between',
    },
    logo: {
        width: '100%',
        height: 150,
        resizeMode: 'contain',
    },
    input : {
        height: 40, 
        borderColor: "blue", 
        borderBottomWidth: 1,
        marginBottom: 10,
        padding: 10,
        color: 'black'
    },
    loading: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center'
    },
    baseText: {
        fontFamily: 'Cochin',
        color: 'black'
    },
    headerText: {
        fontFamily: 'Cochin',
        color:'white',
        fontWeight: 'bold',
        fontSize: 20
    },
    button: {
        borderRadius: 5,
        padding:15,
        zIndex:100,
        backgroundColor:colors.systemcolor
    },
    buttonText: {
        color: '#fff',
        textAlign: 'center'
    }
});

export default withTranslation()(HomeView);