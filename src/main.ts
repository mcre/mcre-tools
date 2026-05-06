import { ViteSSG } from "vite-ssg";

import { availableLocales, defaultLocale, setupI18n } from "@/plugins/i18n";
import { setupVuetify } from "@/plugins/vuetify";
import { scheduleThirdPartyScripts } from "@/utils/thirdPartyScripts";

import App from "./App.vue";
import { routerOptions } from "./router";

import "@/styles/global.scss";

export const createApp = ViteSSG(
  App,
  routerOptions,
  ({ app, router, isClient }) => {
    if (isClient) {
      const i18n = setupI18n();
      const vuetify = setupVuetify(i18n);
      app.use(i18n);
      app.use(vuetify);

      router.beforeEach((to) => {
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
        } else {
          const toPath = to.path == "/" ? "" : to.path;
          return {
            path: `/${defaultLocale}${toPath}`,
            query: to.query,
            hash: to.hash,
          };
        }
      });

      scheduleThirdPartyScripts();
    } else {
      router.beforeEach((to) => {
        const locale =
          availableLocales.find((loc) => to.path.startsWith(`/${loc}`)) ||
          defaultLocale;

        const i18n = setupI18n(locale);
        const vuetify = setupVuetify(i18n);
        app.use(i18n);
        app.use(vuetify);
      });
    }
  },
);
