import React from "react";
import {
    Text,
    View,
    Platform,
    Pressable
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome5'
import {colors, fontSizes} from '../constants'

const TOOLBAR = 40;

function UIHeader(props) {
    const {
        title,
        leftIconName,
        rightIconName,
        onPressLeftIcon,
        onPressRightIcon,
    } = props

    const insets = useSafeAreaInsets();
    const paddingTop = Platform.OS === 'ios' ? 40 : insets.top;
    const minHeight = paddingTop + TOOLBAR;

    return (
        <View style={{
            paddingTop,
            minHeight,
            backgroundColor: colors.systemcolor,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        }}>
            {leftIconName !== undefined ? (
                <Pressable
                    onPress={onPressLeftIcon}
                    hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                    style={{
                        paddingVertical: 10,
                        paddingHorizontal: 16,
                        minWidth: 48,
                        minHeight: 48,
                        justifyContent: 'center',
                        alignItems: 'flex-start',
                    }}
                >
                    <Icon name={leftIconName} size={22} color="white" />
                </Pressable>
            ) : (
                <View style={{ width: 50, height: 50 }} />
            )}
            <Text
                numberOfLines={1}
                style={{
                    fontSize: fontSizes.h2,
                    textAlign: 'center',
                    lineHeight: TOOLBAR,
                    color: 'white',
                    width: 250,
                }}
            >
                {title}
            </Text>
            {rightIconName !== undefined ? (
                <Icon
                    name={rightIconName}
                    style={{ padding: 10 }}
                    size={22}
                    color={'white'}
                    onPress={onPressRightIcon}
                />
            ) : (
                <View style={{ width: 50, height: 50 }} />
            )}
        </View>
    );
}

export default UIHeader