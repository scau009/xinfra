import { createContext, useContext, useState, useMemo, useCallback } from 'react';
import translations from './translations';

function detectLanguage() {
  try {
    const nav = navigator.language || navigator.languages?.[0] || '';
    return nav.startsWith('zh') ? 'zh' : 'en';
  } catch {
    return 'en';
  }
}

function interpolate(text, params) {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (_, key) =>
    params[key] !== undefined ? params[key] : `{${key}}`
  );
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      const stored = localStorage.getItem('plat-lang');
      return stored || detectLanguage();
    } catch {
      return 'en';
    }
  });

  const setLang = useCallback((l) => {
    setLangState(l);
    try { localStorage.setItem('plat-lang', l); } catch {}
  }, []);

  const t = useCallback((key, params) => {
    const dict = translations[lang] || translations.en;
    const text = dict[key];
    if (text === undefined) {
      // Fallback to English, then to the key itself
      const enText = translations.en[key];
      return interpolate(enText !== undefined ? enText : key, params);
    }
    return interpolate(text, params);
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
