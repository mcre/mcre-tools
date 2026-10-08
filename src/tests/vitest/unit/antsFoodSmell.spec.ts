import { describe, expect, it } from "vitest";
import {
  applyEdit,
  createDemoLayout,
  createSimulation,
  senseFoodDirection,
  step,
} from "@/lib/ants/model";

const world = () => {
  const l = createDemoLayout();
  Object.assign(l, {
    columns: 32,
    rows: 24,
    antCount: 1,
    nest: { x: 3.5, y: 3.5, radius: 1 },
    food: [],
  });
  l.config.randomTurn = 0;
  const s = createSimulation(l);
  Object.assign(s.ants[0], { x: 16.5, y: 8.5, heading: 0 });
  return s;
};

describe("local food smell", () => {
  it("senses nearby food only and leaves state unchanged", () => {
    const s = world();
    expect(senseFoodDirection(s, 16.5, 8.5)).toBeUndefined();
    applyEdit(s, "food", [13 * 32 + 18], 90);
    const before = structuredClone(s);
    expect(senseFoodDirection(s, 16.5, 8.5)).toBeCloseTo(Math.atan2(5, 2));
    // Compare cloned snapshots on both sides to keep TypedArray realms equal.
    expect(structuredClone(s)).toEqual(before);
    applyEdit(s, "erase", [13 * 32 + 18]);
    applyEdit(s, "food", [8 * 32 + 25], 100);
    expect(senseFoodDirection(s, 16.5, 8.5)).toBeUndefined();
  });
  it("blocks smell at walls, including diagonal corners", () => {
    const s = world();
    applyEdit(s, "food", [8 * 32 + 19], 100);
    applyEdit(s, "wall", [8 * 32 + 18]);
    expect(senseFoodDirection(s, 16.5, 8.5)).toBeUndefined();
    applyEdit(s, "erase", [8 * 32 + 18, 8 * 32 + 19]);
    applyEdit(s, "food", [9 * 32 + 17], 100);
    applyEdit(s, "wall", [8 * 32 + 17]);
    expect(senseFoodDirection(s, 16.5, 8.5)).toBeUndefined();
  });
  it("weights nearby food more strongly and ignores depleted or erased food immediately", () => {
    const s = world();
    applyEdit(s, "food", [8 * 32 + 18, 15 * 32 + 16], 100);
    const direction = senseFoodDirection(s, 16.5, 8.5)!;
    expect(direction).toBeGreaterThan(0);
    expect(direction).toBeLessThan(Math.PI / 4);
    s.food[8 * 32 + 18] = 0;
    expect(senseFoodDirection(s, 16.5, 8.5)).toBeCloseTo(Math.PI / 2);
    applyEdit(s, "erase", [15 * 32 + 16]);
    expect(senseFoodDirection(s, 16.5, 8.5)).toBeUndefined();
  });
  it("gently turns searching ants, but not carriers, toward nearby food", () => {
    const s = world();
    applyEdit(s, "food", [13 * 32 + 18], 100);
    const carrier = structuredClone(s);
    carrier.ants[0].carrying = 1;
    const disabled = structuredClone(s);
    disabled.layout.config.foodSmellRadius = 0;
    step(s);
    step(carrier);
    step(disabled);
    expect(s.ants[0].heading).toBeGreaterThan(0.01);
    expect(s.ants[0].heading).toBeLessThan(0.1);
    expect(carrier.ants[0].heading).toBe(0);
    expect(disabled.ants[0].heading).toBe(0);
    expect(s.ants[0].carrying).toBe(0);
    expect(s.food[13 * 32 + 18]).toBe(100);
  });
  it("keeps random variation when food is sensed", () => {
    const turns = Array.from({ length: 100 }, (_, seed) => {
      const s = world();
      s.rngState = seed;
      s.layout.config.randomTurn = 0.09;
      applyEdit(s, "food", [13 * 32 + 18], 100);
      step(s);
      return s.ants[0].heading;
    });
    expect(Math.max(...turns) - Math.min(...turns)).toBeGreaterThan(0.2);
  });
  it("clips sensing at world edges without wrapping cells", () => {
    const s = world();
    applyEdit(s, "food", [5 * 32 + 31], 100);
    expect(senseFoodDirection(s, 0.5, 5.5)).toBeUndefined();
    applyEdit(s, "food", [5 * 32], 100);
    expect(senseFoodDirection(s, 0.5, 4.5)).toBeCloseTo(Math.PI / 2);
  });
});
