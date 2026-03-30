import React,{Component} from 'react';
import Icon from 'react-native-vector-icons/FontAwesome5'
import { 
    FlatList,
    TouchableOpacity,
    View,
    Text,
    StyleSheet,
    Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TOOLBAR = 40;

export default function MenuItem({ dataMenu }) {
    const insets = useSafeAreaInsets();
    const menuTop = Platform.OS === 'ios' ? 40 + TOOLBAR : insets.top + TOOLBAR;
    const renderItem = ({ item }) => (
        <TouchableOpacity onPress={item.onPress}>
        <View style={style.view}>
            <Icon name={item.icon} style={style.icon} size={18} />
            <Text style={{ color: 'black' }}>{item.title}</Text>
        </View>
        </TouchableOpacity>
    );
    return (
        <FlatList
            data={dataMenu}
            renderItem={renderItem}
            style={[style.menu, { top: menuTop }]}
        />
    );
}
const style = StyleSheet.create({
    view: {
        padding: 16, 
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth:0.5,
        borderBottomColor:'grey'
    },
    icon: {
        padding:5,
        color:'black',
        marginRight:10
    },
    menu: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999,
        backgroundColor: 'white',
    },
})