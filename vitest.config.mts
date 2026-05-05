import { resolve } from "node:path";
import VueI18nPlugin from "@intlify/unplugin-vue-i18n/vite";
import vue from "@vitejs/plugin-vue";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { loadEnv } from "vite";
import Vuetify from "vite-plugin-vuetify";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/tests/vitest/**/*.spec.ts"],
    setupFiles: "src/tests/vitest/setup.ts",
    env: loadEnv("production", process.cwd(), ""),
    server: {
      deps: {
        inline: ["vuetify"],
      },
    },
  },
  plugins: [
    vue(),
    Vuetify({
      autoImport: true,
      styles: {
        configFile: "src/styles/settings.scss",
      },
    }),
    AutoImport({
      imports: [
        "vue",
        {
          "vue-router": ["useRoute", "useRouter"],
        },
      ],
      dirs: ["src/composables", "src/utils", "src/router"],
      dts: "src/auto-imports.d.ts",
      vueTemplate: true,
    }),
    Components({
      dirs: ["src/components"],
      dts: "src/components.d.ts",
    }),
    VueI18nPlugin({
      include: resolve(__dirname, "./src/locales"),
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
