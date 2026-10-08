import type { Layout, Simulation } from "@/lib/ants/types";
import { describe, expect, it } from "vitest";
import { FixedClock } from "@/lib/ants/clock";
import { createStroke, extendStroke } from "@/lib/ants/edit";
import {
  applyEdit,
  cellIndex,
  createDemoLayout,
  createSimulation,
  diffuseField,
  lineIsOpen,
  sensePheromone,
  step,
  summarize,
} from "@/lib/ants/model";
import { random } from "@/lib/ants/random";

const layout = (changes: Partial<Layout> = {}): Layout => ({
  ...createDemoLayout(),
  columns: 32,
  rows: 24,
  antCount: 80,
  nest: { x: 6.5, y: 12.5, radius: 2 },
  walls: [],
  food: [{ index: 12 * 32 + 23, amount: 300 }],
  ...changes,
});
const advance = (s: Simulation, ticks: number) => {
  for (let i = 0; i < ticks; i++) step(s);
};
const state = (s: Simulation) => structuredClone(s);
const mass = (s: Simulation) => {
  const v = summarize(s);
  return v.ground + v.carrying + v.delivered;
};

describe("ant model: deterministic local foraging", () => {
  it("places the demo food well beyond the nest and nearby food sensing", () => {
    const l = createDemoLayout();
    expect(l.food.reduce((sum, food) => sum + food.amount, 0)).toBe(5220);
    for (const food of l.food) {
      const x = (food.index % l.columns) + 0.5,
        y = Math.floor(food.index / l.columns) + 0.5;
      expect(Math.hypot(x - l.nest.x, y - l.nest.y)).toBeGreaterThan(35);
      expect(Math.hypot(x - l.nest.x, y - l.nest.y)).toBeGreaterThan(
        l.nest.radius + l.config.foodSmellRadius,
      );
    }
  });
  it("uses one serializable seeded random state", () => {
    const a = { rngState: 42 },
      b = { rngState: 42 };
    expect(Array.from({ length: 20 }, () => random(a))).toEqual(
      Array.from({ length: 20 }, () => random(b)),
    );
    expect(random(a)).toBeGreaterThanOrEqual(0);
    expect(random(a)).toBeLessThan(1);
  });
  it("reproduces the same seed, edits and ticks", () => {
    const a = createSimulation(layout()),
      b = createSimulation(layout());
    for (const s of [a, b]) {
      advance(s, 50);
      applyEdit(s, "food", [100], 50);
      advance(s, 100);
    }
    expect(state(a)).toEqual(state(b));
  });
  it("gives individuals different speeds and curved wandering without a trail", () => {
    const l = layout({
      food: [],
      antCount: 40,
      nest: { x: 2, y: 2, radius: 1 },
    });
    const s = createSimulation(l);
    for (const a of s.ants) Object.assign(a, { x: 12, y: 12, heading: 0 });
    const distances: number[] = [];
    const turns: number[] = [];
    for (let tick = 0; tick < 20; tick++) {
      const before = s.ants.map((a) => ({ ...a }));
      step(s);
      for (const [i, a] of s.ants.entries()) {
        distances.push(Math.hypot(a.x - before[i].x, a.y - before[i].y));
        turns.push(Math.abs(a.heading - before[i].heading));
      }
    }
    expect(Math.max(...distances) - Math.min(...distances)).toBeGreaterThan(
      0.1,
    );
    expect(turns.some((turn) => turn > 0.07)).toBe(true);
    expect(
      distances.every((d) => d >= 0 && d <= (l.config.speed / 30) * 1.4),
    ).toBe(true);
    expect(s.ants.every((a) => Number.isFinite(a.x + a.y + a.heading))).toBe(
      true,
    );
  });
  it("wanders more widely without pheromones while following established trails steadily", () => {
    const probe = (pheromone: number) =>
      Array.from({ length: 200 }, (_, seed) => {
        const l = layout({ seed, food: [], antCount: 1 });
        l.config.turnRate = 0;
        const s = createSimulation(l);
        Object.assign(s.ants[0], { x: 16.5, y: 6.5, heading: 0 });
        s.foodPheromone.fill(pheromone);
        step(s);
        return Math.abs(s.ants[0].heading);
      });
    const exploring = probe(0),
      following = probe(80);
    const mean = (values: number[]) =>
      values.reduce((sum, v) => sum + v, 0) / values.length;
    expect(Math.max(...exploring)).toBeGreaterThan(0.2);
    expect(Math.max(...following)).toBeGreaterThan(0.14);
    expect(mean(exploring)).toBeGreaterThan(mean(following) * 1.3);
  });
  it("preserves food mass, with independent layout amounts", () => {
    const s = createSimulation(layout());
    const original = structuredClone(s.layout.food);
    advance(s, 1800);
    expect(mass(s)).toBe(300);
    expect(s.layout.food).toEqual(original);
    expect(s.delivered).toBeGreaterThan(10);
  });
  it("takes the last food only once and turns around", () => {
    const s = createSimulation(
      layout({ antCount: 2, food: [{ index: 10 * 32 + 20, amount: 1 }] }),
    );
    for (const a of s.ants)
      Object.assign(a, {
        x: 20.5,
        y: 10.5,
        heading: 0,
        distanceSinceSource: 30,
      });
    step(s);
    expect(s.food[340]).toBe(0);
    expect(s.ants.filter((a) => a.carrying).length).toBe(1);
    expect(mass(s)).toBe(1);
    expect(s.layout.food[0].amount).toBe(1);
    expect(s.ants[0].distanceSinceSource).toBeLessThan(1);
    expect(Math.cos(s.ants[0].heading)).toBeLessThan(-0.8);
  });
  it("delivers food and refreshes the home trail at the nest", () => {
    const s = createSimulation(layout({ antCount: 2 }));
    s.ants[0].carrying = 1;
    for (const a of s.ants) a.distanceSinceSource = 20;
    step(s);
    expect(s.delivered).toBe(1);
    expect(s.ants[0].carrying).toBe(0);
    expect(s.ants.every((a) => a.distanceSinceSource < 1)).toBe(true);
  });
  it("bounds indexes without wrapping rows", () => {
    const s = createSimulation(layout());
    for (const [x, y] of [
      [-1, 0],
      [32, 1],
      [0, 24],
      [Number.NaN, 0],
      [0, Infinity],
    ])
      expect(cellIndex(s.layout, x, y)).toBe(-1);
    expect(cellIndex(s.layout, 31.9, 2.9)).toBe(95);
  });
  it("blocks swept movement, including high speed and diagonal corners", () => {
    const l = layout({
      antCount: 1,
      walls: Array.from({ length: 24 }, (_, y) => y * 32 + 16),
    });
    l.config.speed = 120;
    const s = createSimulation(l);
    Object.assign(s.ants[0], { x: 15.4, y: 10.5, heading: 0 });
    for (let i = 0; i < 200; i++) {
      step(s);
      expect(s.ants[0].x).toBeLessThan(16);
    }
    expect(lineIsOpen(s, 15.5, 10.5, 17.5, 10.5)).toBe(false);
    const corner = createSimulation(layout({ walls: [10 * 32 + 11] }));
    expect(lineIsOpen(corner, 10.5, 10.5, 11.5, 11.5)).toBe(false);
    advance(s, 500);
    expect(s.ants.every((a) => cellIndex(l, a.x, a.y) >= 0)).toBe(true);
  });
  it("does not sense pheromones through a wall", () => {
    const s = createSimulation(layout({ walls: [12 * 32 + 16] }));
    s.foodPheromone[12 * 32 + 17] = 100;
    expect(sensePheromone(s, s.foodPheromone, 15.5, 12.5, 0, 2)).toBe(0);
    expect(sensePheromone(s, s.foodPheromone, 17.5, 10.5, Math.PI / 2, 2)).toBe(
      100,
    );
  });
  it("evaporates without a source and conserves diffusion at wall and outer boundaries", () => {
    const s = createSimulation(
      layout({ walls: Array.from({ length: 24 }, (_, y) => y * 32 + 16) }),
    );
    s.foodPheromone[12 * 32 + 15] = 20;
    const work = s.foodPheromoneWork;
    diffuseField(s, s.foodPheromone, work, 0);
    expect(work.reduce((a, b) => a + b, 0)).toBeCloseTo(20, 5);
    expect(work[12 * 32 + 17]).toBe(0);
    expect(work[12 * 32 + 16]).toBe(0);
    diffuseField(s, s.foodPheromone, work, 1);
    expect(work.reduce((a, b) => a + b, 0)).toBeLessThan(20);
    expect(s.foodPheromoneWork).toBe(work);
  });
  it("switches sensed and deposited pheromones between exploring and carrying", () => {
    for (const carrying of [0, 1] as const) {
      const s = createSimulation(layout({ antCount: 1 }));
      Object.assign(s.ants[0], {
        x: 20.5,
        y: 6.5,
        heading: 0,
        carrying,
        distanceSinceSource: 0,
        curiosity: 1,
      });
      s.layout.config.randomTurn = 0;
      const { sensorAngle: angle, sensorDistance: d } = s.layout.config;
      const followed = carrying ? s.homePheromone : s.foodPheromone;
      followed[
        cellIndex(
          s.layout,
          20.5 + Math.cos(angle) * d,
          6.5 + Math.sin(angle) * d,
        )
      ] = 80;
      step(s);
      expect(s.ants[0].heading).toBeGreaterThan(0.05);
      const deposited = carrying
        ? s.foodPheromoneDeposits
        : s.homePheromoneDeposits;
      const other = carrying
        ? s.homePheromoneDeposits
        : s.foodPheromoneDeposits;
      expect(deposited[6 * 32 + 20]).toBeGreaterThan(0);
      expect(other.every((v) => v === 0)).toBe(true);
      expect(s).not.toHaveProperty("pheromone");
    }
  });
  it("all ants sense the start-of-tick field", () => {
    const s = createSimulation(layout({ antCount: 2 }));
    Object.assign(s.ants[0], { x: 20.5, y: 6.5, heading: 0, carrying: 1 });
    Object.assign(s.ants[1], { x: 17.5, y: 6.5, heading: 0, carrying: 0 });
    const other = structuredClone(s);
    other.layout.config.deposit = 0;
    step(s);
    step(other);
    expect(s.ants[1]).toEqual(other.ants[1]);
  });
  it("keeps pheromones finite, nonnegative, capped and unsaturated in the demo", () => {
    const s = createSimulation(createDemoLayout());
    advance(s, 1800);
    for (const field of [s.foodPheromone, s.homePheromone]) {
      expect(
        field.every(
          (v) =>
            Number.isFinite(v) && v >= 0 && v <= s.layout.config.maxPheromone,
        ),
      ).toBe(true);
      expect(
        field.filter((v) => v >= s.layout.config.maxPheromone).length,
      ).toBeLessThan(field.length / 10);
    }
    expect(s.delivered).toBeGreaterThan(120);
    expect(mass(s)).toBe(5220);
  });
});

