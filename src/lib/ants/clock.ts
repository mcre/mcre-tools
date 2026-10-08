import { DT } from "./types";
export class FixedClock {
  private previous?: number;
  private accumulator = 0;
  reset() {
    this.previous = undefined;
    this.accumulator = 0;
  }

  consume(now: number, speed: number, tick: () => void) {
    if (this.previous === undefined) {
      this.previous = now;
      return;
    }
    this.accumulator += Math.min(250, Math.max(0, now - this.previous)) * speed;
    this.previous = now;
    let count = 0;
    const limit = Math.min(32, Math.max(8, Math.ceil(speed)));
    while (this.accumulator + 1e-8 >= DT * 1000 && count < limit) {
      tick();
      this.accumulator -= DT * 1000;
      count++;
    }
    if (count === limit) this.accumulator %= DT * 1000;
  }
}
