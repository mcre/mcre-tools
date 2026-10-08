import type { AntMapId } from "../../src/lib/ants/maps";
import type { Layout } from "../../src/lib/ants/types";
import { ANT_MAPS } from "../../src/lib/ants/maps";
import {
  applyEdit,
  cellIndex,
  createSimulation,
  inNest,
  step,
} from "../../src/lib/ants/model";
import { DT } from "../../src/lib/ants/types";
import { summarizeTrial } from "./evaluate";

export interface ExplorationScenario {
  seconds: number;
  windowSeconds: number;
  shortcut?: {
    x: number;
    y: number;
    width: number;
    height: number;
    openAtSeconds: number;
  };
}

const createSources = (mapId: AntMapId, layout: Layout) => {
  const map = ANT_MAPS.find((m) => m.id === mapId)!;
  const sources = map.food.map((p) => ({
    x: p.x,
    y: p.y,
    initial: 0,
    remaining: 0,
    firstPickupSeconds: null as number | null,
  }));
  const sourceCells = new Int16Array(layout.columns * layout.rows).fill(-1);
  for (const f of layout.food) {
    const x = f.index % layout.columns,
      y = Math.floor(f.index / layout.columns);
    const source = map.food.findIndex(
      (p) => (x - p.x) ** 2 + (y - p.y) ** 2 <= p.radius ** 2,
    );
    if (source !== -1) {
      sourceCells[f.index] = source;
      sources[source].initial += f.amount;
    }
  }
  return { sources, sourceCells };
};

// Observation only: route classifications never affect steering or deposits.
export const runExplorationTrial = (
  mapId: AntMapId,
  layout: Layout,
  scenario: ExplorationScenario,
) => {
  const s = createSimulation(layout);
  const initialFood = s.food.reduce((sum, n) => sum + n, 0);
  const { sources, sourceCells } = createSources(mapId, layout);
  const gate = scenario.shortcut;
  const gateCells: number[] = [];
  if (gate) {
    for (let y = gate.y; y < gate.y + gate.height; y++)
      for (let x = gate.x; x < gate.x + gate.width; x++)
        gateCells.push(y * layout.columns + x);
    applyEdit(s, "wall", gateCells);
  }
  const oldX = new Float64Array(s.ants.length);
  const oldCarrying = new Uint8Array(s.ants.length);
  const oldCells = new Int32Array(s.ants.length);
  const routes = new Int8Array(s.ants.length).fill(-1);
  const windows: {
    endSeconds: number;
    delivered: number;
    averageReturnDistance: number | null;
    shortcutReturns: number;
    detourReturns: number;
    shortcutFraction: number | null;
    shortcutOpen: boolean;
    sourcePickups: number[];
  }[] = [];
  let firstDeliverySeconds: number | null = null,
    shortcutOpenedAtSeconds: number | null = null;
  let delivered = 0,
    returnDistance = 0,
    shortcutReturns = 0,
    detourReturns = 0;
  let sourcePickups = sources.map(() => 0);
  const ticks = Math.round(scenario.seconds / DT),
    windowTicks = Math.round(scenario.windowSeconds / DT);
  for (let tick = 0; tick < ticks; tick++) {
    if (gate && tick === Math.round(gate.openAtSeconds / DT)) {
      applyEdit(s, "erase", gateCells);
      shortcutOpenedAtSeconds = tick * DT;
    }
    for (let i = 0; i < s.ants.length; i++) {
      const a = s.ants[i];
      oldX[i] = a.x;
      oldCarrying[i] = a.carrying;
      oldCells[i] = cellIndex(layout, a.x, a.y);
      if (a.carrying && inNest(layout, a.x, a.y)) {
        delivered++;
        returnDistance += a.distanceSinceSource;
        if (routes[i] === 1) shortcutReturns++;
        else if (routes[i] === 0) detourReturns++;
        routes[i] = -1;
      }
    }
    step(s);
    if (firstDeliverySeconds === null && s.delivered > 0)
      firstDeliverySeconds = s.tick * DT;
    for (let i = 0; i < s.ants.length; i++) {
      const a = s.ants[i];
      if (!oldCarrying[i] && a.carrying) {
        routes[i] = -1;
        const source = sourceCells[oldCells[i]];
        if (source >= 0) {
          sourcePickups[source]++;
          sources[source].firstPickupSeconds ??= s.tick * DT;
        }
      }
      if (
        gate &&
        oldCarrying[i] &&
        a.carrying &&
        oldX[i] >= gate.x + gate.width &&
        a.x < gate.x + gate.width
      )
        routes[i] = a.y >= gate.y && a.y < gate.y + gate.height ? 1 : 0;
    }
    if (s.tick % windowTicks === 0 || s.tick === ticks) {
      windows.push({
        endSeconds: s.tick * DT,
        delivered,
        averageReturnDistance: delivered ? returnDistance / delivered : null,
        shortcutReturns,
        detourReturns,
        shortcutFraction:
          shortcutReturns + detourReturns
            ? shortcutReturns / (shortcutReturns + detourReturns)
            : null,
        shortcutOpen: shortcutOpenedAtSeconds !== null,
        sourcePickups,
      });
      delivered = returnDistance = shortcutReturns = detourReturns = 0;
      sourcePickups = sources.map(() => 0);
    }
  }
  for (let i = 0; i < s.food.length; i++) {
    const source = sourceCells[i];
    if (source >= 0) sources[source].remaining += s.food[i];
  }
  return {
    ...summarizeTrial(mapId, layout, s, initialFood, firstDeliverySeconds),
    sources,
    windows,
    shortcutOpenedAtSeconds,
  };
};