describe("terrain editing", () => {
  it("applies food, wall and eraser rules to layout and current world", () => {
    const s = createSimulation(layout());
    const nest = 12 * 32 + 6,
      food = 12 * 32 + 23,
      wall = 100;
    applyEdit(s, "wall", [nest, food, wall]);
    expect(s.walls[nest]).toBe(0);
    expect(s.walls[food]).toBe(0);
    expect(s.walls[wall]).toBe(1);
    applyEdit(s, "food", [nest, wall, 101], 100);
    expect(s.food[nest]).toBe(0);
    expect(s.food[wall]).toBe(0);
    expect(s.food[101]).toBe(100);
    applyEdit(s, "food", [101], 65_535);
    expect(s.food[101]).toBe(65_535);
    s.foodPheromone[101] = 10;
    s.ants[0].carrying = 1;
    applyEdit(s, "erase", [wall, 101, nest]);
    expect(s.walls[wall]).toBe(0);
    expect(s.food[101]).toBe(0);
    expect(s.foodPheromone[101]).toBe(10);
    expect(s.ants[0].carrying).toBe(1);
    expect(createSimulation(s.layout).food[101]).toBe(0);
  });
  it("clears all wall buffers and deterministically pushes embedded ants only", () => {
    const s = createSimulation(layout({ antCount: 2 }));
    const b = 10 * 32 + 10;
    Object.assign(s.ants[0], { x: 10.5, y: 10.5, carrying: 1 });
    const untouched = { ...s.ants[1] };
    for (const a of [
      s.foodPheromone,
      s.foodPheromoneWork,
      s.foodPheromoneDeposits,
      s.homePheromone,
      s.homePheromoneWork,
      s.homePheromoneDeposits,
    ])
      a[b] = 10;
    const other = structuredClone(s);
    applyEdit(s, "wall", [b]);
    applyEdit(other, "wall", [b]);
    expect(s.ants).toEqual(other.ants);
    expect(s.ants[0].carrying).toBe(1);
    expect(s.ants[1]).toEqual(untouched);
    expect(s.walls[cellIndex(s.layout, s.ants[0].x, s.ants[0].y)]).toBe(0);
    for (const a of [
      s.foodPheromone,
      s.foodPheromoneWork,
      s.foodPheromoneDeposits,
      s.homePheromone,
      s.homePheromoneWork,
      s.homePheromoneDeposits,
    ])
      expect(a[b]).toBe(0);
  });
  it("interpolates fast strokes and only feeds a cell once per stroke", () => {
    const s = createSimulation(layout());
    const stroke = createStroke("food", 1);
    extendStroke(s, stroke, { x: 2.5, y: 2.5 });
    extendStroke(s, stroke, { x: 20.5, y: 2.5 });
    extendStroke(s, stroke, { x: 2.5, y: 2.5 });
    for (let x = 2; x <= 20; x++) expect(s.food[2 * 32 + x]).toBe(1);
    const wall = createStroke("wall");
    extendStroke(s, wall, { x: 2.5, y: 3.5 });
    extendStroke(s, wall, { x: 20.5, y: 3.5 });
    for (let x = 2; x <= 20; x++) expect(s.walls[3 * 32 + x]).toBe(1);
  });
  it.each(["food", "wall", "erase"] as const)(
    "uses a circular brush for %s, clipped at edges and once per stroke",
    (tool) => {
      const s = createSimulation(layout({ food: [] }));
      if (tool === "erase")
        applyEdit(
          s,
          "food",
          Array.from({ length: 32 * 24 }, (_, i) => i),
          10,
        );
      const stroke = createStroke(tool, 1, 5);
      extendStroke(s, stroke, { x: 15.5, y: 5.5 });
      extendStroke(s, stroke, { x: 15.5, y: 5.5 });
      const value = (x: number, y: number) =>
        tool === "wall" ? s.walls[y * 32 + x] : s.food[y * 32 + x];
      expect(value(13, 5)).toBe(tool === "erase" ? 0 : 1);
      expect(value(15, 3)).toBe(tool === "erase" ? 0 : 1);
      expect(value(13, 3)).toBe(tool === "erase" ? 10 : 0);
      expect(value(12, 5)).toBe(tool === "erase" ? 10 : 0);
      const edge = createStroke(tool, 1, 5);
      extendStroke(s, edge, { x: 0.5, y: 0.5 });
      expect(value(0, 0)).toBe(tool === "erase" ? 0 : 1);
      expect(value(31, 0)).toBe(tool === "erase" ? 10 : 0);
      expect(s.food.length).toBe(32 * 24);
    },
  );
  it("restarts edited layout with replenished food and initial RNG", () => {
    const s = createSimulation(layout());
    advance(s, 100);
    applyEdit(s, "food", [100], 40);
    applyEdit(s, "wall", [101]);
    const reset = createSimulation(s.layout);
    expect(reset.tick).toBe(0);
    expect(reset.delivered).toBe(0);
    expect(reset.food[100]).toBe(40);
    expect(reset.walls[101]).toBe(1);
    expect(reset.ants).toEqual(createSimulation(s.layout).ants);
  });
});

