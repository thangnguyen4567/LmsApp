import React from "react";
import {
    Text,
    View,
} from 'react-native'
import Icon from 'react-native-vector-icons/FontAwesome5'
import {colors, fontSizes} from '../constants'

function UIHeader(props) {
    const {
        title,
        leftIconName,
        rightIconName,
        onPressLeftIcon,
        onPressRightIcon,
    } = props
    return <View style={{
        height: 40,
        backgroundColor: colors.systemcolor,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    }}>
        {leftIconName != undefined ? <Icon            
            name={leftIconName}
            style={{ padding: 10 }}
            size={23} color={'white'}
            onPress={onPressLeftIcon}
        /> : <View style={{width: 50, height: 50 }}/>}
        <Text 
            numberOfLines={1}
            style={{
                fontSize: fontSizes.h2,
                textAlign: 'center',
                lineHeight: 40,
                color: 'white',
                width: 250
        }}>{title}</Text>
        {rightIconName != undefined ? <Icon            
            name={rightIconName}
            style={{ padding: 10 }}
            size={18} color={'white'}
            onPress={onPressRightIcon}
        /> : <View style={{width: 50, height: 50, }}/>}        
    </View>
}

export default UIHeader