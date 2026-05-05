import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import VueI18nPlugin from "@intlify/unplugin-vue-i18n/vite";
import Vue from "@vitejs/plugin-vue";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { defineConfig, loadEnv } from "vite";
import Vuetify, { transformAssetUrls } from "vite-plugin-vuetify";
import generateSitemap from "vite-ssg-sitemap";
import "vite-ssg";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      Vue({
        template: { transformAssetUrls },
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
        "@": fileURLToPath(new URL("src", import.meta.url)),
      },
      extensions: [".js", ".json", ".jsx", ".mjs", ".ts", ".tsx", ".vue"],
    },
    server: {
      port: 3000,
    },
    ssr: {
      noExternal: ["vuetify", "aspida", "@aspida/fetch"],
    },
    ssgOptions: {
      script: "async defer",
      formatting: "minify",
      dirStyle: "nested",
      beastiesOptions: false,
      onFinished() {
        generateSitemap({
          hostname: `https://${env.VITE_DISTRIBUTION_DOMAIN_NAME}`,
          exclude: ["/", "/404"],
          changefreq: "monthly",
          robots: [
            { userAgent: "*", allow: "/" },
            { userAgent: "OAI-SearchBot", allow: "/" },
            { userAgent: "ChatGPT-User", allow: "/" },
            { userAgent: "GPTBot", allow: "/" },
          ],
        });
      },
    },
  };
});
