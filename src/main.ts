import { registerPlugins } from "@/plugins";
import { routerOptions } from "./router";

import App from "./App.vue";
import { ViteSSG } from "vite-ssg";

import "@/styles/global.scss";
import "@fontsource-variable/roboto-flex";

export const createApp = ViteSSG(App, routerOptions, ({ app }) => {
  registerPlugins(app);
});
