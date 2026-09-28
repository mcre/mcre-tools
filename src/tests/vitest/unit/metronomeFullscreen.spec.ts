import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, ref } from "vue";
import { useMetronomeFullscreen } from "@/composables/useMetronomeFullscreen";

describe("metronome fullscreen", () => {
  const scopes: ReturnType<typeof effectScope>[] = [];
  const create = () => {
    const scope = effectScope();
    scopes.push(scope);
    const element = document.createElement("div");
    document.body.append(element);
    const running = ref(true);
    return {
      scope,
      element,
      running,
      fullscreen: scope.run(() =>
        useMetronomeFullscreen(ref(element), running),
      )!,
    };
  };
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    for (const scope of scopes.splice(0)) scope.stop();
    document.body.replaceChildren();
    document.body.style.overflow = "";
    Reflect.deleteProperty(document, "fullscreenElement");
    Reflect.deleteProperty(document, "exitFullscreen");
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("falls back to a viewport overlay and hides only idle running controls", async () => {
    document.body.style.overflow = "auto";
    const { fullscreen, running } = create();
    await fullscreen.enter();
    expect(fullscreen.isExpanded.value).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");
    vi.advanceTimersByTime(2000);
    expect(fullscreen.controlsVisible.value).toBe(false);
    fullscreen.setControlsFocused(false);
    expect(fullscreen.controlsVisible.value).toBe(false);
    fullscreen.activity();
    expect(fullscreen.controlsVisible.value).toBe(true);
    fullscreen.setControlsFocused(true);
    vi.advanceTimersByTime(3000);
    expect(fullscreen.controlsVisible.value).toBe(true);
    fullscreen.setControlsFocused(false);
    vi.advanceTimersByTime(2000);
    expect(fullscreen.controlsVisible.value).toBe(false);
    running.value = false;
    expect(fullscreen.controlsVisible.value).toBe(true);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(fullscreen.isExpanded.value).toBe(false);
    expect(document.body.style.overflow).toBe("auto");
  });

  it("follows native fullscreen changes and exits only its own element", async () => {
    const { fullscreen, element } = create();
    let active: Element | null = null;
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => active,
    });
    element.requestFullscreen = vi.fn(async () => {
      active = element;
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    document.exitFullscreen = vi.fn(async () => {
      active = null;
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    await fullscreen.enter();
    expect(element.requestFullscreen).toHaveBeenCalledOnce();
    expect(fullscreen.isExpanded.value).toBe(true);
    await fullscreen.exit();
    expect(document.exitFullscreen).toHaveBeenCalledOnce();
    expect(fullscreen.isExpanded.value).toBe(false);
  });

  it("falls back on rejection and restores the page on disposal", async () => {
    const { fullscreen, element, scope } = create();
    element.requestFullscreen = vi
      .fn()
      .mockRejectedValue(new Error("unsupported"));
    await fullscreen.enter();
    expect(fullscreen.isExpanded.value).toBe(true);
    scope.stop();
    expect(fullscreen.isExpanded.value).toBe(false);
    expect(document.body.style.overflow).toBe("");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not expand after leaving during an outstanding request", async () => {
    const { fullscreen, element, scope } = create();
    let reject!: (error: Error) => void;
    element.requestFullscreen = vi.fn(
      () =>
        new Promise<void>((_, rejectRequest) => {
          reject = rejectRequest;
        }),
    );
    const request = fullscreen.enter();
    scope.stop();
    reject(new Error("late failure"));
    await request;
    expect(fullscreen.isExpanded.value).toBe(false);
    expect(document.body.style.overflow).toBe("");
  });
});
