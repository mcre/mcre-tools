import eslintConfigPrettier from "eslint-config-prettier/flat";
import vuetify from "eslint-config-vuetify";

export default vuetify(
  {
    ts: true,
    ignore: {
      extendIgnore: [
        ".vite-ssg-temp/**",
        "backend/**",
        "dist/**",
        "node_modules/**",
        "src/apis/**",
        "src/auto-imports.d.ts",
        "src/components.d.ts",
      ],
    },
  },
  {
    files: ["**/*.{vue,js,ts,mts}"],
    rules: {
      "antfu/top-level-function": "off",
      "func-style": "off",
      "vue/multi-word-component-names": "off",
      "vue/no-v-text-v-html-on-component": "off",
    },
  },
  eslintConfigPrettier,
);
