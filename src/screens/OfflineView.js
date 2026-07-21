import React,{Component} from 'react';
import { withTranslation } from 'react-i18next';
import {
  View,
  Text,
  Image
} from 'react-native';
import { colors, spacing, typography, commonStyles } from '../constants';

class OfflineView extends Component {
    render() {
        const { t } = this.props;
        return (
            <View style={[commonStyles.center, {backgroundColor: colors.surface}]}>
                <Image style={{width:150,height:100,marginBottom:spacing.lg}} source={require('../assets/nointernet.jpg')} />
                <Text style={{fontWeight:typography.fontWeights.bold,color:colors.black}}>{t('offline.title')}</Text>
                <Text style={{color:colors.black}}>{t('offline.subtitle')}</Text>
            </View>
        )
    }
}

export default withTranslation()(OfflineView);
