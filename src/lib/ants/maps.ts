import type { Layout } from "./types";
import { DEFAULT_MODEL_CONFIG } from "./config";
import detour from "./maps/detour.json";
import far from "./maps/far.json";
import fork from "./maps/fork.json";
import gap from "./maps/gap.json";
import loop from "./maps/loop.json";
import open from "./maps/open.json";
import rooms from "./maps/rooms.json";
import scattered from "./maps/scattered.json";
import shortcut from "./maps/shortcut.json";
import zigzag from "./maps/zigzag.json";

const definitions = {
  open,
  detour,
  gap,
  zigzag,
  scattered,
  far,
  fork,
  loop,
  rooms,
  shortcut,
};
export type AntMapId = keyof typeof definitions;
export const ANT_MAPS = Object.entries(definitions).map(([id, map]) => ({
  ...map,
  id: id as AntMapId,
}));

// Geometry is kept separate from population, random seeds and model parameters.
// The UI and offline evaluation both use these map files.
export const createMapLayout = (id: AntMapId, seed = 20_261_004): Layout => {
  const map = definitions[id];
  const food: Layout["food"] = [];
  for (const patch of map.food) {
    for (let y = patch.y - patch.radius; y <= patch.y + patch.radius; y++) {
      for (let x = patch.x - patch.radius; x <= patch.x + patch.radius; x++) {
        if ((x - patch.x) ** 2 + (y - patch.y) ** 2 <= patch.radius ** 2)
          food.push({ index: y * map.columns + x, amount: patch.amount });
      }
    }
  }
  const walls = new Set<number>();
  for (const rect of map.walls) {
    for (let y = rect.y; y < rect.y + rect.height; y++) {
      for (let x = rect.x; x < rect.x + rect.width; x++)
        walls.add(y * map.columns + x);
    }
  }
  return {
    schemaVersion: 1,
    seed,
    columns: map.columns,
    rows: map.rows,
    antCount: 300,
    nest: { ...map.nest },
    walls: [...walls],
    food,
    config: { ...DEFAULT_MODEL_CONFIG },
  };
};
