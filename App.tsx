/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { Component } from 'react';
import NetInfo from '@react-native-community/netinfo';
import HomeView from './src/screens/HomeView';
import OfflineView from './src/screens/OfflineView';
import codePush from "react-native-code-push";
import { PermissionsAndroid } from 'react-native';
import { saveData } from './src/components/AsyncStorage';
import {
  View,
  Alert
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const Stack = createNativeStackNavigator();

const config = {
	screens: {
		Home: {
			path: "home/:url",
			parse: {
				id: (url) => `${url}`,
			},
		},
		Test: {
			path: "test",
		},
	},
}
  
const linking = {
	prefixes: ["lms://applms"],
	config
};
class App extends Component {
	constructor(props) {
	  super(props);
	  this.state = {
		  isConnected: true,
		  isVisible: true,
	  };
	  this.HomeView = this.HomeView.bind(this);
	}
	codePushStatusDidChange(status) {
		switch(status) {
			case codePush.SyncStatus.DOWNLOADING_PACKAGE:
				Alert.alert("Downloading package...");
				break;
			case codePush.SyncStatus.UPDATE_INSTALLED:
				Alert.alert("Update success.");
				break;
		}
	}
	async componentDidMount() {
		PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
		// kiểm tra kết nối với internet
		NetInfo.addEventListener((state) => {
			var status = `${state.isConnected}`;
			if(status == 'true') {
				this.setState({isConnected:true})
			} else {
				this.setState({isConnected:false})
			}
		})
	}
	HomeView({route}) {
		const { url } = route.params || {};
		var finalUrl = '';		
		if(url) {
			finalUrl = decodeURIComponent(url);
			if(finalUrl.startsWith('https://misajsc.amis.vn/lms') && !finalUrl.includes('auth/saas/index.php')) {
				finalUrl = 'https://misajsc.amis.vn/lms/auth/saas/index.php'
			}
			saveData('url', finalUrl);
		} 
		return (
			<View style={{flex:1}} >
			{this.state.isConnected  == true
				? <HomeView redirectUrl={finalUrl} />
				: <OfflineView /> 
			}
			</View>
		);
	}
	render() {
		return (
			<NavigationContainer linking={linking}>
				<Stack.Navigator screenOptions={{headerShown: false}}>
					<Stack.Screen name="Home" component={this.HomeView} />
				</Stack.Navigator>
			</NavigationContainer>
		)
	}
}
export default App;