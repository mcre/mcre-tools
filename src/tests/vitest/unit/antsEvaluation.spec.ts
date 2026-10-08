import { describe, expect, it } from "vitest";
import { createMapLayout } from "@/lib/ants/maps";
import { runTrial, scoreTrials } from "../../../../tools/ants/evaluate";

describe("ant parameter evaluation", () => {
  it("reports reproducible model time, conservation and unmodified inputs", () => {
    const layout = createMapLayout("open", 17);
    const original = structuredClone(layout);
    const result = runTrial("open", layout, 1);
    expect(result).toEqual(runTrial("open", layout, 1));
    expect(result.seconds).toBe(1);
    expect(result.tick).toBe(30);
    expect(result.initialFood).toBe(5220);
    expect(result.ground + result.carrying + result.delivered).toBe(
      result.initialFood,
    );
    expect(result.firstDeliverySeconds).toBeNull();
    expect(result.sourcesVisited).toBe(0);
    expect(result.valid).toBe(true);
    expect(layout).toEqual(original);
  });

  it("prefers improvement across maps over a large gain on only one map", () => {
    const sample = (mapId: string, delivered: number, seed = 17) => ({
      mapId,
      seed,
      seconds: 180,
      tick: 5400,
      initialFood: 1000,
      ground: 1000 - delivered,
      carrying: 0,
      delivered,
      firstDeliverySeconds: delivered ? 10 : null,
      sourcesVisited: delivered ? 1 : 0,
      totalSources: 2,
      saturation: 0,
      valid: true,
    });
    const baseline = [sample("a", 100), sample("b", 100)];
    const balanced = [sample("a", 150), sample("b", 150)];
    const uneven = [sample("a", 500), sample("b", 10)];
    expect(scoreTrials(balanced, baseline)).toBeGreaterThan(
      scoreTrials(uneven, baseline),
    );
    expect(scoreTrials(baseline, baseline)).toBeCloseTo(1);
    expect(
      scoreTrials(
        baseline.map((r) => ({ ...r, valid: false })),
        baseline,
      ),
    ).toBe(0);
    expect(
      scoreTrials(
        baseline.map((r) => ({ ...r, delivered: 0, carrying: 100 })),
        baseline,
      ),
    ).toBeLessThan(1);
    expect(() => scoreTrials([sample("a", 150)], baseline)).toThrow();
  });
});
