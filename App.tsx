import React, {useEffect, useState} from 'react';
import NetInfo from '@react-native-community/netinfo';
import HomeView from './src/screens/HomeView';
import OfflineView from './src/screens/OfflineView';
import {ActivityIndicator, PermissionsAndroid, View, Platform} from 'react-native';
import {I18nextProvider} from 'react-i18next';
import i18n, {bootstrapI18n} from './src/i18n';
import {saveData} from './src/components/AsyncStorage';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SafeAreaProvider} from 'react-native-safe-area-context';

export type RootStackParamList = {
  Home: {url?: string} | undefined;
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

  useEffect(() => {
    const url = route.params?.url;
    if (url == null || url === '') {
      setRedirectFromLink('');
      return;
    }
    let finalUrl = decodeURIComponent(url);
    if (
      finalUrl.startsWith('https://misajsc.amis.vn/lms') &&
      !finalUrl.includes('auth/saas/index.php')
    ) {
      finalUrl = 'https://misajsc.amis.vn/lms/auth/saas/index.php';
    }
    setRedirectFromLink(finalUrl);
    saveData('url', finalUrl);
  }, [route.params?.url]);

  return (
    <View style={{flex: 1}}>
      {isConnected ? (
        <HomeView
          redirectUrl={redirectFromLink}
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
