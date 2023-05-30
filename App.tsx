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

import {
  View,
} from 'react-native';

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
        isConnected: true,
        isVisible: true,
    };
  }
  // codePushStatusDidChange(status) {
  //     switch(status) {
  //         case codePush.SyncStatus.CHECKING_FOR_UPDATE:
  //             Alert.alert("Checking for updates.");
  //             break;
  //         case codePush.SyncStatus.DOWNLOADING_PACKAGE:
  //             Alert.alert("Downloading package.");
  //             break;
  //         case codePush.SyncStatus.INSTALLING_UPDATE:
  //             Alert.alert("Installing update.");
  //             break;
  //         case codePush.SyncStatus.UP_TO_DATE:
  //             Alert.alert("Up-to-date.");
  //             break;
  //         case codePush.SyncStatus.UPDATE_INSTALLED:
  //             Alert.alert("Update installed.");
  //             break;
  //     }
  // }

  componentDidMount() {
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
  render() {
    return (
      <View style={{flex:1}} >
      {this.state.isConnected == true
          ? <HomeView />
          : <OfflineView />
      }
      </View>
    );
  }
}
export default App;