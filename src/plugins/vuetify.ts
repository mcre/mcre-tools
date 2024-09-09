// Styles
import "@mdi/font/css/materialdesignicons.css";
import "vuetify/styles";

// Composables
import { createVuetify } from "vuetify";

export default createVuetify({
  theme: {
    defaultTheme: window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
    themes: {
      light: {},
      dark: {},
    },
  },
});
