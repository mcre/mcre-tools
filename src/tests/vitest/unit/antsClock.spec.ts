import { describe, expect, it } from "vitest";
import { FixedClock } from "@/lib/ants/clock";

describe("high speed ant playback", () => {
  it.each([30, 60, 120])(
    "advances 32 model seconds in one second at %i FPS",
    (fps) => {
      const clock = new FixedClock();
      let ticks = 0;
      const tick = () => ticks++;
      clock.consume(0, 32, tick);
      for (let frame = 1; frame <= fps; frame++)
        clock.consume((frame * 1000) / fps, 32, tick);
      expect(ticks).toBe(960);
    },
  );
  it("bounds delayed high speed frames and discards their backlog", () => {
    const clock = new FixedClock();
    let ticks = 0;
    const tick = () => ticks++;
    clock.consume(0, 32, tick);
    clock.consume(60_000, 32, tick);
    expect(ticks).toBe(32);
    clock.consume(60_000, 32, tick);
    expect(ticks).toBe(32);
    clock.reset();
    clock.consume(120_000, 32, tick);
    expect(ticks).toBe(32);
  });
});
