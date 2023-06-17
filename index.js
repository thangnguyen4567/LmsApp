/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import codePush from "react-native-code-push";
const options = { 
    updateDialog: true, 
    installMode: codePush.InstallMode.IMMEDIATE, 
    checkFrequency: codePush.CheckFrequency.ON_APP_RESUME 
}; 

AppRegistry.registerComponent(appName, () => 
    codePush(options)(App) 
);
