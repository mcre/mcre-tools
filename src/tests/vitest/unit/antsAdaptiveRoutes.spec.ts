// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createMapLayout } from "@/lib/ants/maps";
import { runExplorationTrial } from "../../../../tools/ants/exploration";
import protocol from "../../../../tools/ants/exploration-protocol.json";

describe("continued exploration after a route forms", () => {
  it("moves most deliveries to the shorter route after its opening", () => {
    const scenario = {
      ...protocol.screen,
      ...protocol.screen.scenarios.shortcut,
    };
    const result = runExplorationTrial(
      "shortcut",
      createMapLayout("shortcut", 17),
      scenario,
    );
    const before = result.windows.filter(
      (w) => w.endSeconds <= scenario.shortcut.openAtSeconds,
    );
    const late = result.windows.filter(
      (w) => w.endSeconds > scenario.seconds - 120,
    );
    const sum = (
      rows: typeof late,
      key: "delivered" | "shortcutReturns" | "detourReturns",
    ) => rows.reduce((n, w) => n + w[key], 0);
    expect(sum(before, "delivered")).toBeGreaterThan(100);
    expect(sum(before, "shortcutReturns")).toBe(0);
    expect(
      sum(late, "shortcutReturns") /
        (sum(late, "shortcutReturns") + sum(late, "detourReturns")),
    ).toBeGreaterThan(0.5);
    const distance = (rows: typeof late) =>
      rows.reduce(
        (n, w) => n + (w.averageReturnDistance ?? 0) * w.delivered,
        0,
      ) / sum(rows, "delivered");
    expect(distance(late)).toBeLessThan(distance(before) * 0.9);
    expect(result.valid).toBe(true);
  }, 90_000);

  it("keeps gathering from both large branches instead of committing to one", () => {
    const result = runExplorationTrial(
      "fork",
      createMapLayout("fork", 29),
      protocol.screen,
    );
    for (const source of result.sources.slice(1))
      expect(
        (source.initial - source.remaining) / source.initial,
      ).toBeGreaterThan(0.1);
    expect(result.valid).toBe(true);
  }, 60_000);
});
