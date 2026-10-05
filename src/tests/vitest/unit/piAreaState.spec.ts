import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import { usePiAreaExperiment } from "@/composables/usePiAreaExperiment";

describe("circle area experiment state", () => {
  const scopes: ReturnType<typeof effectScope>[] = [];
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    for (const scope of scopes.splice(0)) scope.stop();
    vi.useRealTimers();
  });
  const create = (reducedMotion = ref(false)) => {
    const scope = effectScope();
    scopes.push(scope);
    const experiment = scope.run(() => usePiAreaExperiment(reducedMotion))!;
    return { experiment, reducedMotion, scope };
  };

  it("starts with eight sectors and no animation, then rearranges and returns", () => {
    const { experiment } = create();
    expect(experiment.count.value).toBe(8);
    expect(experiment.layout.value).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    experiment.toggle();
    vi.advanceTimersByTime(500);
    expect(experiment.layout.value).toBeGreaterThan(0);
    expect(experiment.layout.value).toBeLessThan(1);
    vi.advanceTimersByTime(1000);
    expect(experiment.layout.value).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
    experiment.toggle();
    vi.advanceTimersByTime(1500);
    expect(experiment.layout.value).toBe(0);
  });

  it("bounds cuts to even counts and finishes a pending transition when changing cuts", () => {
    const { experiment } = create();
    experiment.toggle();
    vi.advanceTimersByTime(200);
    experiment.setCount(5);
    expect(experiment.count.value).toBe(6);
    expect(experiment.layout.value).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
    experiment.setCount(0);
    expect(experiment.count.value).toBe(4);
    experiment.setCount(10_000);
    expect(experiment.count.value).toBe(256);
    expect(() => experiment.setCount(Number.NaN)).toThrow(RangeError);
  });

  it("rearranges immediately with reduced motion and stops pending motion", async () => {
    const { experiment, reducedMotion } = create(ref(true));
    experiment.toggle();
    expect(experiment.layout.value).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
    reducedMotion.value = false;
    await nextTick();
    experiment.toggle();
    vi.advanceTimersByTime(200);
    reducedMotion.value = true;
    await nextTick();
    expect(experiment.layout.value).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears animation timers on disposal", () => {
    const { experiment, scope } = create();
    experiment.toggle();
    expect(vi.getTimerCount()).toBe(1);
    scope.stop();
    expect(vi.getTimerCount()).toBe(0);
  });
});
