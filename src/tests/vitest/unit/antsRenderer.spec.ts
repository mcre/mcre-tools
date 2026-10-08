import { afterEach, expect, it, vi } from "vitest";
import { createDemoLayout, createSimulation, step } from "@/lib/ants/model";
import { createAntRenderer } from "@/lib/ants/renderer";

afterEach(() => vi.restoreAllMocks());
it("distinguishes the two trails, blends overlap and hides both together", () => {
  const context: any = {
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    putImageData: vi.fn(),
    createImageData: (w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
    }),
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
  const renderer = createAntRenderer(document.createElement("canvas"));
  const s = createSimulation(createDemoLayout());
  const color = () =>
    Array.from(
      context.putImageData.mock.lastCall[0].data.slice(0, 3),
    ) as number[];
  s.foodPheromone[0] = 100;
  renderer.draw(s, true, true);
  const food = color();
  expect(food[2]).toBeGreaterThan(food[1]);
  expect(food[1]).toBeGreaterThan(food[0]);
  s.foodPheromone[0] = 0;
  s.homePheromone[0] = 100;
  renderer.draw(s, true, true);
  const home = color();
  expect(home[0]).toBeGreaterThan(home[1]);
  expect(home[1]).toBeGreaterThan(home[2]);
  expect(home).not.toEqual(food);
  s.foodPheromone[0] = 100;
  renderer.draw(s, true, true);
  expect(color()).not.toEqual(food);
  expect(color()).not.toEqual(home);
  renderer.draw(s, false, true);
  expect(color()).toEqual([244, 238, 219]);
  expect(s.foodPheromone[0]).toBe(100);
  expect(s.homePheromone[0]).toBe(100);
});
it("rendering at different sizes and frequencies never changes the model or random state", () => {
  const context: any = {
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    putImageData: vi.fn(),
    createImageData: (w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
    }),
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
  const canvas = document.createElement("canvas"),
    renderer = createAntRenderer(canvas),
    a = createSimulation(createDemoLayout()),
    b = createSimulation(createDemoLayout());
  for (let i = 0; i < 90; i++) {
    step(a);
    step(b);
    if (i % 3 === 0) {
      renderer.resize();
      renderer.draw(a, i % 2 === 0);
    }
  }
  expect(a).toEqual(b);
  expect(context.drawImage).toHaveBeenCalledTimes(30);
});
