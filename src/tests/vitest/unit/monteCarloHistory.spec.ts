import { describe, expect, it } from "vitest";
import { createMonteCarloHistory } from "@/utils/monteCarloHistory";

describe("bounded Monte Carlo history", () => {
  it("keeps earlier visible peaks and troughs after repeated compression", () => {
    const store = createMonteCarloHistory();
    const earlierExtrema: number[] = [];
    let trace: { total: number; estimate: number }[] = [];
    for (let total = 1; total <= 16_384; total++) {
      const phase = total % 16;
      if (total <= 8192 && (phase === 4 || phase === 12))
        earlierExtrema.push(total);
      trace = store.record({
        total,
        estimate: Math.PI + (phase === 4 ? 0.01 : phase === 12 ? -0.01 : 0),
      });
    }
    const retained = new Set(trace.map((point) => point.total));
    for (const total of earlierExtrema) expect(retained.has(total)).toBe(true);
    expect(trace.length).toBeLessThanOrEqual(8192);
  });

  it("preserves full-trial coverage at 1.47 billion trials without inventing points", () => {
    const store = createMonteCarloHistory();
    const recorded = new Set<{ total: number; estimate: number }>();
    const end = 1_470_018_647;
    let trace: { total: number; estimate: number }[] = [];
    for (let i = 0; i < 10_000; i++) {
      const point = {
        total: i === 0 ? 1 : Math.floor((end * (i + 1)) / 10_000),
        estimate: i === 0 ? 4 : Math.PI + Math.sin(i / 20) * 0.00005,
      };
      recorded.add(point);
      trace = store.record(point);
    }
    expect(trace.length).toBeLessThanOrEqual(8192);
    expect(trace[0]!.total).toBe(1);
    expect(trace.at(-1)!.total).toBe(end);
    for (let i = 0; i < trace.length; i++) {
      expect(recorded.has(trace[i]!)).toBe(true);
      if (i) {
        const gap = trace[i]!.total - trace[i - 1]!.total;
        expect(gap).toBeGreaterThan(0);
        expect(gap).toBeLessThan(end * 0.002);
      }
    }
  });

  it("retains first, last, minimum and maximum values in chronological order", () => {
    const store = createMonteCarloHistory();
    const points = [3.142, 3.13, 3.15, 3.14].map((estimate, i) => ({
      total: 1_000_000_000 + i,
      estimate,
    }));
    let trace: typeof points = [];
    for (const point of points) trace = store.record(point);
    expect(trace).toEqual(points);
  });

  it("preserves peaks and endpoints when merging older intervals", () => {
    const store = createMonteCarloHistory();
    const points = [3.142, 3.5, 3.1, 3.143].map((estimate, i) => ({
      total: 40 + i,
      estimate,
    }));
    for (const point of points) store.record(point);
    const latest = { total: 99_999, estimate: Math.PI };
    expect(store.record(latest)).toEqual([...points, latest]);
  });

  it("resets both saved points and interval width", () => {
    const store = createMonteCarloHistory();
    store.record({ total: 1_470_018_647, estimate: Math.PI });
    store.reset();
    const first = { total: 1, estimate: 4 };
    const next = { total: 2, estimate: 2 };
    expect(store.record(first)).toEqual([first]);
    expect(store.record(next)).toEqual([first, next]);
  });
});
