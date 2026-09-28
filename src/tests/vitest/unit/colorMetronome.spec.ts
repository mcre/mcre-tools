import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";
import { useColorMetronome } from "@/composables/useColorMetronome";
import { useColorMetronomeSettings } from "@/composables/useColorMetronomeSettings";

describe("color metronome", () => {
  const scopes: ReturnType<typeof effectScope>[] = [];
  const createMetronome = () => {
    const scope = effectScope();
    scopes.push(scope);
    return scope.run(() => {
      const preferences = useColorMetronomeSettings();
      return {
        scope,
        preferences,
        metronome: useColorMetronome(preferences.settings),
      };
    })!;
  };

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    for (const scope of scopes.splice(0)) scope.stop();
    vi.useRealTimers();
  });

  it("starts stopped on white without creating a timer", () => {
    const { metronome } = createMetronome();
    expect(metronome.currentColor.value.hex).toBe("#ffffff");
    expect(metronome.isRunning.value).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cycles white, dark gray, red at approximately two thirds of a second", () => {
    const { metronome, preferences } = createMetronome();
    preferences.setBeats(3);
    metronome.start();
    expect(metronome.currentColor.value.hex).toBe("#ffffff");
    vi.advanceTimersByTime(600);
    expect(metronome.currentColor.value.hex).toBe("#ffffff");
    vi.advanceTimersByTime(67);
    expect(metronome.currentColor.value.hex).toBe("#404040");
    vi.advanceTimersByTime(667);
    expect(metronome.currentColor.value.hex).toBe("#ff6347");
    vi.advanceTimersByTime(667);
    expect(metronome.currentColor.value.hex).toBe("#ffffff");
  });

  it("stops on the current color and restarts from white", () => {
    const { metronome } = createMetronome();
    metronome.start();
    vi.advanceTimersByTime(667);
    metronome.stop();
    metronome.stop();
    expect(metronome.isRunning.value).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(10_000);
    expect(metronome.currentColor.value.hex).toBe("#404040");
    metronome.start();
    expect(metronome.currentColor.value.hex).toBe("#ffffff");
    vi.advanceTimersByTime(667);
    expect(metronome.currentColor.value.hex).toBe("#404040");
  });

  it("does not create duplicate timers or reset the beat on repeated starts", () => {
    const { metronome } = createMetronome();
    metronome.start();
    vi.advanceTimersByTime(667);
    metronome.start();
    expect(metronome.currentColor.value.hex).toBe("#404040");
    expect(vi.getTimerCount()).toBe(1);
  });

  it("resets playback to the first beat and clears pending timers", () => {
    const { metronome, preferences } = createMetronome();
    preferences.setBpm(120);
    preferences.setSubdivision(4);
    metronome.start();
    vi.advanceTimersByTime(750);
    preferences.setBpm(180);
    expect(metronome.currentIndex.value).toBe(1);
    expect(metronome.shadeOpacity.value).toBeGreaterThan(0);
    metronome.reset();
    expect(metronome.currentIndex.value).toBe(0);
    expect(metronome.shadeOpacity.value).toBe(0);
    expect(metronome.isRunning.value).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(3000);
    expect(metronome.currentIndex.value).toBe(0);
    metronome.start();
    vi.advanceTimersByTime(334);
    expect(metronome.currentIndex.value).toBe(1);
  });

  it("clears the timer when its component scope is disposed", () => {
    const { metronome, scope } = createMetronome();
    metronome.start();
    vi.advanceTimersByTime(667);
    scope.stop();
    expect(vi.getTimerCount()).toBe(0);
    expect(metronome.isRunning.value).toBe(false);
    vi.advanceTimersByTime(10_000);
    expect(metronome.currentColor.value.hex).toBe("#404040");
  });

  it.each([1, 2, 3, 4])(
    "darkens in %i steps and holds each level until the next tick",
    (subdivision) => {
      const { metronome, preferences } = createMetronome();
      preferences.setBpm(120);
      preferences.setSubdivision(subdivision);
      metronome.start();
      const origin = performance.now();
      for (let step = 0; step < subdivision; step++) {
        vi.advanceTimersByTime(
          Math.ceil((step * 500) / subdivision) - (performance.now() - origin),
        );
        expect(metronome.currentIndex.value).toBe(0);
        expect(metronome.shadeOpacity.value).toBeCloseTo(
          (0.6 * step) / subdivision,
        );
        vi.advanceTimersByTime(90);
        expect(metronome.shadeOpacity.value).toBeCloseTo(
          (0.6 * step) / subdivision,
        );
        expect(vi.getTimerCount()).toBe(1);
      }
      vi.advanceTimersByTime(500 - (performance.now() - origin));
      expect(metronome.currentIndex.value).toBe(1);
      expect(metronome.shadeColor.value).toBe("#000000");
      expect(metronome.shadeOpacity.value).toBe(0);
    },
  );

  it("applies tempo at the next beat without resetting the measure", () => {
    const { metronome, preferences } = createMetronome();
    preferences.setBpm(120);
    preferences.setBeats(3);
    metronome.start();
    vi.advanceTimersByTime(200);
    preferences.setBpm(60);
    vi.advanceTimersByTime(299);
    expect(metronome.currentIndex.value).toBe(0);
    vi.advanceTimersByTime(1);
    expect(metronome.currentIndex.value).toBe(1);
    vi.advanceTimersByTime(999);
    expect(metronome.currentIndex.value).toBe(1);
    vi.advanceTimersByTime(1);
    expect(metronome.currentIndex.value).toBe(2);
  });

  it("restarts the measure on the next beat for beat and subdivision changes", () => {
    const { metronome, preferences } = createMetronome();
    preferences.setBpm(120);
    preferences.setBeats(3);
    metronome.start();
    vi.advanceTimersByTime(700);
    preferences.setBeats(4);
    preferences.setSubdivision(2);
    vi.advanceTimersByTime(299);
    expect(metronome.currentIndex.value).toBe(1);
    vi.advanceTimersByTime(1);
    expect(metronome.currentIndex.value).toBe(0);
    vi.advanceTimersByTime(250);
    expect(metronome.currentIndex.value).toBe(0);
    expect(metronome.shadeOpacity.value).toBeCloseTo(0.3);
    vi.advanceTimersByTime(1250);
    expect(metronome.currentIndex.value).toBe(3);
    vi.advanceTimersByTime(500);
    expect(metronome.currentIndex.value).toBe(0);
  });

  it("alternates brightness on a single black beat and updates colors immediately", () => {
    const { metronome, preferences } = createMetronome();
    preferences.setBpm(120);
    preferences.setBeats(1);
    preferences.setColor(0, "#000000");
    metronome.start();
    expect(metronome.shadeColor.value).toBe("#ffffff");
    vi.advanceTimersByTime(100);
    expect(metronome.shadeOpacity.value).toBe(0);
    vi.advanceTimersByTime(400);
    expect(metronome.shadeOpacity.value).toBeCloseTo(0.3);
    vi.advanceTimersByTime(499);
    expect(metronome.shadeOpacity.value).toBeCloseTo(0.3);
    vi.advanceTimersByTime(1);
    expect(metronome.shadeOpacity.value).toBe(0);
    preferences.setColor(0, "#ffffff");
    expect(metronome.currentColor.value.hex).toBe("#ffffff");
    expect(metronome.shadeColor.value).toBe("#000000");
    metronome.stop();
    expect(metronome.shadeOpacity.value).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("holds shading even at the shortest tick interval", () => {
    const { metronome, preferences } = createMetronome();
    preferences.setBpm(250);
    preferences.setSubdivision(4);
    metronome.start();
    vi.advanceTimersByTime(60);
    expect(metronome.shadeOpacity.value).toBeCloseTo(0.15);
    vi.advanceTimersByTime(59);
    expect(metronome.shadeOpacity.value).toBeCloseTo(0.15);
    vi.advanceTimersByTime(1);
    expect(metronome.shadeOpacity.value).toBeCloseTo(0.3);
    vi.advanceTimersByTime(60);
    expect(metronome.shadeOpacity.value).toBeCloseTo(0.45);
    metronome.stop();
    expect(metronome.shadeOpacity.value).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("switches directly to each beat color without a brightness change afterward", () => {
    const { metronome, preferences } = createMetronome();
    preferences.setBpm(120);
    preferences.setBeats(3);
    metronome.start();
    for (const color of ["#ffffff", "#404040", "#ff6347", "#ffffff"]) {
      expect(metronome.currentColor.value.hex).toBe(color);
      expect(metronome.shadeOpacity.value).toBe(0);
      vi.advanceTimersByTime(80);
      expect(metronome.currentColor.value.hex).toBe(color);
      expect(metronome.shadeOpacity.value).toBe(0);
      vi.advanceTimersByTime(420);
    }
  });

  it("holds alternate brightness for adjacent identical colors without subdivision", () => {
    const { metronome, preferences } = createMetronome();
    preferences.setBpm(120);
    preferences.setBeats(3);
    preferences.setColor(1, "#ffffff");
    metronome.start();
    expect(metronome.shadeOpacity.value).toBe(0);
    vi.advanceTimersByTime(500);
    expect(metronome.currentColor.value.hex).toBe("#ffffff");
    expect(metronome.shadeOpacity.value).toBeCloseTo(0.3);
    vi.advanceTimersByTime(80);
    expect(metronome.shadeOpacity.value).toBeCloseTo(0.3);
    vi.advanceTimersByTime(420);
    expect(metronome.currentColor.value.hex).toBe("#ff6347");
    expect(metronome.shadeOpacity.value).toBe(0);
  });

  it("cycles two beats by default", () => {
    const { metronome } = createMetronome();
    metronome.start();
    vi.advanceTimersByTime(667);
    expect(metronome.currentColor.value.hex).toBe("#404040");
    vi.advanceTimersByTime(667);
    expect(metronome.currentColor.value.hex).toBe("#ffffff");
  });

  it("catches up from elapsed time without replaying missed ticks", () => {
    const { metronome, preferences } = createMetronome();
    preferences.setBpm(120);
    preferences.setBeats(3);
    metronome.start();
    const clock = vi.spyOn(performance, "now").mockReturnValue(2650);
    vi.advanceTimersByTime(500);
    expect(metronome.currentIndex.value).toBe(2);
    expect(metronome.shadeOpacity.value).toBe(0);
    expect(vi.getTimerCount()).toBe(1);
    clock.mockRestore();
  });
});
