import { afterEach, describe, expect, it } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import { useAntExpandedView } from "@/composables/useAntExpandedView";

const scopes: ReturnType<typeof effectScope>[] = [];
const create = () => {
  const scope = effectScope();
  scopes.push(scope);
  const target = document.createElement("section");
  const nestedOverlay = ref(false);
  target.tabIndex = -1;
  document.body.append(target);
  const view = scope.run(() => useAntExpandedView(ref(target), nestedOverlay))!;
  return { view, target, scope, nestedOverlay };
};
afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop();
  document.body.replaceChildren();
  document.body.style.overflow = "";
});
describe("ant expanded view", () => {
  it("locks page scrolling, exits with Escape and restores focus", async () => {
    document.body.style.overflow = "auto";
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const { view, target } = create();
    await view.enter();
    expect(view.isExpanded.value).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.activeElement).toBe(target);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await nextTick();
    expect(view.isExpanded.value).toBe(false);
    expect(document.body.style.overflow).toBe("auto");
    expect(document.activeElement).toBe(opener);
  });
  it("restores the previous overflow when leaving an expanded page", async () => {
    document.body.style.overflow = "scroll";
    const { view, scope } = create();
    await view.enter();
    scope.stop();
    expect(view.isExpanded.value).toBe(false);
    expect(document.body.style.overflow).toBe("scroll");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await view.enter();
    expect(view.isExpanded.value).toBe(false);
  });
  it("leaves keyboard handling to an open map menu", async () => {
    const { view, nestedOverlay } = create();
    await view.enter();
    nestedOverlay.value = true;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(view.isExpanded.value).toBe(true);
    nestedOverlay.value = false;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(view.isExpanded.value).toBe(false);
  });
});
