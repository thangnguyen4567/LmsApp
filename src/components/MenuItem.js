import React from 'react';
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
import { colors, spacing } from '../constants';

const TOOLBAR = 40;

export default function MenuItem({ dataMenu }) {
    const insets = useSafeAreaInsets();
    const menuTop = Platform.OS === 'ios' ? 40 + TOOLBAR : insets.top + TOOLBAR;
    const renderItem = ({ item }) => (
        <TouchableOpacity onPress={item.onPress}>
        <View style={style.view}>
            <Icon name={item.icon} style={style.icon} size={18} />
            <Text style={{ color: colors.black }}>{item.title}</Text>
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
        padding: spacing.base, // 16
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth:0.5,
        borderBottomColor:'grey', // chưa có token xám tương ứng → giữ literal
    },
    icon: {
        padding:5, // lệch thang → giữ literal
        color: colors.black,
        marginRight:10, // lệch thang → giữ literal
    },
    menu: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999,
        backgroundColor: colors.surface, // #fff
    },
})
