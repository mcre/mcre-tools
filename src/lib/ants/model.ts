import type { EditTool, Layout, Simulation } from "./types";
import { createMapLayout } from "./maps";
import { random } from "./random";
import { DT } from "./types";

export const createDemoLayout = (): Layout => createMapLayout("open");
export const cellIndex = (
  l: Pick<Layout, "columns" | "rows">,
  x: number,
  y: number,
): number => {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < 0 ||
    y < 0 ||
    x >= l.columns ||
    y >= l.rows
  )
    return -1;
  return Math.floor(y) * l.columns + Math.floor(x);
};
export const inNest = (l: Layout, x: number, y: number): boolean =>
  (x - l.nest.x) ** 2 + (y - l.nest.y) ** 2 <= l.nest.radius ** 2;
export const createSimulation = (layout: Layout): Simulation => {
  const l = structuredClone(layout),
    n = l.columns * l.rows;
  const s: Simulation = {
    layout: l,
    walls: new Uint8Array(n),
    food: new Uint16Array(n),
    homePheromone: new Float32Array(n),
    foodPheromone: new Float32Array(n),
    homePheromoneWork: new Float32Array(n),
    foodPheromoneWork: new Float32Array(n),
    homePheromoneDeposits: new Float32Array(n),
    foodPheromoneDeposits: new Float32Array(n),
    ants: [],
    tick: 0,
    rngState: l.seed,
    delivered: 0,
  };
  for (const i of l.walls) s.walls[i] = 1;
  for (const f of l.food) s.food[f.index] = f.amount;
  for (let i = 0; i < l.antCount; i++) {
    const heading = random(s) * Math.PI * 2;
    const radius = Math.sqrt(random(s)) * l.nest.radius * 0.6;
    s.ants.push({
      x: l.nest.x + Math.cos(heading) * radius,
      y: l.nest.y + Math.sin(heading) * radius,
      heading,
      carrying: 0,
      distanceSinceSource: 0,
      pace: 0.72 + random(s) * 0.56,
      wander: 0,
      curiosity:
        l.config.explorationRate ||
        l.config.returnExplorationRate ||
        l.config.pheromoneExponent
          ? 1 + (random(s) - 0.5) * (l.config.individuality ?? 1)
          : 1,
      exploreTicks: 0,
    });
  }
  return s;
};

// Grid traversal checks every intersected cell, including both sides of corners.
// Shared by movement and sensors: neither may jump over a thin wall.
export const lineIsOpen = (
  s: Simulation,
  x: number,
  y: number,
  endX: number,
  endY: number,
): boolean => {
  const l = s.layout;
  const open = (cx: number, cy: number) => {
    const i = cellIndex(l, cx, cy);
    return i >= 0 && s.walls[i] === 0;
  };
  if (!open(x, y) || !open(endX, endY)) return false;
  let cx = Math.floor(x),
    cy = Math.floor(y);
  const ex = Math.floor(endX),
    ey = Math.floor(endY);
  const dx = endX - x,
    dy = endY - y,
    sx = Math.sign(dx),
    sy = Math.sign(dy);
  const tx = dx === 0 ? Infinity : Math.abs(1 / dx),
    ty = dy === 0 ? Infinity : Math.abs(1 / dy);
  let nextX = dx === 0 ? Infinity : (sx > 0 ? cx + 1 - x : x - cx) * tx;
  let nextY = dy === 0 ? Infinity : (sy > 0 ? cy + 1 - y : y - cy) * ty;
  while (cx !== ex || cy !== ey) {
    if (Math.abs(nextX - nextY) < 1e-10) {
      if (!open(cx + sx, cy) || !open(cx, cy + sy)) return false;
      cx += sx;
      cy += sy;
      nextX += tx;
      nextY += ty;
    } else if (nextX < nextY) {
      cx += sx;
      nextX += tx;
    } else {
      cy += sy;
      nextY += ty;
    }
    if (!open(cx, cy)) return false;
  }
  return true;
};
export const sensePheromone = (
  s: Simulation,
  field: Float32Array,
  x: number,
  y: number,
  heading: number,
  distance: number,
): number => {
  const px = x + Math.cos(heading) * distance,
    py = y + Math.sin(heading) * distance;
  if (!lineIsOpen(s, x, y, px, py)) return 0;
  return field[cellIndex(s.layout, px, py)];
};

