import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ru from "./locales/ru.json";
import kk from "./locales/kk.json";

export const LOCALE_STORAGE_KEY = "pine-b2b-locale";
export const SUPPORTED_LOCALES = ["ru", "en", "kk"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_LABELS: Record<AppLocale, string> = {
  ru: "Русский",
  en: "English",
  kk: "Қазақша",
};

function getStoredLocale(): AppLocale | null {
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored && SUPPORTED_LOCALES.includes(stored as AppLocale)) {
    return stored as AppLocale;
  }
  return null;
}

export function setAppLocale(locale: AppLocale) {
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  void i18n.changeLanguage(locale);
  document.documentElement.lang = locale;
}

const initialLocale = getStoredLocale() ?? "ru";

void i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    en: { translation: en },
    kk: { translation: kk },
  },
  lng: initialLocale,
  fallbackLng: "ru",
  interpolation: { escapeValue: false },
});

document.documentElement.lang = initialLocale;

export default i18n;
