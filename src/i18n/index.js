import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import * as RNLocalize from 'react-native-localize';
import {getData, saveData} from '../components/AsyncStorage';
import vi from './resources/vi.json';
import en from './resources/en.json';

export const APP_LOCALE_KEY = 'app_locale';

const SUPPORTED = ['vi', 'en'];

function resolveLng(saved) {
  if (saved && SUPPORTED.includes(saved)) {
    return saved;
  }
  const code = RNLocalize.getLocales()[0]?.languageCode;
  return code === 'en' ? 'en' : 'vi';
}

i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  resources: {
    vi: {translation: vi},
    en: {translation: en},
  },
  lng: 'vi',
  fallbackLng: 'vi',
  interpolation: {escapeValue: false},
});

/**
 * Gọi sau khi MMKV/migration sẵn sàng; áp dụng locale đã lưu hoặc theo thiết bị.
 */
export async function bootstrapI18n() {
  const saved = await getData(APP_LOCALE_KEY);
  const lng = resolveLng(saved);
  await i18n.changeLanguage(lng);
}

export async function setAppLanguage(lng) {
  if (!SUPPORTED.includes(lng)) {
    return;
  }
  await i18n.changeLanguage(lng);
  await saveData(APP_LOCALE_KEY, lng);
}

export default i18n;
