import React, {Component} from 'react';
import ContentView from "./ContentView";
import Validate from '../components/Validate';
import UIHeader from '../components/UIHeader';
import {colors} from '../constants'
import {URL,URLSearchParams} from 'react-native-url-polyfill';
import {OneSignal} from 'react-native-onesignal';
import {PERMISSIONS, request} from 'react-native-permissions';
import {saveData,getData,deleteData} from '../components/AsyncStorage';
import MenuItem from '../components/MenuItem';
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

export default class HomeView extends Component {
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
    dataMenu = [
        { icon: 'qrcode', title: 'Quét mã QR', onPress: () => this.setState({scanQRCode:true, isMenuOpen:false})},
        { icon: 'sign-out-alt', title: 'Đăng xuất', onPress: () => Alert.alert(
                'Xác nhận đăng xuất',
                `Bạn có chắc muốn đăng xuất?`,
                [
                    { text: 'Hủy', style: 'cancel' },
                    { text: 'Đồng ý', onPress: () => {
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
    ]
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
        // let url = 'https://pedn.vnresource.net:9191/login/index.php?applms=true';
        let newurl = new URL(url);
        let searchParams  = new URLSearchParams(newurl.search);
        if(Validate.isUrlValid(url) && this.state.session) {
            this.setState({url:url,scanQRCode:false})
        } else if(Validate.isUrlValid(url) && (searchParams.get('applms') === 'true')) {
            this.setState({url:url,scanQRCode:false})
            this.props.redirectUrl = '';
            saveData('url',url)
        } else {
            Alert.alert('Cảnh báo', 'Địa chỉ không hợp lệ',[
                {text: 'Trở về',onPress: () => 
                    {
                        this.setState({scanQRCode:false})
                    }
                },
            ]);
        }
    }
    render() {
        const webUrl = (this.props.redirectUrl || this.state.url || '').trim();
        const hasWebUrl = webUrl.length > 0;

        return (
            <View style={styles.container}>
                {/* header */}
                <UIHeader 
                    title={this.state.webTitle}
                    rightIconName={(this.state.session) ? 'list' : undefined}
                    leftIconName={(this.state.session) ? 'angle-left' : 'qrcode'}
                    onPressRightIcon={() => {
                        if(this.state.isMenuOpen === false) {
                            this.setState({isMenuOpen:true})
                        } else {
                            this.setState({isMenuOpen:false})
                        }
                    }}
                    onPressLeftIcon={() => {
                        if(this.state.session) {
                            this.handleGoBack()
                        } else {
                            this.setState({scanQRCode:true})
                            // this.setUrlDev()
                        }
                    }}
                />
                {this.state.isMenuOpen === true &&
                    <MenuItem dataMenu={this.dataMenu} />
                }
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
        backgroundColor: 'white',
    },
    container : {
        flex:1,
        backgroundColor: 'white',
        color:'black',
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