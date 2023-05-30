import React, {Component} from 'react';
import ContentView from "./ContentView";
import Validate from '../components/Validate';
import AsyncStorage from '@react-native-async-storage/async-storage';
import UIHeader from '../components/UIHeader';
import {colors} from '../constants'
import {URL} from 'react-native-url-polyfill';
import OneSignal from 'react-native-onesignal'; // Import package from node modules
import { PERMISSIONS, request, RESULTS } from 'react-native-permissions';

import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Button,
  Image,
  KeyboardAvoidingView,
  Keyboard,
  Alert,
  TouchableOpacity
} from 'react-native';
import Scanner from './Scanner';

const headerTitle = "LMS";
export default class HomeView extends Component {
    constructor(props) {
        super(props);
        this.state = {
            url: "", // url của web lms
            visibleWebview: false, 
            keyBoard: false, // bàn phím bật hay tắt
            scanQRCode: false, // bật mã QR hay ko
            webTitle: headerTitle, // tiêu dề web
            session:"", // sessiong đăng nhập của web
            oneSignalId: "", // Mã userid của onesignal
        };
    }
    // Reset trạng thái của Web
    resetState = () => {
        this.setState({
            // Reset all state values to their initial values
            url: "",
            visibleWebview: false, 
            webTitle: headerTitle,
            session:"", 
        });
      }
    onSuccess = e => {
        this.setState({url:e.data,scanQRCode:false})
    };
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
                this.setState({url:value,visibleWebview:true})
            }
        } catch (error) {
        }
    };
    // Xóa dữ liệu Store
    clearAll = async () => {
        try {
            await AsyncStorage.clear()
        } catch(e) {
        }
    }
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
    // login webview 
    loginWebView(inputurl) {
        if(Validate.isUrlValid(inputurl)) {
            let newurl = new URL(inputurl);
            let baseUrl = newurl.origin + '?applms=true';
            this.setState({url:baseUrl,visibleWebview:true})
            this.saveData(baseUrl)
        } else {
            Alert.alert('Cảnh báo', 'Địa chỉ không hợp lệ',[
                {text: 'OK'},
            ]);
        }
    }
    // Thoát webview
    exitWebView() {
        Alert.alert(
            'Xác nhận đăng xuất',
            `Bạn có chắc muốn đăng xuất khỏi LMS ?`,
            [
                { text: 'Hủy', style: 'cancel' },
                { text: 'Đồng ý', onPress: () => {
                    let newurl = new URL(this.state.url);
                    this.setState({url:newurl.origin+'/login/logout.php?sesskey='+this.state.session})
                    setTimeout(() => {
                        this.clearAll();
                        this.resetState();
                    }, 3000);
                }},
            ]
            );

    }
    render() {
        return (
            <View style={styles.container}>
                {/* header  */}
                <UIHeader 
                    title={this.state.webTitle}
                    rightIconName={this.state.visibleWebview == true ? 'sign-out-alt' : undefined}
                    onPressRightIcon={() => this.exitWebView()}
                />
                {/* From input URL  */}
                {this.state.visibleWebview == false && this.state.scanQRCode == false && (
                    <View style={styles.inputForm}>
                        <KeyboardAvoidingView style={styles.inputForm} >
                            <Text style={styles.baseText}>Nhập địa chỉ trang web:</Text>
                            <TextInput
                                style={styles.input}
                                value={this.state.url}
                                onChangeText={(text) => this.setState({url:text})}
                            />
                            <TouchableOpacity 
                                style={styles.button}
                                onPress={() => {this.loginWebView(this.state.url)}}
                            >
                                <Text style={styles.buttonText}>Truy cập</Text>
                            </TouchableOpacity>
                            <Text style={{textAlign:'center',color:'black',margin:20}}>Hoặc</Text>
                            <TouchableOpacity 
                                style={styles.button} 
                                onPress={() => {this.setState({scanQRCode:true})}}
                            >
                                <Text style={styles.buttonText}>Quét mã QR</Text>
                            </TouchableOpacity>
                            <Text style={{textAlign:'center',color:'black',margin:20}}>Hoặc</Text>
                            <TouchableOpacity
                                style={styles.button}
                                onPress={() => {this.loginWebView('https://lmstest.vnresource.net:14400')}}
                            >
                                <Text style={styles.buttonText} >Truy cập link mặc định</Text>
                            </TouchableOpacity>
                        </KeyboardAvoidingView >
                    </View>
                )}
                {/* Webview load trang web  */}
                {this.state.url && this.state.visibleWebview == true && (
                    <ContentView visibleWebview={this.state.visibleWebview} 
                                oneSignalId={this.state.oneSignalId} 
                                url={this.state.url} 
                                setTitle={(data) => this.setState({webTitle:data})}
                                setSession={(data) => this.setState({session:data})}/>
                )}
                {/* Màn hình quét mã QR  */}
                {this.state.scanQRCode == true && (
                    <Scanner onPress={() => {
                        request(PERMISSIONS.IOS.CAMERA).then(cameraStatus => {

                        });
                    }} onBack={() => {this.setState({scanQRCode:false})}} onScanner={this.onSuccess}/>
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
    inputForm : {
        flex:4,
        padding: 10
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