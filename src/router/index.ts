import type { RouteRecordRaw, RouterScrollBehavior } from "vue-router";
import { availableLocales } from "@/plugins/i18n";

const Layout = () => import("@/layouts/default.vue");
const Index = () => import("@/pages/index.vue");
const Jukugo = () => import("@/pages/jukugo.vue");
const NotFound = () => import("@/pages/not-found.vue");

const toolsComponents = {
  jukugo: Jukugo,
};
export const tools = Object.keys(toolsComponents);

const generateRoutes = (): RouteRecordRaw[] => {
  const routes: RouteRecordRaw[] = [];

  for (const locale of availableLocales) {
    const children: RouteRecordRaw[] = [{ path: "", component: Index }];

    for (const [path, component] of Object.entries(toolsComponents)) {
      children.push({ path, component });
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
