import { describe, expect, it } from "vitest";
import { createMapLayout } from "@/lib/ants/maps";
import { runExplorationTrial } from "../../../../tools/ants/exploration";

describe("exploration evaluation", () => {
  it("records source depletion and window metrics without changing map inputs", () => {
    const l = createMapLayout("fork", 17),
      original = structuredClone(l);
    const result = runExplorationTrial("fork", l, {
      seconds: 2,
      windowSeconds: 1,
    });
    expect(result.tick).toBe(60);
    expect(result.sources).toHaveLength(3);
    expect(result.sources[0].initial).toBe(116);
    expect(result.sources.every((p) => p.initial === p.remaining)).toBe(true);
    expect(result.windows).toHaveLength(2);
    expect(result.valid).toBe(true);
    expect(result.ground + result.carrying + result.delivered).toBe(
      result.initialFood,
    );
    expect(l).toEqual(original);
  });
  it("opens a shortcut at the specified model time using normal terrain editing", () => {
    const l = createMapLayout("shortcut", 29),
      original = structuredClone(l);
    const result = runExplorationTrial("shortcut", l, {
      seconds: 2,
      windowSeconds: 1,
      shortcut: { x: 115, y: 77, width: 2, height: 7, openAtSeconds: 1 },
    });
    expect(result.shortcutOpenedAtSeconds).toBe(1);
    expect(result.windows[0].shortcutOpen).toBe(false);
    expect(result.windows[1].shortcutOpen).toBe(true);
    expect(result.valid).toBe(true);
    expect(l).toEqual(original);
  });

  it("accounts for every pickup and delivery in the observation windows", () => {
    const l = createMapLayout("open", 17);
    const result = runExplorationTrial("open", l, {
      seconds: 30,
      windowSeconds: 10,
    });
    expect(result.delivered).toBeGreaterThan(0);
    expect(result.windows.reduce((sum, w) => sum + w.delivered, 0)).toBe(
      result.delivered,
    );
    for (let i = 0; i < result.sources.length; i++) {
      const p = result.sources[i];
      expect(
        result.windows.reduce((sum, w) => sum + w.sourcePickups[i], 0),
      ).toBe(p.initial - p.remaining);
    }
    for (const window of result.windows.filter((w) => w.delivered > 0))
      expect(window.averageReturnDistance).toBeGreaterThan(20);
    expect(result.valid).toBe(true);
  }, 15_000);
});
