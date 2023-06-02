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
App = codePush({ updateDialog: true, installMode: codePush.InstallMode.IMMEDIATE })(App);
export default App;