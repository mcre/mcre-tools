import { describe, expect, it } from "vitest";
import { createDemoLayout, createSimulation, step } from "@/lib/ants/model";

const probe = () => {
  const layout = createDemoLayout();
  Object.assign(layout, {
    columns: 32,
    rows: 24,
    antCount: 1,
    nest: { x: 6.5, y: 12.5, radius: 2 },
    food: [],
  });
  layout.config.randomTurn = 0;
  layout.config.sensorDistance = 5;
  layout.config.sensorAngle = 0.6;
  const s = createSimulation(layout);
  Object.assign(s.ants[0], { x: 20.5, y: 6.5, heading: 0, pace: 1 });
  return s;
};
const total = (field: Float32Array) =>
  field.reduce((sum, value) => sum + value, 0);

describe("two local pheromones", () => {
  it("leaves a home trail while searching, including before finding food", () => {
    const s = probe();
    step(s);
    expect(total(s.homePheromoneDeposits)).toBeGreaterThan(0);
    expect(total(s.foodPheromoneDeposits)).toBe(0);
    expect(total(s.homePheromone)).toBeGreaterThan(0);
    expect(total(s.foodPheromone)).toBe(0);
  });

  it("leaves a food trail only while carrying food", () => {
    const s = probe();
    s.ants[0].carrying = 1;
    step(s);
    expect(total(s.foodPheromoneDeposits)).toBeGreaterThan(0);
    expect(total(s.homePheromoneDeposits)).toBe(0);
    expect(total(s.foodPheromone)).toBeGreaterThan(0);
    expect(total(s.homePheromone)).toBe(0);
  });

  it("switches to fresh food marking at pickup and fresh home marking at delivery", () => {
    const s = probe(),
      a = s.ants[0];
    s.food[6 * 32 + 20] = 1;
    a.distanceSinceSource = 70;
    step(s);
    expect(a.carrying).toBe(1);
    expect(a.distanceSinceSource).toBeLessThan(1);
    expect(total(s.foodPheromoneDeposits)).toBeGreaterThan(2);
    expect(total(s.homePheromoneDeposits)).toBe(0);
    Object.assign(a, s.layout.nest);
    a.distanceSinceSource = 70;
    step(s);
    expect(a.carrying).toBe(0);
    expect(s.delivered).toBe(1);
    expect(a.distanceSinceSource).toBeLessThan(1);
    expect(total(s.homePheromoneDeposits)).toBeGreaterThan(2);
    expect(total(s.foodPheromoneDeposits)).toBe(0);
  });

  it.each([0, 1] as const)(
    "marks less with distance from its source in state %s",
    (carrying) => {
      const fresh = probe(),
        older = probe();
      for (const s of [fresh, older]) s.ants[0].carrying = carrying;
      older.ants[0].distanceSinceSource = older.layout.config.distanceDecay;
      step(fresh);
      step(older);
      const field = carrying
        ? "foodPheromoneDeposits"
        : "homePheromoneDeposits";
      expect(total(older[field]) / total(fresh[field])).toBeCloseTo(
        Math.exp(-1),
        6,
      );
      expect(older.ants[0].distanceSinceSource).toBeGreaterThan(
        older.layout.config.distanceDecay,
      );
    },
  );

  it.each([0, 1] as const)(
    "follows only its target pheromone in state %s",
    (carrying) => {
      const s = probe();
      s.ants[0].carrying = carrying;
      // Keep the single-cell cues at the configured five-cell sensors.
      s.ants[0].curiosity = 1;
      const target = carrying ? s.homePheromone : s.foodPheromone;
      const own = carrying ? s.foodPheromone : s.homePheromone;
      target[9 * 32 + 24] = 80;
      own[3 * 32 + 24] = 100;
      step(s);
      expect(s.ants[0].heading).toBeGreaterThan(0.05);
    },
  );

  it("does not steer toward a nest without a local trail", () => {
    const s = probe();
    s.ants[0].carrying = 1;
    const relocated = structuredClone(s);
    relocated.layout.nest = { x: 27.5, y: 20.5, radius: 2 };
    step(s);
    step(relocated);
    expect(s.ants[0].heading).toBe(0);
    expect(s.ants).toEqual(relocated.ants);
  });

  it("creates no field from the nest itself and clears both fields on reset", () => {
    const s = probe();
    step(s);
    s.ants[0].carrying = 1;
    step(s);
    const restarted = createSimulation(s.layout);
    expect(restarted.homePheromone.every((v) => v === 0)).toBe(true);
    expect(restarted.foodPheromone.every((v) => v === 0)).toBe(true);
    restarted.ants = [];
    for (let i = 0; i < 30; i++) step(restarted);
    expect(total(restarted.homePheromone)).toBe(0);
    expect(total(restarted.foodPheromone)).toBe(0);
  });
});
