import React, { Component } from 'react';
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
} from 'react-native';

export default class ContentView extends Component {
    constructor(props) {
        super(props);
        this.state = {
            visible: true,
            webview:'',
        };
    }
    componentDidMount() {
        BackHandler.addEventListener('hardwareBackPress',() => {
            if (this.props.webViewRef.current) {
                this.props.webViewRef.current.goBack();
                return true;
            }
            return false;
            }
        );
    }
    render() { 
        const INJECTED_JAVASCRIPT = `
            document.cookie = 'appuserid=${this.props.oneSignalId}';
            setTimeout(() => {
                const targetElements = document.querySelectorAll('[target]');
                targetElements.forEach(element => {
                    element.removeAttribute('target');
                });
            }, 2000)
        `;
        // Xư lý các thông tin được gửi từ web
        const listenFromWeb = async (event) => {
            let data = null;
            try {
                data = JSON.parse(event.nativeEvent.data)
            } catch (error) {
                data = event.nativeEvent.data
            }
            this.props.setSession(data.session);
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
        return (
            <View style={styles.container}>
                <WebView
                    ref={this.props.webViewRef}
                    source={{
                        uri: this.state.webview ? this.state.webview : this.props.url,
                        body: getBody(),
                        method: 'POST',
                    }}
                    onNavigationStateChange={navState => {
                        this.props.setCurrentUrl(navState.url)
                    }}
                    injectedJavaScript={INJECTED_JAVASCRIPT}
                    onLoadStart={() => this.setState({visible:true})}
                    setsupportmultiplewindows={false}
                    onShouldStartLoadWithRequest={request => {
                        if(Platform.OS === 'android') {
                            let rooturl = new URL(this.props.url);
                            // Kiểm tra nếu url vẫn là url của lms thì mới load (hoặc url đăng nhập của misa)
                            if (request.url.startsWith(rooturl.origin) || 
                                request.url.startsWith('https://amisapp.misa.vn/') ||
                                request.url.startsWith('https://misajsc.amis.vn/') ||
                                request.url.startsWith('https://testmisajsc.amis.vn/')
                            ) {
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
                />
                {this.state.visible === true && <ActivityIndicator
                    style={styles.loading}
                    size="large"
                />}
            </View>
        )
    };
}

const styles = StyleSheet.create({
    container : {
        flex:10,
        width: '100%'
    },
    loading: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center'
    }
});