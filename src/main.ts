import { routerOptions } from "./router";

import { setupVuetify } from "@/plugins/vuetify";
import { setupI18n, availableLocales, defaultLocale } from "@/plugins/i18n";

import App from "./App.vue";
import { ViteSSG } from "vite-ssg";

import "@/styles/global.scss";
import "@fontsource-variable/roboto-flex";

export const createApp = ViteSSG(
  App,
  routerOptions,
  ({ app, router, isClient }) => {
    if (isClient) {
      const i18n = setupI18n();
      const vuetify = setupVuetify(i18n);
      app.use(i18n);
      app.use(vuetify);

      router.beforeEach((to, from, next) => {
        const locale = availableLocales.find((loc) =>
          to.path.startsWith(`/${loc}`),
        );

        if (locale) {
          // ロケールが異なる場合は更新
          const currentLocale = i18n.global
            .locale as WritableComputedRef<string>;
          if (currentLocale.value !== locale) {
            currentLocale.value = locale;
          }
          next(); // そのまま進む
        } else {
          // ロケールがない場合、デフォルトにリダイレクト
          return next({
            path: `/${defaultLocale}${to.path}`,
            query: to.query,
            hash: to.hash,
          });
        }
      });
    } else {
      // SSGのときはページごとにi18nインスタンスをつくる
      router.beforeEach((to, from, next) => {
        const locale =
          availableLocales.find((loc) => to.path.startsWith(`/${loc}`)) ||
          defaultLocale;

        const i18n = setupI18n(locale);
        const vuetify = setupVuetify(i18n);
        app.use(i18n);
        app.use(vuetify);
        next();
      });
    }
  },
);
