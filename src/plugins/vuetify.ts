import { createVuetify } from "vuetify";
import "vuetify/styles";
import { aliases, mdi } from "vuetify/iconsets/mdi-svg";
import { useI18n, I18n } from "vue-i18n";
import { createVueI18nAdapter } from "vuetify/locale/adapters/vue-i18n";

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
