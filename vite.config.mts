// Plugins
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import Vue from "@vitejs/plugin-vue";
import Vuetify, { transformAssetUrls } from "vite-plugin-vuetify";
import purgecss from "vite-plugin-purgecss";
import "vite-ssg";

// Utilities
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

// https://vitejs.dev/config/
export default defineConfig({
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
      dirs: ["src/composables", "src/router"],
    }),
    Components({
      dts: "src/components.d.ts",
    }),
    Vue({
      template: { transformAssetUrls },
    }),
    Vuetify({
      autoImport: true,
      styles: {
        configFile: "src/styles/settings.scss",
      },
    }),
    purgecss({
      content: ["dist/**/*.html"],
      safelist: {
        standard: [/-(leave|enter|appear)(|-(to|from|active))$/, /^(?!(|.*?:)cursor-move).+-move$/, /^router-link(|-exact)-active$/, /^scale/, /^fade/, /^v-/],
        greedy: [/data-v-.*/],
      },
    }),
  ],
  define: { "process.env": {} },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    extensions: [".js", ".json", ".jsx", ".mjs", ".ts", ".tsx", ".vue"],
  },
  server: {
    port: 3000,
  },
  build: {
    rollupOptions: {
      external: ["./bin", "./tools", "./backend"],
    },
  },
  ssr: {
    noExternal: ["vuetify", "aspida", "@aspida/fetch"],
  },
  ssgOptions: {
    script: "defer",
    formatting: "minify",
    dirStyle: "nested",
    crittersOptions: {
      preload: "media",
    },
  },
});
