import React,{Component} from 'react';
import { withTranslation } from 'react-i18next';
import {
  View,
  Text,
  Image
} from 'react-native';

class OfflineView extends Component {
    render() {
        const { t } = this.props;
        return (
            <View style={{flex:1,backgroundColor:'white',justifyContent:'center',alignItems:'center'}}>
                <Image style={{width:150,height:100,marginBottom:20}} source={require('../assets/nointernet.jpg')} />
                <Text style={{fontWeight:'bold',color:'black'}}>{t('offline.title')}</Text>
                <Text style={{color:'black'}}>{t('offline.subtitle')}</Text>
            </View>
        )
    }
}

export default withTranslation()(OfflineView);