import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { useAntSimulation } from "@/composables/useAntSimulation";

const { draw } = vi.hoisted(() => ({ draw: vi.fn() }));
vi.mock("@/lib/ants/renderer", () => ({
  createAntRenderer: () => ({ draw, resize: vi.fn() }),
}));
let frames: Map<number, FrameRequestCallback>, sequence: number;
let disconnect: ReturnType<typeof vi.fn>, open: ReturnType<typeof vi.fn>;
const wrappers: ReturnType<typeof mount>[] = [];
const create = () => {
  let api!: ReturnType<typeof useAntSimulation>;
  const wrapper = mount(
    defineComponent({
      setup() {
        const canvas = ref<HTMLCanvasElement>();
        api = useAntSimulation(canvas);
        return () => h("canvas", { ref: canvas });
      },
    }),
  );
  wrappers.push(wrapper);
  return { api, wrapper };
};
const frame = (time: number) => {
  const callbacks = [...frames.values()];
  frames.clear();
  for (const f of callbacks) f(time);
};
describe("ant browser lifecycle", () => {
  beforeEach(() => {
    frames = new Map();
    sequence = 0;
    draw.mockClear();
    disconnect = vi.fn();
    open = vi.fn(() => {
      throw new Error("storage must not be used");
    });
    vi.stubGlobal("indexedDB", { open });
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((f) => {
        frames.set(++sequence, f);
        return sequence;
      }),
    );
    vi.stubGlobal(
      "cancelAnimationFrame",
      vi.fn((i) => frames.delete(i)),
    );
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = vi.fn();
        disconnect = disconnect;
      },
    );
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
  });
  afterEach(() => {
    for (const w of wrappers.splice(0)) w.unmount();
    vi.unstubAllGlobals();
  });
  it("starts immediately without reading or writing storage", async () => {
    const { api, wrapper } = create();
    expect(api.ready.value).toBe(true);
    expect(api.isRunning.value).toBe(true);
    frame(0);
    frame(100);
    api.pause();
    expect(api.stats.value.tick).toBe(3);
    api.speed.value = 4;
    await nextTick();
    api.reset();
    expect(api.stats.value.tick).toBe(0);
    expect(api.stats.value.ground).toBe(5220);
    expect(api.isRunning.value).toBe(false);
    expect(api).not.toHaveProperty("restart");
    expect(api).not.toHaveProperty("resetDemo");
    window.dispatchEvent(new Event("pagehide"));
    wrapper.unmount();
    expect(open).not.toHaveBeenCalled();
    expect(api).not.toHaveProperty("exportFile");
    expect(api).not.toHaveProperty("importFile");
    expect(api).not.toHaveProperty("saveStatus");
  });
  it("runs one loop, discards hidden time and releases resources", () => {
    const { api, wrapper } = create();
    api.pause();
    api.resume();
    api.resume();
    expect(frames.size).toBe(1);
    frame(0);
    frame(100);
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(frames.size).toBe(0);
    expect(api.isRunning.value).toBe(true);
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    frame(100_000);
    api.pause();
    expect(api.stats.value.tick).toBe(3);
    window.dispatchEvent(new Event("pageshow"));
    expect(frames.size).toBe(0);
    wrapper.unmount();
    expect(disconnect).toHaveBeenCalled();
    api.resume();
    document.dispatchEvent(new Event("visibilitychange"));
    expect(frames.size).toBe(0);
  });
  it("starts paused for reduced motion and can resume", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const { api } = create();
    expect(api.ready.value).toBe(true);
    expect(api.isRunning.value).toBe(false);
    expect(frames.size).toBe(0);
    api.resume();
    expect(frames.size).toBe(1);
  });
  it("starts each visit with a fresh demo and default controls", async () => {
    const first = create();
    first.api.speed.value = 4;
    frame(0);
    frame(100);
    first.wrapper.unmount();
    const { api } = create();
    expect(api.stats.value.tick).toBe(0);
    expect(api.speed.value).toBe(1);
    expect(api).not.toHaveProperty("pheromones");
    expect(api.brushSize.value).toBe(11);
    await nextTick();
    expect(open).not.toHaveBeenCalled();
  });
  it("always draws pheromones and supports fractional playback speeds", async () => {
    const { api } = create();
    api.speed.value = 2.5;
    await nextTick();
    frame(0);
    frame(100);
    api.pause();
    expect(api.stats.value.tick).toBe(7);
    api.reset();
    expect(draw.mock.calls.length).toBeGreaterThan(0);
    expect(draw.mock.calls.every((call) => call[1] === true)).toBe(true);
    expect(api).not.toHaveProperty("pheromones");
  });
  it("selects an initial map and resets to it while retaining playback and brush settings", async () => {
    const { api } = create();
    api.speed.value = 16;
    api.brushSize.value = 21;
    api.tool.value = "erase";
    api.selectMap("shortcut");
    expect(api.mapId.value).toBe("shortcut");
    expect(api.stats.value).toEqual({
      tick: 0,
      ground: 5220,
      carrying: 0,
      delivered: 0,
    });
    expect(api.isRunning.value).toBe(false);
    api.resume();
    frame(0);
    frame(33);
    api.reset();
    expect(api.mapId.value).toBe("shortcut");
    expect(api.stats.value).toEqual({
      tick: 0,
      ground: 5220,
      carrying: 0,
      delivered: 0,
    });
    expect(api.speed.value).toBe(16);
    expect(api.brushSize.value).toBe(21);
    expect(api.tool.value).toBe("erase");
    api.selectMap("open");
    expect(api.mapId.value).toBe("open");
    await nextTick();
  });
});
