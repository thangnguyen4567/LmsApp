import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Platform,
    TouchableOpacity,
    Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import {
    colors,
    fontSizes,
    spacing,
    radius,
    typography,
    shadow,
    commonStyles,
} from '../constants';
import { setAppLanguage } from '../i18n';
import ActionGridModal from '../components/ActionGridModal';

/**
 * Màn mặc định khi chưa có URL LMS (chưa quét QR / chưa lưu project).
 */
export default function WelcomePlaceholder(props) {
    const [showLanguagePicker, setShowLanguagePicker] = useState(false);
    const { t, i18n } = useTranslation();
    const setLanguage = (lang) => {
        if (lang !== i18n.language) {
            setAppLanguage(lang);
        }
        setShowLanguagePicker(false);
    };
    const viIcon = require('../assets/vi.png');
    const enIcon = require('../assets/en.png');
    const langIcon = i18n.language === 'vi' ? viIcon : enIcon;
    const langMenu = [
        {
            icon: viIcon,
            title: t('language.vietnamese'),
            onPress: () => setLanguage('vi'),
            isImage: true,
        },
        {
            icon: enIcon,
            title: t('language.english'),
            onPress: () => setLanguage('en'),
            isImage: true,
        },
    ];
    return (
        <ScrollView
            contentContainerStyle={styles.scrollContent}
            style={commonStyles.screenAlt}
            keyboardShouldPersistTaps="handled">
            <TouchableOpacity
                style={styles.langChip}
                onPress={() => setShowLanguagePicker(true)}
                accessibilityRole="button"
                accessibilityLabel={t('menu.language')}
            >
                <Image source={langIcon} style={styles.langChipImage} />
            </TouchableOpacity>
            <View style={styles.contentWrapper}>
                <TouchableOpacity style={styles.iconWrap} onPress={() => props.setScanQRCode(true)}>
                    <Icon
                        name="qrcode"
                        size={40}
                        color={colors.systemcolor}
                    />
                </TouchableOpacity>

                <Text style={styles.title}>{t('welcome.title')}</Text>

                <Text style={styles.body}>{t('welcome.body')}</Text>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>{t('welcome.guideTitle')}</Text>
                    <Text style={styles.cardBody}>{t('welcome.step1')}</Text>
                    <Text style={styles.cardBody}>{t('welcome.step2')}</Text>
                    <Text style={styles.cardBody}>{t('welcome.step3')}</Text>
                </View>
            </View>
            <ActionGridModal
                visible={showLanguagePicker}
                onRequestClose={() => setShowLanguagePicker(false)}
                actions={langMenu}
            />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollContent: {
        flexGrow: 1,
        alignItems: 'center',
    },
    contentWrapper: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: spacing.xl, // 24
        paddingVertical: spacing.xxl, // 32
    },
    langChip: {
        alignSelf: 'flex-end',
        paddingVertical: spacing.sm, // 8
        paddingHorizontal: 14, // lệch thang 4pt → giữ literal
        borderRadius: 20, // chưa có token radius tương ứng → giữ literal
        backgroundColor: 'transparent',
        marginBottom: spacing.sm, // 8
    },
    langChipImage: {
        width: 30,
        height: 30,
    },
    iconWrap: {
        width: 88,
        height: 88,
        borderRadius: radius.lg, // 16
        backgroundColor: colors.surface, // #fff
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.xl, // 24
        ...shadow.md, // khớp đúng bóng cũ: iOS {h:2, op:.08, r:6} / Android elevation 3
    },
    title: {
        ...typography.textPresets.h1, // fontSize 22 + fontWeight '700'
        color: colors.text, // #1a1a1a
        textAlign: 'center',
        marginBottom: spacing.md, // 12
    },
    body: {
        fontSize: 15, // lệch thang chữ (14/16) → giữ literal
        color: colors.textMuted, // #555
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: spacing.xl, // 24
    },
    card: {
        width: '100%',
        maxWidth: Platform.isPad ? 520 : undefined,
        alignSelf: Platform.isPad ? 'center' : undefined,
        backgroundColor: colors.surface, // #fff
        borderRadius: radius.md, // 12
        padding: spacing.base, // 16
        marginBottom: spacing.xl, // 24
        // Bóng nhẹ hơn preset shadow.sm (opacity .06 / radius 4) → giữ literal để không đổi giao diện
        ...Platform.select({
            ios: {
                shadowColor: colors.black,
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.06,
                shadowRadius: 4,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    cardTitle: {
        fontSize: fontSizes.text, // 16
        fontWeight: typography.fontWeights.semibold, // '600'
        color: colors.systemcolor,
        marginBottom: 10, // lệch thang 4pt → giữ literal
        textAlign: 'center',
    },
    cardBody: {
        fontSize: fontSizes.h5, // 14
        color: colors.neutral700, // #333
        lineHeight: 22,
        textAlign: 'left',
    },
    footer: {
        fontSize: 13, // lệch thang chữ → giữ literal
        color: colors.textSubtle, // #999
        textAlign: 'center',
        lineHeight: 20,
    },
});
