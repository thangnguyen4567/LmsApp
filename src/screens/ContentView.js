import React, {useState, useRef, useEffect} from 'react';
import {WebView} from 'react-native-webview';
import {URL} from 'react-native-url-polyfill';
import {
  StyleSheet,
  View,
  BackHandler,
  ActivityIndicator,
  Linking,
} from 'react-native';

export default ContentView = (props) => {
    const webViewRef = useRef(null);
    const [canGoBack, setCanGoBack ] = useState(true);
    const [visible, setVisible ] = useState(true);
    const {
        url,
        setTitle,
        setSession,
        oneSignalId
    } = props;
    const INJECTED_JAVASCRIPT = `
        document.cookie = 'appuserid=${oneSignalId}';
        setTimeout(function(){
            const targetElements = document.querySelectorAll('[target]');
            targetElements.forEach(element => {
                element.removeAttribute('target');
            });
        },2000)
        `;
    // Xử lý back trang trên web
    useEffect(() => {
        const backHandler = BackHandler.addEventListener(
            'hardwareBackPress',
            () => {
            if (webViewRef.current && canGoBack) {
                webViewRef.current.goBack();
                return true;
            }
            return false;
            }
        );
        return () => backHandler.remove();
    }, [canGoBack]);
    // Nhận thông tin từ Web 
    const listenFromWeb = async (event) => {
        let data = null;
        try {
            data = JSON.parse(event.nativeEvent.data)
          } catch (error) {
            data = event.nativeEvent.data
          }
        setTitle(data.title);
        setSession(data.session);
    }
    return ( 
        <View style={styles.container}>
            <WebView
                startInLoadingState={() => setVisible(true)}
                ref={webViewRef}
                source={{ uri:url}}
                injectedJavaScript={INJECTED_JAVASCRIPT}
                onLoadStart={() => setVisible(true)}
                setsupportmultiplewindows={false}
                onShouldStartLoadWithRequest={request => {
                    let rooturl = new URL(url);
                    if (request.url.startsWith(rooturl.origin)) {
                        return true; // Cho phép tải trang mới
                    } else {
                        Linking.openURL(request.url);
                        return false; // Chặn yêu cầu tải trang mới
                    }
                }}
                onLoadEnd={() => {
                    setVisible(false)
                }}
                cacheEnabled={false}
                onMessage={(event) => listenFromWeb(event)}
                javaScriptEnabled={true}
            />
            {visible == true && <ActivityIndicator
                style={styles.loading}
                size="large"
            />}
        </View>
    );
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