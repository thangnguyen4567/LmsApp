import React, {useCallback, useEffect, useState} from 'react';
import NetInfo from '@react-native-community/netinfo';
import HomeView from './src/screens/HomeView';
import OfflineView from './src/screens/OfflineView';
import {ActivityIndicator, PermissionsAndroid, View, Platform} from 'react-native';
import {I18nextProvider} from 'react-i18next';
import i18n, {bootstrapI18n, setAppLanguage} from './src/i18n';
import {saveData} from './src/components/AsyncStorage';
import {
  splitAmisParams,
  withAmisParams,
  readAmisRouteParams,
  isFromAmisApp,
  toSaasLoginUrl,
  normalizeLegacyMisaUrl,
} from './src/components/amisDeepLink';
import useAmisLogin from './src/services/useAmisLogin';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SafeAreaProvider} from 'react-native-safe-area-context';

export type RootStackParamList = {
  Home: {url?: string} | undefined;
};

// Bộ tham số AMIS của MỘT phiên. Chỉ sống trong state, không bao giờ persist.
type AmisParams = {
  sid: string;
  tenantid: string;
  lang: string;
  userid: string;
};

// Kết quả kịch bản A trả về từ useAmisLogin (`url` là wwwroot site LMS).
type AmisSession = {
  url: string;
  sid?: string;
  tenantid?: string;
  lang?: string;
  userid?: string;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const config = {
  screens: {
    Home: {
      path: 'home/:url',
      parse: {
        url: (url: string) => `${url}`,
      },
    },
  },
};

const linking = {
  prefixes: ['vnrlms://applms'],
  config,
};

function HomeScreen({
  route,
}: NativeStackScreenProps<RootStackParamList, 'Home'>) {
  const [isConnected, setIsConnected] = useState(true);
  const [redirectFromLink, setRedirectFromLink] = useState('');
  // tenantid do deep link AMIS mang sang — chỉ sống trong phiên, dùng để phát
  // hiện người dùng được đưa sang tenant khác tenant đang đăng nhập.
  const [redirectTenantId, setRedirectTenantId] = useState('');
  // Phiên này có phải vào từ app AMIS không (để hiện nút quay lại AMIS).
  const [fromAmis, setFromAmis] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'android') {
      PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      ).catch(() => {});
    }

    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(Boolean(state.isConnected));
    });
    return () => unsubscribe();
  }, []);

  // AMIS có thể gắn sid/tenantid vào query của chính deep link thay vì nhúng
  // trong URL đích. Rút ra thành chuỗi để dùng làm dependency ổn định cho
  // useEffect (route.params là object mới sau mỗi lần render).
  const linkUrl = route.params?.url ?? '';
  const {
    sid: routeSid,
    tenantid: routeTenantId,
    lang: routeLang,
    userid: routeUserId,
  } = readAmisRouteParams(route.params as Record<string, unknown> | undefined);

  /**
   * ĐIỂM HỘI TỤ của cả hai kịch bản:
   * - Kịch bản B: AMIS mở app bằng deep link kèm sẵn `sid`.
   * - Kịch bản A: app tự xin token từ AMIS rồi đổi ở trang QL ra `link` + `sid`.
   * Cả hai đều dừng ở đây với cùng bộ tham số, nên chỉ có một chỗ quyết định
   * lưu gì xuống máy và nạp gì lên WebView.
   */
  const applySession = useCallback(
    (baseUrl: string, params: AmisParams, cameFromAmis: boolean) => {
      if (!baseUrl) {
        return;
      }
      // MMKV chỉ giữ URL sạch. sid/tenantid dùng một lần cho phiên này — lưu lại
      // thì lần mở app sau sẽ POST bằng sid đã hết hạn và rớt về trang đăng nhập.
      // lang cũng không lưu vào URL: ngôn ngữ được nhớ qua khoá app_locale.
      saveData('url', baseUrl);
      setRedirectFromLink(withAmisParams(baseUrl, params));
      setRedirectTenantId(params.tenantid || '');
      setFromAmis(cameFromAmis);
      // Đổi luôn ngôn ngữ app cho khớp, khỏi phải chờ web gửi ngược `synclang`.
      if (params.lang) {
        setAppLanguage(params.lang);
      }
    },
    [],
  );

  // Kịch bản A — máy chưa có phiên nào, app tự hỏi AMIS xin token.
  // Toàn bộ tính năng tự ngủ khi src/services/amisConfig.js chưa được điền.
  const amis = useAmisLogin({
    lang: i18n.language,
    onSession: useCallback(
      (session: AmisSession) => {
        applySession(
          toSaasLoginUrl(session.url),
          {
            sid: session.sid || '',
            tenantid: session.tenantid || '',
            lang: session.lang || '',
            userid: session.userid || '',
          },
          true,
        );
      },
      [applySession],
    ),
  });

  useEffect(() => {
    if (linkUrl === '') {
      setRedirectFromLink('');
      setRedirectTenantId('');
      setFromAmis(false);
      return;
    }
    const decoded = decodeURIComponent(linkUrl);
    // Tách sid/tenantid/lang TRƯỚC khi chuẩn hoá đường dẫn: bước chuẩn hoá thay
    // pathname, làm sau thì khó tách sạch lại.
    const fromUrl = splitAmisParams(decoded);
    // Ưu tiên giá trị nhúng trong URL đích; thiếu thì lấy từ query deep link.
    const sid = fromUrl.sid || routeSid;
    const tenantid = fromUrl.tenantid || routeTenantId;
    const lang = fromUrl.lang || routeLang;
    // userid: AMIS gửi kèm để dùng về sau, hiện app chỉ chuyển tiếp sang URL LMS
    // chứ chưa xử lý gì thêm.
    const userid = fromUrl.userid || routeUserId;
    // Có sid ⇒ phải vào đúng điểm vào SaaS; wwwroot suy từ chính URL nên chạy
    // được cả site cài ở gốc domain lẫn site nằm dưới sub-path như /lms.
    // Không sid ⇒ giữ nguyên hành vi deep link cũ.
    const baseUrl = sid
      ? toSaasLoginUrl(fromUrl.cleanUrl)
      : normalizeLegacyMisaUrl(fromUrl.cleanUrl);
    applySession(
      baseUrl,
      {sid, tenantid, lang, userid},
      isFromAmisApp({sid, tenantid, userid}),
    );
  }, [
    linkUrl,
    routeSid,
    routeTenantId,
    routeLang,
    routeUserId,
    applySession,
  ]);

  return (
    <View style={{flex: 1}}>
      {isConnected ? (
        <HomeView
          redirectUrl={redirectFromLink}
          amisTenantId={redirectTenantId}
          fromAmis={fromAmis}
          amisAvailable={amis.amisAvailable}
          amisBusy={amis.busy}
          amisPhase={amis.phase}
          amisError={amis.error}
          amisCanCancel={amis.canCancel}
          onAmisLogin={amis.startAmisLogin}
          onCancelAmisLogin={amis.cancelAmisLogin}
          onDismissAmisError={amis.dismissError}
          onClearRedirectUrl={() => setRedirectFromLink('')}
        />
      ) : (
        <OfflineView />
      )}
    </View>
  );
}

function App() {
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    bootstrapI18n().finally(() => {
      if (!cancelled) {
        setI18nReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!i18nReady) {
    return (
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <I18nextProvider i18n={i18n}>
      <SafeAreaProvider>
        <NavigationContainer linking={linking}>
          <Stack.Navigator screenOptions={{headerShown: false}}>
            <Stack.Screen name="Home" component={HomeScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </I18nextProvider>
  );
}

export default App;
