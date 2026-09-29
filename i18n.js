// Minimal i18n: English strings are the keys; Spanish comes from locales/es.js.
// Unknown keys fall back to the English text, so a missing translation never breaks the UI.
// Interpolation: t('Closes in {h}h {m}m', { h: 1, m: 5 }).
import { NativeModules, Platform } from 'react-native';
import es from './locales/es';

const DICTS = { es };
let current = 'en';

export const detectDeviceLanguage = () => {
  try {
    const s = NativeModules.SettingsManager?.settings;
    const raw = Platform.OS === 'ios'
      ? (s?.AppleLanguages?.[0] ?? s?.AppleLocale)
      : NativeModules.I18nManager?.localeIdentifier;
    return String(raw ?? 'en').toLowerCase().startsWith('es') ? 'es' : 'en';
  } catch {
    return 'en';
  }
};

// pref: 'auto' | 'en' | 'es'
export const resolveLanguage = (pref) => (pref === 'en' || pref === 'es' ? pref : detectDeviceLanguage());

export const setLanguage = (lang) => { current = lang === 'es' ? 'es' : 'en'; };
export const getLanguage = () => current;

export const t = (key, vars) => {
  let out = DICTS[current]?.[key] ?? key;
  if (vars) {
    out = out.replace(/\{(\w+)\}/g, (m, name) => (vars[name] !== undefined ? String(vars[name]) : m));
  }
  return out;
};

// BCP-47 locale for Date/Number formatting, following the in-app language.
export const locale = () => (current === 'es' ? 'es-US' : 'en-US');
