import type { TrialResult } from "../../../../tools/ants/evaluate";
// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { createMapLayout } from "@/lib/ants/maps";
import reference from "../../../../tools/ants/baseline-reference.json";
import baseline from "../../../../tools/ants/baseline.json";
import { runTrial, scoreTrials } from "../../../../tools/ants/evaluate";

describe("shared ant parameters across initial maps", () => {
  const previous = reference.ranked[0].trials;
  let trials: TrialResult[];
  beforeAll(() => {
    trials = previous.map((r) =>
      runTrial(
        r.mapId as Parameters<typeof createMapLayout>[0],
        createMapLayout(
          r.mapId as Parameters<typeof createMapLayout>[0],
          r.seed,
        ),
        r.seconds,
      ),
    );
  }, 120_000);

  it("improves balanced foraging by at least 15% over the recorded defaults", () => {
    expect(scoreTrials(trials, previous)).toBeGreaterThan(1.15);
  });
  it.each(["open", "detour", "gap", "zigzag", "scattered", "far"] as const)(
    "%s retains delivery, valid state and food conservation",
    (id) => {
      const rows = trials.filter((r) => r.mapId === id);
      const original = previous.filter((r) => r.mapId === id);
      const mean = (values: { delivered: number }[]) =>
        values.reduce((sum, r) => sum + r.delivered, 0) / values.length;
      expect(mean(rows)).toBeGreaterThanOrEqual(mean(original) * 0.95);
      for (const r of rows) {
        expect(r.delivered).toBeGreaterThan(200);
        expect(r.valid).toBe(true);
        expect(r.sourcesVisited).toBeGreaterThan(0);
        expect(r.saturation).toBeLessThan(0.1);
        expect(r.ground + r.carrying + r.delivered).toBe(r.initialFood);
      }
    },
  );
  it("keeps population, speed, food sensing and movement randomness", () => {
    for (const id of [
      "open",
      "detour",
      "gap",
      "zigzag",
      "scattered",
      "far",
    ] as const) {
      const l = createMapLayout(id);
      expect(l.antCount).toBe(300);
      expect(l.config.speed).toBe(baseline.speed);
      expect(l.config.foodSmellRadius).toBe(baseline.foodSmellRadius);
      expect(l.config.randomTurn).toBeGreaterThanOrEqual(baseline.randomTurn);
    }
  });
});

it("moves on from a depleted patch and returns the remaining scattered food", () => {
  const layout = createMapLayout("scattered", 701);
  for (const food of layout.food) food.amount = 20;
  const result = runTrial("scattered", layout, 600);
  expect(result.sourcesVisited).toBe(6);
  expect(result.ground).toBe(0);
  expect(result.delivered / result.initialFood).toBeGreaterThanOrEqual(0.98);
  expect(result.valid).toBe(true);
}, 60_000);
