import { registerPlugins } from "@/plugins";
//import { routerOptions } from "./router";

import App from "./App.vue";
import { ViteSSG } from "vite-ssg";
import routes from "~pages";

import "@/styles/global.scss";

export const createApp = ViteSSG(App, { routes }, ({ app }) => {
  registerPlugins(app);
});
