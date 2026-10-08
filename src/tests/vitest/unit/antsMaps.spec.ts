import { describe, expect, it } from "vitest";
import { ANT_MAPS, createMapLayout } from "@/lib/ants/maps";
import { createDemoLayout, inNest } from "@/lib/ants/model";

const ids = [
  "open",
  "detour",
  "gap",
  "zigzag",
  "scattered",
  "far",
  "fork",
  "loop",
  "rooms",
  "shortcut",
] as const;

describe("reusable initial ant maps", () => {
  it("exposes stable IDs, localized names and geometry independent of parameters", () => {
    expect(ANT_MAPS.map((map) => map.id)).toEqual(ids);
    for (const map of ANT_MAPS) {
      expect(map.name.ja.length).toBeGreaterThan(0);
      expect(map.name.en.length).toBeGreaterThan(0);
      expect(map).not.toHaveProperty("config");
    }
    expect(createMapLayout("open")).toEqual(createDemoLayout());
    expect(
      createMapLayout("open").food.reduce((sum, f) => sum + f.amount, 0),
    ).toBe(5220);
  });

  it.each(ids)("%s has valid, reachable food and a clear nest", (id) => {
    const l = createMapLayout(id);
    const walls = new Set(l.walls);
    expect(walls.size).toBe(l.walls.length);
    for (const index of walls) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(l.columns * l.rows);
      expect(
        inNest(
          l,
          (index % l.columns) + 0.5,
          Math.floor(index / l.columns) + 0.5,
        ),
      ).toBe(false);
    }
    // Offline map validation only; ants never receive this reachability map.
    const queue = [Math.floor(l.nest.y) * l.columns + Math.floor(l.nest.x)];
    const reached = new Set(queue);
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const index = queue[cursor],
        x = index % l.columns,
        y = Math.floor(index / l.columns);
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        const next = ny * l.columns + nx;
        if (
          nx < 0 ||
          nx >= l.columns ||
          ny < 0 ||
          ny >= l.rows ||
          walls.has(next) ||
          reached.has(next)
        )
          continue;
        reached.add(next);
        queue.push(next);
      }
    }
    expect(l.food.length).toBeGreaterThan(0);
    expect(new Set(l.food.map((f) => f.index)).size).toBe(l.food.length);
    for (const f of l.food) {
      expect(f.amount).toBeGreaterThan(0);
      expect(f.amount).toBeLessThanOrEqual(65_535);
      expect(walls.has(f.index)).toBe(false);
      expect(reached.has(f.index)).toBe(true);
      expect(
        inNest(
          l,
          (f.index % l.columns) + 0.5,
          Math.floor(f.index / l.columns) + 0.5,
        ),
      ).toBe(false);
    }
  });

  it("creates independent layouts with a shared configuration and explicit seeds", () => {
    const first = createMapLayout("detour", 17),
      second = createMapLayout("detour", 29);
    expect(first.seed).toBe(17);
    expect(second.seed).toBe(29);
    expect(first.config).toEqual(second.config);
    first.nest.x = 0;
    first.walls.length = 0;
    first.food[0].amount = 1;
    first.config.deposit = 0;
    expect(createMapLayout("detour", 29)).toEqual(second);
    for (const id of ids)
      expect(createMapLayout(id).config).toEqual(second.config);
  });

  it.each(["fork", "loop", "rooms"] as const)(
    "%s has a small early source and a larger separate source",
    (id) => {
      const map = ANT_MAPS.find((m) => m.id === id)!;
      expect(map.walls.length).toBeGreaterThan(0);
      expect(map.food[0].amount).toBeLessThanOrEqual(8);
      expect(map.food.slice(1).every((patch) => patch.amount >= 90)).toBe(true);
      const early = map.food[0];
      for (const patch of map.food.slice(1))
        expect(
          Math.hypot(patch.x - early.x, patch.y - early.y),
        ).toBeGreaterThan(40);
    },
  );
});
