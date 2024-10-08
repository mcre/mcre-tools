import { createVuetify } from "vuetify";
import "vuetify/styles";
import { mdi } from "vuetify/iconsets/mdi-svg";

export default createVuetify({
  icons: {
    defaultSet: "mdi",
    sets: {
      mdi,
    },
  },
  theme: {
    defaultTheme: "light",
    themes: {
      light: {},
      dark: {},
    },
  },
});
