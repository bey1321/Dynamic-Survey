import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enCommon from "./locales/en/common.json";
import enSurvey from "./locales/en/survey.json";
import arCommon from "./locales/ar/common.json";
import arSurvey from "./locales/ar/survey.json";

i18n.use(initReactI18next).init({
  resources: {
    en: {
      common: enCommon,
      survey: enSurvey,
    },
    ar: {
      common: arCommon,
      survey: arSurvey,
    },
  },
  lng: "en",
  fallbackLng: "en",
  defaultNS: "common",
  ns: ["common", "survey"],
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;