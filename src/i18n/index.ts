import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import { getSetting } from '../db/settings';

// Importar traducciones (las crearemos a continuación)
import en from './locales/en.json';
import es from './locales/es.json';
import zh from './locales/zh.json';
import hi from './locales/hi.json';
import fr from './locales/fr.json';

const resources = {
  en: { translation: en },
  es: { translation: es },
  zh: { translation: zh },
  hi: { translation: hi },
  fr: { translation: fr }
};

const getDefaultLanguage = (): string => {
  const locales = Localization.getLocales();
  const deviceLang = locales[0]?.languageCode ?? 'en';
  return Object.keys(resources).includes(deviceLang) ? deviceLang : 'en';
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getDefaultLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export const hydrateLanguageFromDB = async (): Promise<void> => {
  const saved = getSetting('language');
  if (saved && i18n.language !== saved) {
    await i18n.changeLanguage(saved);
  }
};

export default i18n;