// A short-range food cue, computed from current nearby food only. No odor map
// or route memory: walls block it, and depleted food stops contributing at once.
export const senseFoodDirection = (
  s: Simulation,
  x: number,
  y: number,
): number | undefined => {
  const { columns, rows, config } = s.layout;
  const radius = config.foodSmellRadius;
  if (radius <= 0) return;
  let vx = 0,
    vy = 0;
  const minX = Math.max(0, Math.floor(x - radius)),
    maxX = Math.min(columns - 1, Math.floor(x + radius)),
    minY = Math.max(0, Math.floor(y - radius)),
    maxY = Math.min(rows - 1, Math.floor(y + radius));
  for (let cy = minY; cy <= maxY; cy++) {
    for (let cx = minX; cx <= maxX; cx++) {
      const amount = s.food[cy * columns + cx];
      if (!amount) continue;
      const dx = cx + 0.5 - x,
        dy = cy + 0.5 - y,
        distance = Math.hypot(dx, dy);
      if (
        distance === 0 ||
        distance >= radius ||
        !lineIsOpen(s, x, y, cx + 0.5, cy + 0.5)
      )
        continue;
      const strength = Math.min(amount, 100) * (1 - distance / radius) ** 2;
      vx += (dx / distance) * strength;
      vy += (dy / distance) * strength;
    }
  }
  if (Math.abs(vx) + Math.abs(vy) > 1e-9) return Math.atan2(vy, vx);
};

// Conservative four-neighbour flux. Walls and world edges retain mass.
export const diffuseField = (
  s: Simulation,
  field: Float32Array,
  output: Float32Array,
  evaporation = s.layout.config.evaporation,
) => {
  const { columns: cols, rows, config } = s.layout;
  const rate = config.diffusion * DT,
    retain = Math.exp(-evaporation * DT);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (s.walls[i]) {
        output[i] = 0;
        continue;
      }
      const v = field[i];
      let flux = 0;
      if (x > 0 && !s.walls[i - 1]) flux += field[i - 1] - v;
      if (x + 1 < cols && !s.walls[i + 1]) flux += field[i + 1] - v;
      if (y > 0 && !s.walls[i - cols]) flux += field[i - cols] - v;
      if (y + 1 < rows && !s.walls[i + cols]) flux += field[i + cols] - v;
      output[i] = Math.max(
        0,
        Math.min(config.maxPheromone, (v + rate * flux) * retain),
      );
    }
  }
};
const normalizeAngle = (angle: number) =>
  Math.atan2(Math.sin(angle), Math.cos(angle));
