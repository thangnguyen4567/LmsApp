import React from "react";
import {
    Text,
    View,
    Platform,
    Pressable
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome5'
import {colors, fontSizes, commonStyles} from '../constants'

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
        <View style={[commonStyles.rowBetween, {
            paddingTop,
            minHeight,
            backgroundColor: colors.systemcolor,
        }]}>
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
                    <Icon name={leftIconName} size={22} color={colors.white} />
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
                    color: colors.white,
                    width: 250,
                }}
            >
                {title}
            </Text>
            {rightIconName !== undefined ? (
                <Pressable
                    onPress={onPressRightIcon}
                    hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                    style={{
                        paddingVertical: 10,
                        paddingHorizontal: 18,
                        minWidth: 48,
                        minHeight: 48,
                        justifyContent: 'center',
                        alignItems: 'flex-start',
                    }}
                >
                    <Icon
                        name={rightIconName}
                        size={22}
                        color={colors.white}
                    />
                </Pressable>
            ) : (
                <View style={{ width: 50, height: 50 }} />
            )}
        </View>
    );
}

export default UIHeader