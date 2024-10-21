import { defineConfig, loadEnv } from "vite";
import { fileURLToPath, URL } from "node:url";

import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import Vue from "@vitejs/plugin-vue";
import Vuetify, { transformAssetUrls } from "vite-plugin-vuetify";
import VueI18nPlugin from "unplugin-vue-i18n/vite";
import path from "path";
import "vite-ssg";
import generateSitemap from "vite-ssg-sitemap";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      AutoImport({
        imports: [
          "vue",
          {
            "vue-router/auto": ["useRoute", "useRouter"],
          },
        ],
        dts: "src/auto-imports.d.ts",
        eslintrc: {
          enabled: true,
        },
        vueTemplate: true,
        dirs: ["src/utils", "src/router"],
      }),
      Components({
        dts: "src/components.d.ts",
      }),
      Vue({
        template: { transformAssetUrls },
      }),
      // https://github.com/vuetifyjs/vuetify-loader/tree/master/packages/vite-plugin#readme
      Vuetify({
        autoImport: true,
        styles: {
          configFile: "src/styles/settings.scss",
        },
      }),
      VueI18nPlugin({
        include: path.resolve(__dirname, "./src/locales"),
      }),
    ],
    define: { "process.env": {} },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
      extensions: [".js", ".json", ".jsx", ".mjs", ".ts", ".tsx", ".vue"],
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: "modern-compiler",
        },
      },
    },
    server: {
      port: 3000,
    },
    build: {
      rollupOptions: {
        external: ["./bin", "./tools", "./backend", "./src/tests"],
      },
    },
    ssr: {
      noExternal: ["vuetify", "aspida", "@aspida/fetch"],
    },
    ssgOptions: {
      script: "async defer",
      formatting: "minify",
      dirStyle: "nested",
      crittersOptions: {
        preload: "media",
        pruneSource: true,
      },
      onFinished() {
        generateSitemap({
          hostname: `https://${env.VITE_DISTRIBUTION_DOMAIN_NAME}`,
          exclude: ["/", "/404"],
          changefreq: "monthly",
        });
      },
    },
  };
});