const pheromoneTurn = (
  s: Simulation,
  carrying: boolean,
  curiosity: number,
  left: number,
  front: number,
  right: number,
  best: number,
) => {
  const c = s.layout.config;
  const limit = Math.min(c.sensorAngle, c.turnRate * DT);
  const choiceChance = carrying
    ? (c.returnChoiceChance ?? c.pheromoneChoiceChance ?? 1)
    : (c.pheromoneChoiceChance ?? 1);
  if ((c.pheromoneExponent ?? 0) > 0 && random(s) < choiceChance) {
    const exponent = c.pheromoneExponent! / curiosity;
    const floor = (c.pheromoneFloor ?? 0) * best;
    const lw = (left + floor) ** exponent,
      fw = (c.frontWeight ?? 2) * (front + floor) ** exponent,
      rw = (right + floor) ** exponent;
    if (c.averageSteering) return ((rw - lw) / (lw + fw + rw)) * limit;
    const draw = random(s) * (lw + fw + rw);
    return (draw < lw ? -1 : draw < lw + fw ? 0 : 1) * limit;
  }
  if (front >= best * 0.7) return 0;
  let choice = -1,
    matches = 0;
  for (let sensor = 0; sensor < 3; sensor++) {
    const value = sensor === 0 ? left : sensor === 1 ? front : right;
    if (value >= best - 1e-7) {
      matches++;
      if (random(s) < 1 / matches) choice = sensor;
    }
  }
  return (choice - 1) * limit;
};
export const step = (s: Simulation) => {
  const l = s.layout,
    c = l.config;
  s.homePheromoneDeposits.fill(0);
  s.foodPheromoneDeposits.fill(0);
  for (const ant of s.ants) {
    let i = cellIndex(l, ant.x, ant.y);
    // Exchanges happen sequentially, so the last unit cannot be taken twice.
    if (inNest(l, ant.x, ant.y)) {
      ant.distanceSinceSource = 0;
      if (ant.carrying) {
        s.delivered++;
        ant.carrying = 0;
        ant.heading += Math.PI;
      }
    } else if (!ant.carrying && s.food[i] > 0) {
      s.food[i]--;
      ant.carrying = 1;
      ant.exploreTicks = 0;
      ant.distanceSinceSource = 0;
      ant.heading += Math.PI;
    }
    const field = ant.carrying ? s.homePheromone : s.foodPheromone;
    const sensorDistance =
      c.sensorDistance * ant.curiosity ** (c.sensorIndividuality ?? 0);
    const left = sensePheromone(
      s,
      field,
      ant.x,
      ant.y,
      ant.heading - c.sensorAngle,
      sensorDistance,
    );
    const front = sensePheromone(
      s,
      field,
      ant.x,
      ant.y,
      ant.heading,
      sensorDistance,
    );
    const right = sensePheromone(
      s,
      field,
      ant.x,
      ant.y,
      ant.heading + c.sensorAngle,
      sensorDistance,
    );
    const best = Math.max(left, front, right);
    const eventRate =
      (ant.carrying
        ? (c.returnExplorationRate ?? 0)
        : (c.explorationRate ?? 0)) * ant.curiosity;
    if (
      ant.exploreTicks === 0 &&
      best > 0.001 &&
      c.randomTurn > 0 &&
      eventRate > 0 &&
      random(s) < -Math.expm1(-eventRate * DT)
    ) {
      ant.exploreTicks = Math.max(
        1,
        Math.round((c.explorationDuration ?? 2) / DT),
      );
      ant.heading = normalizeAngle(ant.heading + (random(s) * 2 - 1) * Math.PI);
    }
    const exploring = ant.exploreTicks > 0;
    if (exploring) ant.exploreTicks--;
    let turn = 0;
    if (!exploring && best > 0.0001)
      turn = pheromoneTurn(
        s,
        !!ant.carrying,
        ant.curiosity,
        left,
        front,
        right,
        best,
      );
    const foodDirection = ant.carrying
      ? undefined
      : senseFoodDirection(s, ant.x, ant.y);
    if (foodDirection !== undefined) {
      const difference = normalizeAngle(foodDirection - ant.heading),
        limit = c.foodSmellTurnRate * DT;
      turn += Math.max(-limit, Math.min(limit, difference));
    }
    // Correlated turns make short curves; pace varies independently per ant.
    ant.wander = ant.wander * 0.9 + (random(s) * 2 - 1) * 0.1;
    ant.pace = Math.max(
      0.65,
      Math.min(1.35, ant.pace + (random(s) - 0.5) * 0.025),
    );
    const wandering = (random(s) * 2 - 1 + ant.wander * 2) * c.randomTurn;
    ant.heading = normalizeAngle(
      ant.heading +
        turn +
        wandering *
          (!exploring && (best > 0.001 || foodDirection !== undefined)
            ? ant.carrying
              ? (c.returnRandomMultiplier ?? 1.5)
              : 1.5
            : 2.4),
    );
    const distance = c.speed * DT * ant.pace;
    const nx = ant.x + Math.cos(ant.heading) * distance,
      ny = ant.y + Math.sin(ant.heading) * distance;
    if (lineIsOpen(s, ant.x, ant.y, nx, ny)) {
      ant.x = nx;
      ant.y = ny;
      ant.distanceSinceSource += distance;
    } else
      ant.heading = normalizeAngle(ant.heading + Math.PI * (0.5 + random(s)));
    i = cellIndex(l, ant.x, ant.y);
    // Searchers mark the way from the nest; carriers mark the way from food.
    // Each state follows the other field, with no direct home direction.
    const deposits = ant.carrying
      ? s.foodPheromoneDeposits
      : s.homePheromoneDeposits;
    deposits[i] +=
      c.deposit * Math.exp(-ant.distanceSinceSource / c.distanceDecay);
  }
  diffuseField(s, s.homePheromone, s.homePheromoneWork);
  diffuseField(s, s.foodPheromone, s.foodPheromoneWork);
  for (let i = 0; i < s.walls.length; i++) {
    s.homePheromoneWork[i] = Math.min(
      c.maxPheromone,
      s.homePheromoneWork[i] + s.homePheromoneDeposits[i],
    );
    s.foodPheromoneWork[i] = Math.min(
      c.maxPheromone,
      s.foodPheromoneWork[i] + s.foodPheromoneDeposits[i],
    );
  }
  [s.homePheromone, s.homePheromoneWork] = [
    s.homePheromoneWork,
    s.homePheromone,
  ];
  [s.foodPheromone, s.foodPheromoneWork] = [
    s.foodPheromoneWork,
    s.foodPheromone,
  ];
  s.tick++;
};

