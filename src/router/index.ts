import { RouterOptions } from "vite-ssg";
import Index from '@/pages/index.vue';
import NotFound from '@/pages/not-found.vue';

export type ToolParams = {
  title: string;
  path: string;
  iconDir: string;
  descriptionShort: string;
  description: string;
};

export type Tool = {
  component: Component;
  params: ToolParams;
};

type Tools = {
  [key: string]: Tool;
};


import Jukugo from '@/pages/jukugo.vue';

export const tools: Tools = {
  jukugo: {
    component: Jukugo,
    params: {
      title: "熟語パズル",
      path: "/jukugo",
      iconDir: "jukugo",
      descriptionShort: "和同開珎を自動で解きます",
      description:
        "上下左右4つの漢字から真ん中の漢字を当てるパズル、いわゆる「和同開珎」を自動で解くツール（ソルバー）です。",
    },
  },
};


export const routerOptions: RouterOptions = {
  routes: [
    { path: "/", name: "index", component: Index },
    ...Object.keys(tools).map((key) => ({
      path: tools[key].params.path,
      name: key,
      component: tools[key].component,
    })),
    {
      path: "/:pathMatch(.*)*",
      component: NotFound,
    },
  ],
  scrollBehavior(to, from, savedPosition) {
    return new Promise((resolve) => {
      nextTick(() => {
        if (to.hash) {
          resolve({ el: to.hash });
        } else if (from.path != to.path) {
          return { top: 0 };
        }
      });
    });
  },
};
