import React, {useState, useRef, useEffect} from 'react';
import {WebView} from 'react-native-webview';
import {
  StyleSheet,
  View,
  BackHandler,
  ActivityIndicator,
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

    const handleResponse = (data: NavState) => {
        setCanGoBack(!!data.canGoBack);
    };
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
    const onShouldStartLoadWithRequest = (event) => {
        const { url, mainDocumentURL } = event;
    
        // Kiểm tra nếu URL không bắt đầu bằng URL gốc của WebView
        if (!url.startsWith(mainDocumentURL)) {
          // Chặn việc load URL bên ngoài
          return false;
        }
    
        // Cho phép việc load URL trong WebView
        return true;
    };
    return ( 
        <View style={styles.container}>
            <WebView
                startInLoadingState={() => setVisible(true)}
                ref={webViewRef}
                source={{ uri:url}}
                injectedJavaScript={INJECTED_JAVASCRIPT}
                onNavigationStateChange={(data) => handleResponse(data)}
                onLoadStart={() => setVisible(true)}
                onShouldStartLoadWithRequest={this.onShouldStartLoadWithRequest}
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