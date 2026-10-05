import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";
import { useMonteCarloExperiment } from "@/composables/useMonteCarloExperiment";
import { usePiPlayback } from "@/composables/usePiPlayback";

describe("Monte Carlo experiment state", () => {
  it("starts without drawing random numbers and resets all results", () => {
    const random = vi.fn(() => 0.5);
    const experiment = useMonteCarloExperiment(random);
    expect(random).not.toHaveBeenCalled();
    expect(experiment.estimate.value).toBeNull();
    experiment.add(100);
    expect(random).toHaveBeenCalledTimes(200);
    expect(experiment.total.value).toBe(100);
    expect(experiment.inside.value).toBe(100);
    expect(experiment.estimate.value).toBe(4);
    expect(experiment.batch.value).toHaveLength(100);
    experiment.reset();
    expect(experiment.total.value).toBe(0);
    expect(experiment.inside.value).toBe(0);
    expect(experiment.history.value).toEqual([]);
    expect(experiment.batch.value).toEqual([]);
  });

  it("keeps counting beyond the old limit with a bounded trace", () => {
    const experiment = useMonteCarloExperiment(() => 0.5);
    for (let i = 0; i < 1001; i++) experiment.add(100);
    expect(experiment.total.value).toBe(100_100);
    expect(experiment.history.value.length).toBeLessThanOrEqual(8192);
    expect(experiment.history.value.at(-1)).toEqual({
      total: 100_100,
      estimate: 4,
    });
    expect(experiment.atLimit.value).toBe(false);
    experiment.add(1);
    expect(experiment.total.value).toBe(100_101);
    expect(experiment.batch.value).toEqual([]);
  });

  it("keeps history spread across the entire experiment after many updates", () => {
    const experiment = useMonteCarloExperiment(() => 0.5);
    for (let i = 0; i < 8000; i++) experiment.add(100);
    const trace = experiment.history.value;
    expect(trace.length).toBeLessThanOrEqual(8192);
    expect(trace[0]!.total).toBe(100);
    expect(trace.at(-1)!.total).toBe(800_000);
    for (let i = 1; i < trace.length; i++) {
      expect(trace[i]!.total - trace[i - 1]!.total).toBeLessThan(40_000);
    }
  });

  it("retains only the first 20,000 points for drawing and counts every later sample", () => {
    let randomCalls = 0;
    const experiment = useMonteCarloExperiment(() =>
      Math.floor(randomCalls++ / 2) < 20_000 ? 0.5 : 0,
    );
    experiment.add(19_999);
    expect(experiment.batch.value).toHaveLength(19_999);
    experiment.add(100_000);
    expect(experiment.batch.value).toEqual([{ x: 0, y: 0, inside: true }]);
    for (let i = 0; i < 10; i++) experiment.add(100_000);
    expect(experiment.total.value).toBe(1_119_999);
    expect(experiment.inside.value).toBe(20_000);
    expect(randomCalls).toBe(2_239_998);
    expect(experiment.estimate.value).toBe(80_000 / 1_119_999);
    expect(experiment.batch.value).toEqual([]);
    expect(experiment.atLimit.value).toBe(false);
    experiment.reset();
    experiment.add(1);
    expect(experiment.batch.value).toHaveLength(1);
  });

  it("caps oversized requested batches", () => {
    const experiment = useMonteCarloExperiment(() => 0.5);
    experiment.add(1_000_000_000);
    expect(experiment.total.value).toBe(1_000_000);
    expect(experiment.batch.value).toHaveLength(20_000);
  });

  it("yields when the time budget is used and counts only completed samples", () => {
    let clock = 0;
    let draws = 0;
    let value = 0.5;
    const experiment = useMonteCarloExperiment(
      () => {
        if (++draws % 2048 === 0) clock += 8;
        return value;
      },
      () => clock,
    );
    experiment.add(1_000_000, 8);
    expect(draws).toBe(2048);
    expect(experiment.total.value).toBe(1024);
    expect(experiment.inside.value).toBe(1024);
    expect(experiment.batch.value).toHaveLength(1024);
    expect(experiment.history.value.at(-1)).toEqual({
      total: 1024,
      estimate: 4,
    });
    value = 0;
    experiment.add(1_000_000, 8);
    expect(draws).toBe(4096);
    expect(experiment.total.value).toBe(2048);
    expect(experiment.inside.value).toBe(1024);
    expect(experiment.estimate.value).toBe(2);
    expect(experiment.history.value.at(-1)).toEqual({
      total: 2048,
      estimate: 2,
    });
  });

  it("does not sample if no computation time is available", () => {
    const random = vi.fn(() => 0.5);
    const experiment = useMonteCarloExperiment(random, () => 0);
    experiment.add(100, 0);
    expect(random).not.toHaveBeenCalled();
    expect(experiment.total.value).toBe(0);
    expect(experiment.history.value).toEqual([]);
  });

  it("ignores nonfinite and negative batch sizes", () => {
    const random = vi.fn(() => 0.5);
    const experiment = useMonteCarloExperiment(random);
    for (const count of [Number.NaN, Infinity, -Infinity, -10])
      experiment.add(count);
    expect(experiment.total.value).toBe(0);
    expect(random).not.toHaveBeenCalled();
  });

  it("allows the estimate to fluctuate instead of forcing convergence", () => {
    let value = 0.5;
    const experiment = useMonteCarloExperiment(() => value);
    experiment.add(1);
    expect(experiment.estimate.value).toBe(4);
    value = 0;
    experiment.add(1);
    expect(experiment.estimate.value).toBe(2);
    value = 0.5;
    experiment.add(1);
    expect(experiment.estimate.value).toBeCloseTo(8 / 3);
  });
});

describe("experiment playback", () => {
  const scopes: ReturnType<typeof effectScope>[] = [];
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    for (const scope of scopes.splice(0)) scope.stop();
    vi.useRealTimers();
  });
  const create = (step: (elapsed: number) => boolean) => {
    const scope = effectScope();
    scopes.push(scope);
    return { scope, playback: scope.run(() => usePiPlayback(step, 100))! };
  };

  it("does not autoplay, avoids duplicate timers, pauses, and resumes", () => {
    const step = vi.fn(() => true);
    const { playback } = create(step);
    expect(vi.getTimerCount()).toBe(0);
    playback.start();
    playback.start();
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(100);
    expect(step).toHaveBeenCalledWith(100);
    playback.stop();
    vi.advanceTimersByTime(500);
    expect(step).toHaveBeenCalledTimes(1);
    playback.start();
    vi.advanceTimersByTime(100);
    expect(step).toHaveBeenCalledTimes(2);
  });

  it("stops at completion and on scope disposal", () => {
    const { playback, scope } = create(() => false);
    playback.start();
    vi.advanceTimersByTime(100);
    expect(playback.running.value).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    playback.start();
    scope.stop();
    expect(playback.running.value).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