// Terrain rescue only, deterministic expanding rings. It never runs during steps.
const displaceEmbeddedAnts = (s: Simulation) => {
  const l = s.layout;
  for (const ant of s.ants) {
    if (!s.walls[cellIndex(l, ant.x, ant.y)]) continue;
    const cx = Math.floor(ant.x),
      cy = Math.floor(ant.y);
    let found = false;
    for (
      let radius = 1;
      radius < Math.max(l.columns, l.rows) && !found;
      radius++
    ) {
      for (let dy = -radius; dy <= radius && !found; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const i = cellIndex(l, cx + dx, cy + dy);
          if (i >= 0 && !s.walls[i]) {
            ant.x = cx + dx + 0.5;
            ant.y = cy + dy + 0.5;
            found = true;
            break;
          }
        }
      }
    }
  }
};
export const applyEdit = (
  s: Simulation,
  tool: EditTool,
  cells: Iterable<number>,
  amount = 100,
) => {
  const layoutFood = new Map(s.layout.food.map((f) => [f.index, f.amount]));
  const layoutWalls = new Set(s.layout.walls);
  let addedWall = false;
  for (const i of cells) {
    if (!Number.isInteger(i) || i < 0 || i >= s.walls.length) continue;
    const x = i % s.layout.columns,
      y = Math.floor(i / s.layout.columns);
    if (inNest(s.layout, x + 0.5, y + 0.5)) continue;
    if (tool === "food") {
      if (s.walls[i]) continue;
      const addition = Math.max(0, Math.min(65_535, Math.floor(amount)));
      s.food[i] = Math.min(65_535, s.food[i] + addition);
      layoutFood.set(i, Math.min(65_535, (layoutFood.get(i) ?? 0) + addition));
    } else if (tool === "wall") {
      if (s.food[i] > 0 || (layoutFood.get(i) ?? 0) > 0) continue;
      s.walls[i] = 1;
      layoutWalls.add(i);
      addedWall = true;
      for (const a of [
        s.homePheromone,
        s.homePheromoneWork,
        s.homePheromoneDeposits,
        s.foodPheromone,
        s.foodPheromoneWork,
        s.foodPheromoneDeposits,
      ])
        a[i] = 0;
    } else {
      s.walls[i] = 0;
      s.food[i] = 0;
      layoutWalls.delete(i);
      layoutFood.delete(i);
    }
  }
  s.layout.food = [...layoutFood].map(([index, amount]) => ({ index, amount }));
  s.layout.walls = [...layoutWalls];
  if (addedWall) displaceEmbeddedAnts(s);
};
export const summarize = (s: Simulation) => ({
  tick: s.tick,
  ground: s.food.reduce((sum, v) => sum + v, 0),
  carrying: s.ants.reduce((sum, a) => sum + a.carrying, 0),
  delivered: s.delivered,
});
