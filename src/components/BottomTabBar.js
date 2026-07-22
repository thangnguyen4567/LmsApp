import React from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome5';
import {colors, spacing, fontSizes} from '../constants';

/**
 * Bottom navbar NATIVE — thay cho thanh điều hướng vẽ trong web (.navbar-footer-applms).
 *
 * items: [{ key, label, url, match, icon }]
 *   - do web (mỗi tenant) cấp qua navConfig (label đã dịch), có fallback label i18n.
 * currentUrl: URL hiện tại của WebView → tab active khi currentUrl chứa `match`.
 * onPress(url): điều hướng WebView tới url của tab.
 */
export default function BottomTabBar({items, currentUrl, onPress}) {
    const insets = useSafeAreaInsets();
    if (!items || items.length === 0) {
        return null;
    }
    const url = currentUrl || '';
    return (
        <View
            style={[styles.bar, {paddingBottom: Math.max(insets.bottom, spacing.sm)}]}>
            {items.map(item => {
                const active = Boolean(item.match) && url.indexOf(item.match) !== -1;
                const tint = active ? colors.systemcolor : colors.neutral600;
                return (
                    <Pressable
                        key={item.key}
                        style={styles.tab}
                        onPress={() => onPress(item.url)}
                        accessibilityRole="button"
                        accessibilityState={{selected: active}}
                        accessibilityLabel={item.label}>
                        <Icon name={item.icon || 'circle'} size={20} color={tint} />
                        <Text
                            numberOfLines={1}
                            style={[styles.label, {color: tint}, active && styles.labelActive]}>
                            {item.label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    bar: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.neutral400,
        paddingTop: spacing.sm,
        paddingHorizontal: spacing.xs,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xs,
    },
    label: {
        marginTop: 3,
        fontSize: fontSizes.h6, // 12
    },
    labelActive: {
        fontWeight: '600',
    },
});
