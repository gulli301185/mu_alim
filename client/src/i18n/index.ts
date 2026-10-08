import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import kg from "./locales/kg.json";
import ru from "./locales/ru.json";
import en from "./locales/en.json";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      kg: { translation: kg },
      ru: { translation: ru },
      en: { translation: en },
    },
    fallbackLng: "kg",
    supportedLngs: ["kg", "ru", "en"],
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "lang",
      caches: ["localStorage"],
    },
    interpolation: { escapeValue: false },
    // Several translation keys are built from source text that contains a
    // literal ":" (e.g. "events.Семинар: ..."); i18next's default nsSeparator
    // is ":", which would otherwise split those keys at the colon and treat
    // everything before it as a namespace. Disable it since this app only
    // ever uses the single default namespace.
    nsSeparator: false,
  });

export default i18n;
