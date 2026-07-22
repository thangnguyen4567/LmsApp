import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Modal,
    View,
    Text,
    Pressable,
    ScrollView,
    StyleSheet,
    useWindowDimensions,
} from 'react-native';
import { colors, fontSizes, spacing, radius, typography, shadow } from '../constants';

const MAX_PANEL_WIDTH = 360;

const ABSOLUTE_FILL = {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
};

/**
 * Modal văn bản giữa màn hình — cùng ngôn ngữ hình ảnh với ActionGridModal
 * (nền mờ, panel kính, bóng) nhưng hiển thị tiêu đề + các dòng nội dung.
 * @param {boolean} visible
 * @param {() => void} onRequestClose — bấm nền, nút Đóng hoặc Android back
 * @param {string} title
 * @param {string[]} lines — mỗi phần tử là một đoạn nội dung
 * @param {string} [closeLabel]
 */
export default function InfoModal({ visible, onRequestClose, title, lines, closeLabel }) {
    const { t } = useTranslation();
    const { width: windowWidth } = useWindowDimensions();

    const panelWidth = useMemo(
        () => Math.min(MAX_PANEL_WIDTH, windowWidth - 48),
        [windowWidth],
    );

    const contentLines = Array.isArray(lines) ? lines.filter(Boolean) : [];

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
                        {!!title && <Text style={styles.title}>{title}</Text>}
                        <ScrollView
                            style={styles.scroll}
                            contentContainerStyle={styles.scrollContent}
                            showsVerticalScrollIndicator={false}
                            bounces={false}>
                            {contentLines.map((line, index) => (
                                <Text key={index} style={styles.line}>
                                    {line}
                                </Text>
                            ))}
                        </ScrollView>
                        <Pressable
                            style={styles.closeButton}
                            onPress={onRequestClose}
                            accessibilityRole="button"
                            accessibilityLabel={closeLabel || t('modal.close')}>
                            <Text style={styles.closeText}>
                                {closeLabel || t('modal.close')}
                            </Text>
                        </Pressable>
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
        paddingHorizontal: spacing.xl, // 24
        backgroundColor: colors.surfaceGlass, // rgba(255,255,255,0.92)
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.borderGlass, // rgba(255,255,255,0.75)
        ...shadow.lg, // iOS {h:4, op:.18, r:14} / Android elevation 10
    },
    title: {
        fontSize: fontSizes.h2, // 20
        fontWeight: typography.fontWeights.bold, // '700'
        color: colors.systemcolor,
        textAlign: 'center',
        marginBottom: spacing.base, // 16
    },
    scroll: {
        maxHeight: 340, // giới hạn chiều cao để nội dung dài vẫn cuộn được
    },
    scrollContent: {
        paddingBottom: spacing.xs, // 4
    },
    line: {
        fontSize: fontSizes.h5, // 14
        color: colors.neutral700, // #333
        lineHeight: 22,
        marginBottom: spacing.md, // 12
    },
    closeButton: {
        marginTop: spacing.sm, // 8
        alignSelf: 'center',
        paddingVertical: spacing.sm, // 8
        paddingHorizontal: spacing.xl, // 24
    },
    closeText: {
        fontSize: fontSizes.text, // 16
        color: colors.systemcolor,
        fontWeight: typography.fontWeights.semibold, // '600'
    },
});
