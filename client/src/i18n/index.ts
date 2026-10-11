import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import kg from "./locales/kg.json";
import ru from "./locales/ru.json";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      kg: { translation: kg },
      ru: { translation: ru },
    },
    fallbackLng: "kg",
    supportedLngs: ["kg", "ru"],
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

// Tell the API which language to answer in: the server translates its
// error/success messages based on Accept-Language (server/src/common/i18n.ts).
// Done once here instead of in each of the many fetch() calls in lib/*-api.ts.
const nativeFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.includes("/api/")) return nativeFetch(input, init);
  const headers = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : undefined),
  );
  headers.set("Accept-Language", i18n.resolvedLanguage ?? i18n.language ?? "kg");
  return nativeFetch(input, { ...init, headers });
};

export default i18n;
