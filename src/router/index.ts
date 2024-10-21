import { RouterOptions } from "vite-ssg";
import { availableLocales } from "@/plugins/i18n";

import Layout from "@/layouts/default.vue";

import Index from "@/pages/index.vue";
import NotFound from "@/pages/not-found.vue";

import Jukugo from "@/pages/jukugo.vue";

const toolsComponents: { [key: string]: Component } = {
  jukugo: Jukugo,
};
export const tools = Object.keys(toolsComponents);

const generateRoutes = () => {
  const routes = [];

  for (const locale of availableLocales) {
    const children = [];
    children.push({ path: "", component: Index });

    for (const path in toolsComponents) {
      if (toolsComponents.hasOwnProperty(path)) {
        children.push({ path, component: toolsComponents[path] });
      }
    }

    children.push({ path: ":pathMatch(.*)*", component: NotFound });
    routes.push({
      path: `/${locale}/`,
      component: Layout,
      children,
    });
  }

  routes.push({
    path: "/",
    component: Layout,
  });

  return routes;
};

export const routerOptions: RouterOptions = {
  routes: generateRoutes(),
  scrollBehavior(to, from, savedPosition) {
    return new Promise((resolve) => {
      if (to.hash) {
        resolve({ el: to.hash });
      } else if (from.path !== to.path) {
        resolve({ top: 0 });
      }
    });
  },
};
