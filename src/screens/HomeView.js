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

const ONESIGNAL_APP_ID = '5fedb6e7-a3d6-4767-ae98-5d17e30dc778';
let oneSignalNativeInitialized = false;

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
        if(this.state.currentUrl.indexOf('/my/') === -1) {
            if(this.webViewRef.current) {
                this.webViewRef.current.goBack();
            }
        }
    };
    async componentDidMount() {
        const [storedUrl, username, password, saas_userdata] = await Promise.all([
            getData('url'),
            getData('username'),
            getData('password'),
            getData('saas_userdata'),
        ]);
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
                        });
                        deleteData('username');
                        deleteData('password');
                        deleteData('saas_userdata');
                    }},
                ]
            )
            },
        ];
        const webUrl = (this.props.redirectUrl || this.state.url || '').trim();
        const hasWebUrl = webUrl.length > 0;
        let leftIconName = null;
        if (this.state.session) {
            if (!this.state.scanQRCode) {
                leftIconName = 'angle-left';
            }
        } else {
            if (!this.state.scanQRCode) {
                leftIconName = 'qrcode';
            }
        }
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