import type {
  RouteComponent,
  RouteRecordRaw,
  RouterScrollBehavior,
} from "vue-router";
import Layout from "@/layouts/default.vue";
import Index from "@/pages/index.vue";
import Jukugo from "@/pages/jukugo.vue";
import NotFound from "@/pages/not-found.vue";
import { availableLocales } from "@/plugins/i18n";

const toolsComponents: Record<string, RouteComponent> = {
  jukugo: Jukugo,
};
export const tools = Object.keys(toolsComponents);

const generateRoutes = (): RouteRecordRaw[] => {
  const routes: RouteRecordRaw[] = [];

  for (const locale of availableLocales) {
    const children: RouteRecordRaw[] = [{ path: "", component: Index }];

    for (const path in toolsComponents) {
      if (toolsComponents.hasOwnProperty(path)) {
        children.push({ path, component: toolsComponents[path] });
      }
    }

    children.push({ path: ":pathMatch(.*)*", component: NotFound });
    routes.push({
      path: `/${locale}`,
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

const scrollBehavior: RouterScrollBehavior = (to, from) => {
  return new Promise((resolve) => {
    if (to.hash) {
      resolve({ el: to.hash });
    } else if (from.path !== to.path) {
      resolve({ top: 0 });
    }
  });
};

export const routerOptions = {
  routes: generateRoutes(),
  scrollBehavior,
};
