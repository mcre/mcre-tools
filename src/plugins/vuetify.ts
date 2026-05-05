import { type I18n, useI18n } from "vue-i18n";
import { createVuetify } from "vuetify";
import { aliases, mdi } from "vuetify/iconsets/mdi-svg";
import { createVueI18nAdapter } from "vuetify/locale/adapters/vue-i18n";
import "vuetify/styles";

export const setupVuetify = (i18nInstance: I18n) => {
  return createVuetify({
    icons: {
      defaultSet: "mdi",
      aliases,
      sets: {
        mdi,
      },
    },
    locale: {
      adapter: createVueI18nAdapter({ i18n: i18nInstance, useI18n }),
    },
    theme: {
      defaultTheme: "light",
      themes: {
        light: {},
        dark: {},
      },
    },
  });
};
