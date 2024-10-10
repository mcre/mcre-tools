import { mount } from "@vue/test-utils";
import { describe, it } from "vitest";
import { findComponent, expectIconToBe } from "@/tests/helpers";
import JukugoArrowButton from "@/components/JukugoArrowButton.vue";
import {
  mdiArrowUpThick,
  mdiArrowDownThick,
  mdiArrowLeftThick,
  mdiArrowRightThick,
} from "@mdi/js";

type Direction = "up" | "down" | "left" | "right";

describe("JukugoArrowButton", () => {
  const createWrapper = (
    forward: Direction,
    reverse: Direction,
    modelValueRef: { value: boolean },
  ) => {
    return mount(JukugoArrowButton, {
      props: {
        forward: forward,
        reverse: reverse,
        modelValue: modelValueRef.value,
      },
    });
  };

  it("クリックによって上下方向が反転する", async () => {
    const model = ref(true);
    const w = createWrapper("down", "up", model);

    const btn = findComponent(w, "VBtn");
    const icon = findComponent(btn, "VIcon");

    expectIconToBe(icon, mdiArrowDownThick);
    await btn.trigger("click");
    expectIconToBe(icon, mdiArrowUpThick);
    await btn.trigger("click");
    expectIconToBe(icon, mdiArrowDownThick);
  });

  it("クリックによって左右方向が反転する", async () => {
    const model = ref(true);
    const w = createWrapper("right", "left", model);

    const btn = findComponent(w, "VBtn");
    const icon = findComponent(btn, "VIcon");

    expectIconToBe(icon, mdiArrowRightThick);
    await btn.trigger("click");
    expectIconToBe(icon, mdiArrowLeftThick);
    await btn.trigger("click");
    expectIconToBe(icon, mdiArrowRightThick);
  });
});
