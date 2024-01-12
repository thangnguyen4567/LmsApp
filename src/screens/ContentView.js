import React, {Component} from 'react';
import {WebView} from 'react-native-webview';
import {URL} from 'react-native-url-polyfill';
import {saveData,getData} from '../components/AsyncStorage';
import {
  StyleSheet,
  View,
  BackHandler,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';

export default class ContentView extends Component {
    constructor(props) {
        super(props);
        this.state = {
            visible: true,
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
        setTimeout(function(){
            const targetElements = document.querySelectorAll('[target]');
            targetElements.forEach(element => {
                element.removeAttribute('target');
            });
        },2000)
        `;
        const listenFromWeb = async (event) => {
            let data = null;
            try {
                data = JSON.parse(event.nativeEvent.data)
            } catch (error) {
                data = event.nativeEvent.data
            }
            this.props.setSession(data.session);
            // Lưu thông tin đăng nhập của saas
            saveData('saas_userdata',data.saas_userdata)
            saveData('username',data.username);
            saveData('password',data.password);
        }
        const getBody = () => {
            if(this.props.username && this.props.password) {
                return 'username='+this.props.username+'&password='+this.props.password;
            } else if(this.props.saas_userdata) {
                // Xử lý truyền thông tin user saas
                return 'user_saas='+encodeURIComponent(this.props.saas_userdata)
            } else {
                return '';
            }
        }
        return (
            <View style={styles.container}>
                <WebView
                    startInLoadingState={() => this.setState({visible:true})}
                    ref={this.props.webViewRef}
                    source={{ 
                        uri:this.props.url,
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded'},
                        body:getBody(),
                        method:'POST'
                    }}
                    onNavigationStateChange={navState => {
                        this.props.setCurrentUrl(navState.url)
                    }}
                    injectedJavaScript={INJECTED_JAVASCRIPT}
                    onLoadStart={() => this.setState({visible:true})}
                    setsupportmultiplewindows={false}
                    onShouldStartLoadWithRequest={request => {
                        let rooturl = new URL(this.props.url);
                        // Kiểm tra nếu url vẫn là url của lms thì mới load (hoặc url đăng nhập của misa)
                        if (request.url.startsWith(rooturl.origin) || 
                            request.url.startsWith('https://amisapp.misa.vn/login') ||
                            request.url.startsWith('https://misajsc.amis.vn/login') ) {
                            return true; // Cho phép tải trang mới
                        } 
                        // else {
                        //     Linking.openURL(request.url);
                        //     return false; // Chặn yêu cầu tải trang mới
                        // }
                    }}
                    onLoadEnd={() => {
                        this.setState({visible:false})
                    }}
                    cacheMode='LOAD_NO_CACHE'
                    cacheEnabled={false}
                    onMessage={(event) => listenFromWeb(event)}
                    javaScriptEnabled={true}
                />
                {this.state.visible == true && <ActivityIndicator
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