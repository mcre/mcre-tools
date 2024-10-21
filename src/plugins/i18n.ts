import { createI18n } from "vue-i18n";

const modules = import.meta.glob<Record<string, any>>("@/locales/*.json", {
  eager: true,
});

const messages: Record<string, any> = {};

for (const path in modules) {
  const locale = path.match(/\/([\w-]+)\.json$/)?.[1];
  if (locale) {
    messages[locale] = modules[path].default;
  }
}

export const availableLocales = Object.keys(messages);
export type AvailableLocales = keyof typeof messages;
export const defaultLocale = "ja";

export const setupI18n = (locale?: string) => {
  return createI18n({
    legacy: false, // Vuetify does not support the legacy mode of vue-i18n
    locale: locale || defaultLocale,
    fallbackLocale: locale || defaultLocale,
    messages,
  });
};
