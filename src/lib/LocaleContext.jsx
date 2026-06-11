import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const LocaleContext = createContext(null);

export const SUPPORTED_LOCALES = [
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'zhcn', label: '简体中文', flag: '🇨🇳' },
  { code: 'zhtw', label: '繁體中文', flag: '🇹🇼' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'ms', label: 'Bahasa Melayu', flag: '🇲🇾' },
];

export const DEFAULT_LOCALE = 'ja';

export function LocaleProvider({ children }) {
  const [currentLocale, setCurrentLocale] = useState(DEFAULT_LOCALE);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const pathParts = location.pathname.split('/').filter(Boolean);
    const localeFromPath = pathParts[0];
    
    if (SUPPORTED_LOCALES.some(loc => loc.code === localeFromPath)) {
      setCurrentLocale(localeFromPath);
      localStorage.setItem('preferred_locale', localeFromPath);
    } else {
      const saved = localStorage.getItem('preferred_locale') || DEFAULT_LOCALE;
      setCurrentLocale(saved);
    }
  }, [location.pathname]);

  const changeLocale = useCallback((localeCode) => {
    if (!SUPPORTED_LOCALES.some(loc => loc.code === localeCode)) {
      localeCode = DEFAULT_LOCALE;
    }
    
    const pathParts = location.pathname.split('/').filter(Boolean);
    const localeFromPath = pathParts[0];
    
    let newPath;
    if (SUPPORTED_LOCALES.some(loc => loc.code === localeFromPath)) {
      newPath = location.pathname.replace(`/${localeFromPath}`, `/${localeCode}`);
    } else {
      newPath = `/${localeCode}${location.pathname}`;
    }
    
    navigate(newPath);
  }, [location.pathname, navigate]);

  const value = {
    locale: currentLocale,
    changeLocale,
    locales: SUPPORTED_LOCALES,
  };

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
}