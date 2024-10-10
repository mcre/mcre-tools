import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import Vuetify from "vite-plugin-vuetify";
import { resolve } from "path";
import dotenv from "dotenv";

import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    server: {
      deps: {
        inline: ["vuetify"],
      },
    },
    include: ["src/tests/**/*.spec.ts"],
    setupFiles: "src/tests/setup.ts",
    env: dotenv.config({ path: ".env.production" }).parsed,
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
          "vue-router/auto": ["useRoute", "useRouter"],
        },
      ],
      dts: "src/auto-imports.d.ts",
      vueTemplate: true,
      dirs: ["src/composables", "src/router"],
    }),
    Components({
      dts: "src/components.d.ts",
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
