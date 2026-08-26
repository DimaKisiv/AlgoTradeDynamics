import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { translations } from '../i18n/translations';

const STORAGE_KEY = 'algoTradeDynamics.language';
const DEFAULT_LANGUAGE = 'uk';

const LanguageContext = createContext(null);

function getNestedValue(source, path) {
  return path
    .split('.')
    .reduce((acc, key) => (acc === null || acc === undefined ? undefined : acc[key]), source);
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved && translations[saved] ? saved : DEFAULT_LANGUAGE;
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(() => {
    const t = (key) => {
      const localized = getNestedValue(translations[language], key);
      if (localized !== null && localized !== undefined) {
        return localized;
      }
      const fallback = getNestedValue(translations[DEFAULT_LANGUAGE], key);
      return fallback !== null && fallback !== undefined ? fallback : key;
    };

    const locale = language === 'uk' ? 'uk-UA' : 'en-US';
    const tr = (ukrainian, english) => (language === 'uk' ? ukrainian : english);
    const formatDate = (value, options) => {
      if (!value) {return '—';}
      return new Date(value).toLocaleDateString(locale, options);
    };
    const formatDateTime = (value, options) => {
      if (!value) {return '—';}
      return new Date(value).toLocaleString(locale, options);
    };
    const formatNumber = (value, options) => Number(value).toLocaleString(locale, options);

    return {
      language,
      locale,
      setLanguage,
      t,
      tr,
      formatDate,
      formatDateTime,
      formatNumber,
      isUkrainian: language === 'uk',
    };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
