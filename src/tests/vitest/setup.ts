import { config } from "@vue/test-utils";
import { createVuetify } from "vuetify";

const vuetify = createVuetify();

config.global.plugins = [vuetify];

class ResizeObserverMock implements ResizeObserver {
  observe() {}

  unobserve() {}

  disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverMock;
