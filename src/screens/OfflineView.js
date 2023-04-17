import React,{Component} from 'react';
import {
  View,
  Text,
  Image
} from 'react-native';

export default class OfflineView extends Component {
    render() {
        return (
            <View style={{flex:1,backgroundColor:'white',justifyContent:'center',alignItems:'center'}}>
                <Image style={{width:150,height:100,marginBottom:20}} source={require('../assets/nointernet.jpg')} />
                <Text style={{fontWeight:'bold',color:'black'}}>Không có kết nối mạng</Text>
                <Text style={{color:'black'}}>Vui lòng kiểm tra kết nối và thử lại</Text>
            </View>
        )
    }
}