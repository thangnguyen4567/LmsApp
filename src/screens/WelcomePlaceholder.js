import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Platform,
    TouchableOpacity,
    TextInput,
    Keyboard,
    ActivityIndicator,
    Image,
} from 'react-native';
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
import InfoModal from '../components/InfoModal';

/**
 * Màn mặc định khi chưa có URL LMS (chưa nhập link / chưa quét QR).
 * Ưu tiên nhập link; QR là tuỳ chọn phụ.
 */
export default function WelcomePlaceholder(props) {
    const [showLanguagePicker, setShowLanguagePicker] = useState(false);
    const [showGuide, setShowGuide] = useState(false);
    // Điền sẵn đường dẫn người dùng đã nhập trước đó (khi quay lại từ WebView chưa login).
    const [linkInput, setLinkInput] = useState(() => props.initialUrl || '');
    const [submitting, setSubmitting] = useState(false);
    const { t, i18n } = useTranslation();

    const setLanguage = (lang) => {
        if (lang !== i18n.language) {
            setAppLanguage(lang);
        }
        setShowLanguagePicker(false);
    };

    const handleSubmit = async () => {
        const val = linkInput.trim();
        if (!val || submitting) {
            return;
        }
        Keyboard.dismiss();
        setSubmitting(true);
        // HomeView lo việc validate định dạng + lưu + mở WebView (và sau này là
        // gọi API xác thực link). Nếu link không hợp lệ, HomeView tự Alert.
        await props.onSubmitUrl?.(val);
        setSubmitting(false);
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

    const isSubmitDisabled = submitting || linkInput.trim().length === 0;

    const guideLines = [
        t('welcome.guideStep1'),
        t('welcome.guideStep2'),
        t('welcome.guideStep3'),
        t('welcome.guideNote'),
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
                <Image
                    source={require('../assets/logo.png')}
                    style={styles.logo}
                    resizeMode="contain"
                    accessibilityIgnoresInvertColors
                />

                <Text style={styles.title}>{t('welcome.title')}</Text>

                <Text style={styles.body}>{t('welcome.body')}</Text>

                <TextInput
                    style={styles.input}
                    value={linkInput}
                    onChangeText={setLinkInput}
                    placeholder={t('welcome.inputPlaceholder')}
                    placeholderTextColor={colors.textSubtle}
                    keyboardType="default"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="off"
                    returnKeyType="go"
                    editable={!submitting}
                    onSubmitEditing={handleSubmit}
                />

                <TouchableOpacity
                    style={[styles.primaryButton, isSubmitDisabled && styles.primaryButtonDisabled]}
                    onPress={handleSubmit}
                    disabled={isSubmitDisabled}
                    accessibilityRole="button"
                    accessibilityState={{disabled: isSubmitDisabled}}
                    accessibilityLabel={t('welcome.connect')}
                >
                    {submitting ? (
                        <ActivityIndicator color={colors.white} />
                    ) : (
                        <Text style={styles.primaryButtonText}>{t('welcome.connect')}</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.haveQrLink}
                    onPress={() => props.setScanQRCode(true)}
                    accessibilityRole="button"
                    accessibilityLabel={t('welcome.haveQr')}
                >
                    <Text style={styles.haveQrText}>{t('welcome.haveQr')}</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.footer}>
                <TouchableOpacity
                    onPress={() => setShowGuide(true)}
                    accessibilityRole="button"
                    accessibilityLabel={t('welcome.guideTitle')}
                >
                    <Text style={styles.guideLink}>{t('welcome.guideTitle')}</Text>
                </TouchableOpacity>
            </View>

            <InfoModal
                visible={showGuide}
                onRequestClose={() => setShowGuide(false)}
                title={t('welcome.guideTitle')}
                lines={guideLines}
            />
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
        width: '100%',
        maxWidth: Platform.isPad ? 520 : undefined,
        alignItems: 'center',
        // Bám mép trên (không căn giữa dọc) để bàn phím không che nội dung khi nhập link.
        paddingHorizontal: spacing.xl, // 24
        paddingTop: spacing.xxl, // 32 — giữ khoảng cách phía trên như cũ
        paddingBottom: spacing.lg, // 20
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
    logo: {
        width: 120,
        height: 120,
        marginBottom: spacing.xl, // 24
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
    input: {
        width: '100%',
        height: 48,
        borderWidth: 1,
        borderColor: colors.border, // rgba(0,0,0,0.06)
        borderRadius: radius.md, // 12
        paddingHorizontal: spacing.base, // 16
        fontSize: fontSizes.text, // 16
        color: colors.text, // #1a1a1a
        backgroundColor: colors.surface, // #fff
        marginBottom: spacing.md, // 12
    },
    primaryButton: {
        width: '100%',
        height: 48,
        borderRadius: radius.md, // 12
        backgroundColor: colors.systemcolor, // #006400
        alignItems: 'center',
        justifyContent: 'center',
        ...shadow.sm,
    },
    primaryButtonDisabled: {
        opacity: 0.7,
    },
    primaryButtonText: {
        fontSize: fontSizes.text, // 16
        fontWeight: typography.fontWeights.semibold, // '600'
        color: colors.white,
    },
    haveQrLink: {
        marginTop: spacing.base, // 16
        paddingVertical: spacing.sm, // 8
        paddingHorizontal: spacing.md, // 12
    },
    haveQrText: {
        fontSize: fontSizes.h5, // 14
        color: colors.systemcolor,
        fontWeight: typography.fontWeights.medium, // '500'
        textAlign: 'center',
    },
    footer: {
        width: '100%',
        alignItems: 'center',
        paddingVertical: spacing.lg, // 20
    },
    guideLink: {
        fontSize: fontSizes.h5, // 14
        color: colors.textMuted, // #555
        textDecorationLine: 'underline',
        textAlign: 'center',
    },
});
