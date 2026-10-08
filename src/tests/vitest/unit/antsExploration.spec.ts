import { describe, expect, it } from "vitest";
import { createMapLayout } from "@/lib/ants/maps";
import { createSimulation, step } from "@/lib/ants/model";

const probe = () => {
  const layout = createMapLayout("open", 41);
  layout.food = [];
  layout.antCount = 1000;
  Object.assign(layout.config, {
    speed: 0.01,
    explorationRate: 0.2,
    explorationDuration: 2,
    individuality: 1,
    pheromoneFloor: 0,
    averageSteering: 0,
    sensorIndividuality: 0,
  });
  const s = createSimulation(layout);
  for (const a of s.ants) Object.assign(a, { x: 120.5, y: 80.5, heading: 0 });
  s.foodPheromone.fill(80);
  return s;
};

describe("occasional exploration on established trails", () => {
  it("gives ants stable, reproducible differences in exploration tendency", () => {
    const first = probe(),
      second = probe();
    const traits = first.ants.map((a) => a.curiosity);
    expect(traits).toEqual(second.ants.map((a) => a.curiosity));
    expect(Math.min(...traits)).toBeGreaterThanOrEqual(0.5);
    expect(Math.max(...traits)).toBeLessThanOrEqual(1.5);
    expect(Math.max(...traits) - Math.min(...traits)).toBeGreaterThan(0.8);
    for (let tick = 0; tick < 45; tick++) step(first);
    expect(first.ants.map((a) => a.curiosity)).toEqual(traits);
  });

  it("uses a per-second event rate rather than changing its mind every tick", () => {
    const s = probe();
    for (let tick = 0; tick < 30; tick++) step(s);
    const fraction =
      s.ants.filter((a) => a.exploreTicks > 0).length / s.ants.length;
    expect(fraction).toBeGreaterThan(0.1);
    expect(fraction).toBeLessThan(0.3);
    expect(s.ants.some((a) => a.exploreTicks >= 30)).toBe(true);
  });

  it("commits to a new direction when leaving a trail", () => {
    const s = probe();
    s.layout.config.explorationRate = 1000;
    step(s);
    expect(
      s.ants.filter((a) => Math.abs(a.heading) > 0.6).length,
    ).toBeGreaterThan(500);
    expect(s.ants.every((a) => a.exploreTicks === 59)).toBe(true);
  });

  it("occasionally follows a weaker sensed trail instead of always the strongest", () => {
    const s = probe();
    Object.assign(s.layout.config, {
      explorationRate: 0,
      randomTurn: 0,
      pheromoneExponent: 0.7,
    });
    s.foodPheromone.fill(0);
    const { sensorAngle: angle, sensorDistance: d } = s.layout.config;
    const sample = (heading: number, value: number) => {
      const x = 120.5 + Math.cos(heading) * d,
        y = 80.5 + Math.sin(heading) * d;
      s.foodPheromone[Math.floor(y) * s.layout.columns + Math.floor(x)] = value;
    };
    sample(-angle, 10);
    sample(0, 2);
    sample(angle, 80);
    step(s);
    expect(s.ants.filter((a) => a.heading < -0.05).length).toBeGreaterThan(20);
    expect(s.ants.filter((a) => a.heading > 0.05).length).toBeGreaterThan(300);
  });

  it("retains reliable steering when alternative choices are infrequent", () => {
    const s = probe();
    Object.assign(s.layout.config, {
      explorationRate: 0,
      randomTurn: 0,
      pheromoneExponent: 1,
      pheromoneChoiceChance: 0.1,
    });
    s.foodPheromone.fill(0);
    const { sensorAngle: angle, sensorDistance: d } = s.layout.config;
    for (const [heading, value] of [
      [-angle, 10],
      [angle, 80],
    ]) {
      const x = 120.5 + Math.cos(heading) * d,
        y = 80.5 + Math.sin(heading) * d;
      s.foodPheromone[Math.floor(y) * s.layout.columns + Math.floor(x)] = value;
    }
    step(s);
    const alternatives = s.ants.filter((a) => a.heading < -0.05).length;
    expect(alternatives).toBeGreaterThan(0);
    expect(alternatives).toBeLessThan(50);
    expect(s.ants.filter((a) => a.heading > 0.05).length).toBeGreaterThan(900);
  });

  it("can explore an empty sensed direction beside an established trail", () => {
    const s = probe();
    Object.assign(s.layout.config, {
      explorationRate: 0,
      randomTurn: 0,
      pheromoneExponent: 1.3,
      pheromoneFloor: 0.15,
    });
    s.foodPheromone.fill(0);
    const { sensorAngle: angle, sensorDistance: d } = s.layout.config;
    const x = 120.5 + Math.cos(angle) * d,
      y = 80.5 + Math.sin(angle) * d;
    s.foodPheromone[Math.floor(y) * s.layout.columns + Math.floor(x)] = 80;
    step(s);
    expect(s.ants.filter((a) => a.heading < -0.05).length).toBeGreaterThan(20);
    expect(s.ants.filter((a) => a.heading > 0.05).length).toBeGreaterThan(500);
  });

  it("can steer by the weighted direction without full random side turns", () => {
    const s = probe();
    Object.assign(s.layout.config, {
      explorationRate: 0,
      randomTurn: 0,
      individuality: 0,
      pheromoneExponent: 1,
      averageSteering: 1,
    });
    for (const a of s.ants) a.curiosity = 1;
    s.foodPheromone.fill(0);
    const { sensorAngle: angle, sensorDistance: d, turnRate } = s.layout.config;
    for (const [heading, value] of [
      [-angle, 10],
      [0, 2],
      [angle, 80],
    ]) {
      const x = 120.5 + Math.cos(heading) * d,
        y = 80.5 + Math.sin(heading) * d;
      s.foodPheromone[Math.floor(y) * s.layout.columns + Math.floor(x)] = value;
    }
    step(s);
    for (const a of s.ants)
      expect(a.heading).toBeCloseTo((turnRate / 30) * (70 / 94), 10);
  });

  it("can give individuals different local sensing distances", () => {
    const s = probe();
    s.ants.length = 2;
    Object.assign(s.layout.config, {
      explorationRate: 0,
      randomTurn: 0,
      sensorIndividuality: 1,
    });
    s.ants[0].curiosity = 0.5;
    s.ants[1].curiosity = 1;
    s.foodPheromone.fill(0);
    const { sensorAngle: angle, sensorDistance: d } = s.layout.config;
    const x = 120.5 + Math.cos(angle) * d,
      y = 80.5 + Math.sin(angle) * d;
    s.foodPheromone[Math.floor(y) * s.layout.columns + Math.floor(x)] = 80;
    step(s);
    expect(s.ants[0].heading).toBe(0);
    expect(s.ants[1].heading).toBeGreaterThan(0.05);
  });

  it("can preserve steadier homing choices while exploration stays flexible", () => {
    const s = probe();
    Object.assign(s.layout.config, {
      explorationRate: 0,
      randomTurn: 0,
      pheromoneExponent: 1,
      pheromoneChoiceChance: 1,
      returnChoiceChance: 0,
    });
    s.homePheromone.fill(0);
    const { sensorAngle: angle, sensorDistance: d } = s.layout.config;
    for (const [heading, value] of [
      [-angle, 10],
      [angle, 80],
    ]) {
      const x = 120.5 + Math.cos(heading) * d,
        y = 80.5 + Math.sin(heading) * d;
      s.homePheromone[Math.floor(y) * s.layout.columns + Math.floor(x)] = value;
    }
    for (const a of s.ants) a.carrying = 1;
    step(s);
    expect(s.ants.every((a) => a.heading > 0.05)).toBe(true);
  });

  it("can favor continuing forward without excluding side trails", () => {
    const s = probe();
    Object.assign(s.layout.config, {
      explorationRate: 0,
      randomTurn: 0,
      pheromoneExponent: 1,
      pheromoneChoiceChance: 1,
      frontWeight: 8,
    });
    step(s);
    const turns = s.ants.filter((a) => Math.abs(a.heading) > 0.05).length;
    expect(turns).toBeGreaterThan(100);
    expect(turns).toBeLessThan(300);
  });

  it("can tune carrying wander independently from searching", () => {
    const s = probe();
    Object.assign(s.layout.config, {
      explorationRate: 0,
      pheromoneExponent: 0,
      returnRandomMultiplier: 0,
    });
    s.homePheromone.fill(80);
    for (const a of s.ants) a.carrying = 1;
    step(s);
    expect(s.ants.every((a) => a.heading === 0)).toBe(true);
  });

  it("ignores pheromone steering during a burst, then resumes it", () => {
    const s = probe();
    s.ants.length = 1;
    s.layout.config.randomTurn = 0;
    s.layout.config.explorationRate = 0;
    s.foodPheromone.fill(0);
    const a = s.ants[0];
    Object.assign(a, { x: 120.5, y: 80.5, heading: 0, exploreTicks: 2 });
    const { sensorAngle, sensorDistance } = s.layout.config;
    const index =
      Math.floor(a.y + Math.sin(sensorAngle) * sensorDistance) *
        s.layout.columns +
      Math.floor(a.x + Math.cos(sensorAngle) * sensorDistance);
    s.foodPheromone[index] = 80;
    step(s);
    expect(a.heading).toBe(0);
    expect(a.exploreTicks).toBe(1);
    step(s);
    expect(a.heading).toBe(0);
    expect(a.exploreTicks).toBe(0);
    step(s);
    expect(a.heading).toBeGreaterThan(0.05);
  });

  it("does not start bursts without a trail or when randomness is disabled", () => {
    for (const mode of ["no-trail", "no-randomness"] as const) {
      const s = probe();
      if (mode === "no-trail") s.foodPheromone.fill(0);
      else s.layout.config.randomTurn = 0;
      for (let tick = 0; tick < 30; tick++) step(s);
      expect(s.ants.every((a) => a.exploreTicks === 0)).toBe(true);
    }
  });

  it("prioritizes the return trail once food is picked up", () => {
    const s = probe();
    s.ants.length = 1;
    s.layout.config.explorationRate = 1000;
    s.homePheromone.fill(80);
    const a = s.ants[0];
    a.exploreTicks = 30;
    s.food[Math.floor(a.y) * s.layout.columns + Math.floor(a.x)] = 1;
    step(s);
    expect(a.carrying).toBe(1);
    expect(a.exploreTicks).toBe(0);
    for (let tick = 0; tick < 30; tick++) step(s);
    expect(a.exploreTicks).toBe(0);
  });

  it("can occasionally explore during return without abandoning its food", () => {
    const s = probe();
    s.layout.config.explorationRate = 0;
    s.layout.config.returnExplorationRate = 1000;
    s.homePheromone.fill(80);
    for (const a of s.ants) a.carrying = 1;
    step(s);
    expect(s.ants.every((a) => a.carrying === 1)).toBe(true);
    expect(s.ants.every((a) => a.exploreTicks === 59)).toBe(true);
  });
});