describe("foraging worlds", () => {
  it.each([false, true])(
    "discovers, collects, returns and explores with a gapped wall=%s",
    (wall) => {
      const walls = wall
        ? Array.from({ length: 24 }, (_, y) => y)
            .filter((y) => y < 9 || y > 15)
            .map((y) => y * 32 + 16)
        : [];
      const s = createSimulation(layout({ walls }));
      advance(s, 1800);
      expect(s.delivered).toBeGreaterThan(10);
      expect(s.ants.some((a) => a.carrying === 0)).toBe(true);
      expect(mass(s)).toBe(300);
    },
  );
  it("retains then evaporates the old trail after erasing food", () => {
    const s = createSimulation(layout());
    advance(s, 600);
    applyEdit(s, "erase", [12 * 32 + 23]);
    expect(s.foodPheromone.some((v) => v > 0)).toBe(true);
    // Isolate evaporation after the last carrier finishes depositing.
    s.ants = [];
    const before = s.foodPheromone.reduce((a, b) => a + b, 0);
    advance(s, 600);
    expect(s.foodPheromone.reduce((a, b) => a + b, 0)).toBeLessThan(
      before * 0.7,
    );
  });
  it("does not rescue or teleport through a completely closed wall", () => {
    const s = createSimulation(
      layout({ walls: Array.from({ length: 24 }, (_, y) => y * 32 + 16) }),
    );
    advance(s, 1800);
    expect(s.delivered).toBe(0);
    expect(s.ants.every((a) => a.x < 16)).toBe(true);
    expect(mass(s)).toBe(300);
  });
});

describe("fixed clock", () => {
  it("gives the same result at 1x/2x/4x and different frame rates", () => {
    const states = [1, 2, 4].map((speed) => {
      const s = createSimulation(layout()),
        clock = new FixedClock();
      clock.consume(0, speed, () => step(s));
      for (let t = 10; t <= 4000 / speed; t += 10)
        clock.consume(t, speed, () => step(s));
      return state(s);
    });
    expect(states[0].tick).toBe(120);
    expect(states[1]).toEqual(states[0]);
    expect(states[2]).toEqual(states[0]);
    const s = createSimulation(layout()),
      clock = new FixedClock();
    clock.consume(0, 1, () => step(s));
    for (let t = 20; t <= 4000; t += 20) clock.consume(t, 1, () => step(s));
    expect(state(s)).toEqual(states[0]);
  });
  it("bounds catch-up and discards hidden or paused elapsed time", () => {
    const c = new FixedClock();
    let ticks = 0;
    c.consume(0, 1, () => ticks++);
    c.consume(30_000, 4, () => ticks++);
    expect(ticks).toBeLessThanOrEqual(8);
    c.reset();
    c.consume(60_000, 1, () => ticks++);
    expect(ticks).toBeLessThanOrEqual(8);
  });
});
