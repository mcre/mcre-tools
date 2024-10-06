import { RouterOptions } from "vite-ssg";

import Index from "@/pages/index.vue";
import Jukugo from "@/pages/jukugo.vue";

export const routerOptions: RouterOptions = {
  routes: [
    { path: "/", name: "index", component: Index },
    { path: "/jukugo", name: "jukugo", component: Jukugo },
  ],
};
