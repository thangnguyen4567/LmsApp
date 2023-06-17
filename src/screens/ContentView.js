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
    async componentDidMount() {
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
            this.props.setTitle(data.title);
            this.props.setSession(data.session);
            saveData('username',data.username);
            saveData('password',data.password);
        }
        return (
            <View style={styles.container}>
                <WebView
                    startInLoadingState={() => this.setState({visible:true})}
                    ref={this.props.webViewRef}
                    source={{ uri:this.props.url,body:'username='+this.props.username+'&password='+this.props.password,method:'POST'}}
                    injectedJavaScript={INJECTED_JAVASCRIPT}
                    onLoadStart={() => this.setState({visible:true})}
                    setsupportmultiplewindows={false}
                    onShouldStartLoadWithRequest={request => {
                        let rooturl = new URL(this.props.url);
                        if (request.url.startsWith(rooturl.origin)) {
                            return true; // Cho phép tải trang mới
                        } else {
                            Linking.openURL(request.url);
                            return false; // Chặn yêu cầu tải trang mới
                        }
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