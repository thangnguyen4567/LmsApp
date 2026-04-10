import React, {useEffect, useState} from 'react';
import NetInfo from '@react-native-community/netinfo';
import HomeView from './src/screens/HomeView';
import OfflineView from './src/screens/OfflineView';
import {PermissionsAndroid, View, Platform} from 'react-native';
import {saveData} from './src/components/AsyncStorage';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import CodePush from '@revopush/react-native-code-push';
import CodePushUpdateModal from './src/components/CodePushUpdateModal';
import {useCodePushUpdateChecker} from './src/hooks/useCodePushUpdateChecker';

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
  const {remote, dismiss} = useCodePushUpdateChecker();

  return (
    <>
      <SafeAreaProvider>
        <NavigationContainer linking={linking}>
          <Stack.Navigator screenOptions={{headerShown: false}}>
            <Stack.Screen name="Home" component={HomeScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
      <CodePushUpdateModal update={remote} onDismiss={dismiss} />
    </>
  );
}

export default CodePush({
  checkFrequency: CodePush.CheckFrequency.ON_APP_RESUME,
  updateDialog: false,
})(App);
