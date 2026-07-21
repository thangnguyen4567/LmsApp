import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Modal,
    View,
    Text,
    Pressable,
    StyleSheet,
    useWindowDimensions,
	Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { colors, fontSizes, spacing, radius, shadow } from '../constants';

const ICON_TILE = 50;
const MAX_PANEL_WIDTH = 320;

const ABSOLUTE_FILL = {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
};

/**
 * Modal giữa màn hình: nền trong suốt, lưới action kiểu icon widget Android.
 * @param {boolean} visible
 * @param {() => void} onRequestClose — bấm nền hoặc Android back
 * @param {Array<{ icon: string, title: string, onPress: () => void }>} actions
 */
export default function ActionGridModal({ visible, onRequestClose, actions }) {
    const { t } = useTranslation();
    const { width: windowWidth } = useWindowDimensions();

    const panelWidth = useMemo(
        () => Math.min(MAX_PANEL_WIDTH, windowWidth - 48),
        [windowWidth],
    );

    const columns = useMemo(() => {
        const n = actions?.length ?? 0;
        if (n <= 1) {
            return 1;
        }
        if (n === 2) {
            return 2;
        }
        return 3;
    }, [actions]);

    const cellPercent = `${100 / columns}%`;

    const runAction = item => {
        onRequestClose();
        item.onPress();
    };

    if (!actions?.length) {
        return null;
    }

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={onRequestClose}>
            <View style={styles.root}>
                <Pressable
                    style={styles.backdrop}
                    onPress={onRequestClose}
                    accessibilityLabel={t('modal.close')}
                    accessibilityRole="button"
                />
                <View style={styles.centerLayer} pointerEvents="box-none">
                    <View style={[styles.panel, { width: panelWidth }]}>
                        <View style={styles.grid}>
                            {actions.map((item, index) => (
                                <Pressable
                                    key={`${item.title}-${index}`}
                                    style={[styles.cell, { width: cellPercent }]}
                                    onPress={() => runAction(item)}
                                    accessibilityRole="button"
                                    accessibilityLabel={item.title}>
                                    <View style={styles.iconTile}>
										{item?.isImage ? 
										    <Image source={item.icon} style={styles.iconTileImage} />
										: (
											<Icon
												name={item.icon}
												size={20}
												color={colors.systemcolor}
											/>
										)}
                                    </View>
                                    <Text style={styles.cellLabel} numberOfLines={2}>
                                        {item.title}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    backdrop: {
        ...ABSOLUTE_FILL,
        backgroundColor: colors.overlay, // rgba(0,0,0,0.58)
    },
    centerLayer: {
        ...ABSOLUTE_FILL,
        justifyContent: 'center',
        alignItems: 'center',
    },
    panel: {
        borderRadius: radius.lg, // 16
        paddingVertical: spacing.lg, // 20
        paddingHorizontal: spacing.md, // 12
        backgroundColor: colors.surfaceGlass, // rgba(255,255,255,0.92)
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.borderGlass, // rgba(255,255,255,0.75)
        ...shadow.lg, // iOS {h:4, op:.18, r:14} / Android elevation 10
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    cell: {
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 6,
    },
    iconTile: {
        width: ICON_TILE,
        height: ICON_TILE,
        borderRadius: 14, // lệch thang radius → giữ literal
        backgroundColor: colors.surfaceGlassStrong, // rgba(255,255,255,0.95)
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm, // 8
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border, // rgba(0,0,0,0.06)
        ...shadow.sm, // iOS {h:1, op:.08, r:3} / Android elevation 2
    },
    iconTileImage: {
        width: 30,
        height: 30,
    },
    cellLabel: {
        fontSize: fontSizes.h6, // 12
        color: colors.neutral800, // #222
        textAlign: 'center',
        lineHeight: 16,
    },
});
