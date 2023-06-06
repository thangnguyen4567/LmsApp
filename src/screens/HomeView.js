import React, {Component} from 'react';
import ContentView from "./ContentView";
import Validate from '../components/Validate';
import AsyncStorage from '@react-native-async-storage/async-storage';
import UIHeader from '../components/UIHeader';
import {colors} from '../constants'
import {URL,URLSearchParams} from 'react-native-url-polyfill';
import OneSignal from 'react-native-onesignal'; // Import package from node modules
import { PERMISSIONS, request, RESULTS } from 'react-native-permissions';
import {
  StyleSheet,
  View,
  Keyboard,
  Alert,
} from 'react-native';
import Scanner from './Scanner';

const headerTitle = "LMS";
export default class HomeView extends Component {
    constructor(props) {
        super(props);
        this.state = {
            url: "https://lmstest.vnresource.net:14400?applms=true", // url của web lms
            keyBoard: false, // bàn phím bật hay tắt
            scanQRCode: false, // bật mã QR hay ko
            webTitle: headerTitle, // tiêu dề web
            session:"", // sessiong đăng nhập của web
            oneSignalId: "", // Mã userid của onesignal
        };
    }
    // Lưu dữ liệu vào AsyncStorage với key là 'url'
    saveData = async (url) => {
        try {
            await AsyncStorage.setItem('url', url); 
        } catch (error) {
        }
    }
     // Lấy dữ liệu từ AsyncStorage với key là 'url'
    getData = async () => {
        try {
            var value = await AsyncStorage.getItem('url');
            if(value != null) {
                this.setState({url:value})
            }
        } catch (error) {
        }
    };
    componentDidMount() {
        this.getData();
        Keyboard.addListener('keyboardDidShow', () => {
            this.setState({keyBoard:true})
        })
        Keyboard.addListener('keyboardDidHide', () => {
            this.setState({keyBoard:false})
        })
        // Đẩy thông báo App
        OneSignal.setAppId("ee0b4c19-f714-4891-b390-5dd250575a18");
        //Method for handling notifications opened
        OneSignal.setNotificationOpenedHandler(notification => {
            console.log("OneSignal: notification opened:", notification);
        });
        OneSignal.getDeviceState().then(deviceState => {
            this.setState({oneSignalId:deviceState.userId})
        })
    }
    render() {
        return (
            <View style={styles.container}>
                {/* header */}
                <UIHeader 
                    title={this.state.webTitle}
                    rightIconName={(this.state.session) ? 'sign-out-alt' : undefined}
                    leftIconName={(!this.state.session) ? 'qrcode' : undefined}
                    onPressRightIcon={() => Alert.alert(
                        'Xác nhận đăng xuất',
                        `Bạn có chắc muốn đăng xuất?`,
                        [
                            { text: 'Hủy', style: 'cancel' },
                            { text: 'Đồng ý', onPress: () => {
                                let newurl = new URL(this.state.url);
                                this.setState({url:newurl.origin+'/login/logout.php?sesskey='+this.state.session,session:''})
                            }},
                        ]
                    )}
                    onPressLeftIcon={() => {
                        this.setState({scanQRCode:true})
                    }}
                />
                {/* Webview load trang web */}
                {this.state.scanQRCode == false ? ( 
                    <ContentView 
                        oneSignalId={this.state.oneSignalId} 
                        url={this.state.url} 
                        setTitle={(data) => this.setState({webTitle:data})}
                        setSession={(data) => this.setState({session:data})}/>
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
                            if(Validate.isUrlValid(e.data) && searchParams.get('ISLMS') == 'true') {
                                let baseUrl = newurl.origin + '?applms=true';
                                this.setState({url:baseUrl,scanQRCode:false})
                                this.saveData(baseUrl)
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