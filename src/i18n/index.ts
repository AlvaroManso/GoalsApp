import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Usamos storage local para guardar preferencia

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

const initI18n = async () => {
  let savedLanguage = await AsyncStorage.getItem('user-language');
  
  if (!savedLanguage) {
    const locales = Localization.getLocales();
    const deviceLang = locales[0].languageCode;
    // Si el idioma del dispositivo está en los recursos, usarlo. Si no, inglés.
    savedLanguage = Object.keys(resources).includes(deviceLang) ? deviceLang : 'en';
  }

  i18n
    .use(initReactI18next)
    .init({
      compatibilityJSON: 'v3',
      resources,
      lng: savedLanguage,
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false // React ya hace unescape
      }
    });
};

initI18n();

export default i18n;
