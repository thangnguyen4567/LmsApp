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
import { colors } from '../constants';
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
      style={styles.scroll}
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
  scroll: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
  },
  contentWrapper: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  langChip: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'transparent',
    marginBottom: 8,
  },
  langChipImage: {
    width: 30,
    height: 30,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  card: {
    width: '100%',
    maxWidth: Platform.isPad ? 520 : undefined,
    alignSelf: Platform.isPad ? 'center' : undefined,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
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
    fontSize: 16,
    fontWeight: '600',
    color: colors.systemcolor,
    marginBottom: 10,
    textAlign: 'center',
  },
  cardBody: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
    textAlign: 'left',
  },
  footer: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
});
