import type { AntMapId } from "../../src/lib/ants/maps";
import type { Layout, Simulation } from "../../src/lib/ants/types";
import { ANT_MAPS } from "../../src/lib/ants/maps";
import {
  cellIndex,
  createSimulation,
  step,
  summarize,
} from "../../src/lib/ants/model";

export interface TrialResult {
  mapId: string;
  seed: number;
  seconds: number;
  tick: number;
  initialFood: number;
  ground: number;
  carrying: number;
  delivered: number;
  firstDeliverySeconds: number | null;
  sourcesVisited: number;
  totalSources: number;
  saturation: number;
  valid: boolean;
}

export const runTrial = (
  mapId: AntMapId,
  layout: Layout,
  seconds: number,
): TrialResult => {
  const s = createSimulation(layout);
  const initialFood = s.food.reduce((a, b) => a + b, 0);
  let firstDeliverySeconds: number | null = null;
  for (let tick = 0; tick < Math.round(seconds * 30); tick++) {
    step(s);
    if (firstDeliverySeconds === null && s.delivered > 0)
      firstDeliverySeconds = s.tick / 30;
  }
  return summarizeTrial(mapId, layout, s, initialFood, firstDeliverySeconds);
};

export const summarizeTrial = (
  mapId: AntMapId,
  layout: Layout,
  s: Simulation,
  initialFood: number,
  firstDeliverySeconds: number | null,
): TrialResult => {
  const summary = summarize(s);
  const map = ANT_MAPS.find((m) => m.id === mapId)!;
  const sourcesVisited = map.food.filter((patch) =>
    layout.food.some((f) => {
      const x = f.index % layout.columns,
        y = Math.floor(f.index / layout.columns);
      return (
        (x - patch.x) ** 2 + (y - patch.y) ** 2 <= patch.radius ** 2 &&
        s.food[f.index] < f.amount
      );
    }),
  ).length;
  const fields = [s.homePheromone, s.foodPheromone];
  const valid =
    summary.ground + summary.carrying + summary.delivered === initialFood &&
    s.ants.every((a) => {
      const index = cellIndex(layout, a.x, a.y);
      return (
        index >= 0 &&
        !s.walls[index] &&
        Number.isFinite(a.heading + a.distanceSinceSource)
      );
    }) &&
    fields.every((f) =>
      f.every(
        (v) => Number.isFinite(v) && v >= 0 && v <= layout.config.maxPheromone,
      ),
    );
  const saturation =
    fields.reduce(
      (sum, f) => sum + f.filter((v) => v >= layout.config.maxPheromone).length,
      0,
    ) /
    (2 * s.walls.length);
  return {
    mapId,
    seed: layout.seed,
    seconds: s.tick / 30,
    ...summary,
    initialFood,
    firstDeliverySeconds,
    sourcesVisited,
    totalSources: map.food.length,
    saturation,
    valid,
  };
};

// Give each map equal weight. The worst map also affects ranking, so an easy
// map's large gain cannot hide a severe regression behind an obstacle.
export const scoreTrials = (
  results: TrialResult[],
  baseline: TrialResult[],
): number => {
  const keys = (rows: TrialResult[]) =>
    rows
      .map((r) => `${r.mapId}:${r.seed}:${r.seconds}`)
      .toSorted()
      .join(",");
  if (results.length === 0 || keys(results) !== keys(baseline))
    throw new Error("Trial coverage differs from baseline");
  if (results.some((r) => !r.valid)) return 0;
  const ids = [...new Set(baseline.map((r) => r.mapId))];
  const ratios = ids.map((id) => {
    const mean = (rows: TrialResult[]) => {
      const group = rows.filter((r) => r.mapId === id);
      return group.reduce((sum, r) => sum + r.delivered, 0) / group.length;
    };
    return (mean(results) + 20) / (mean(baseline) + 20);
  });
  const geometricMean = Math.exp(
    ratios.reduce((sum, r) => sum + Math.log(r), 0) / ratios.length,
  );
  return geometricMean * Math.min(...ratios) ** 0.35;
};
