// Browser benchmark of the pure model and Canvas renderer.
// Temporary bundles are outside dist; no simulation diagnostics ship to users.
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { build } from "vite";

const temporary = await mkdtemp(resolve(tmpdir(), "mcre-ants-benchmark-"));
const destination = resolve("output/playwright/ants");
await mkdir(destination, { recursive: true });
let browser;
try {
  const entry = resolve(temporary, "entry.js");
  await writeFile(
    entry,
    ["model", "renderer"]
      .map(
        (name) =>
          `export * from ${JSON.stringify(resolve(`src/lib/ants/${name}.ts`))};`,
      )
      .join("\n"),
  );
  await build({
    configFile: false,
    logLevel: "silent",
    build: {
      outDir: resolve(temporary, "bundle"),
      lib: { entry, formats: ["es"], fileName: () => "model.js" },
      minify: false,
    },
  });
  const bundle = await readFile(resolve(temporary, "bundle/model.js"), "utf8");
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1000, height: 700 },
    deviceScaleFactor: 1,
  });
  await page.route("https://ants-benchmark.test/**", (route) =>
    route.fulfill({
      contentType: route.request().url().endsWith("model.js")
        ? "text/javascript"
        : "text/html",
      body: route.request().url().endsWith("model.js")
        ? bundle
        : "<style>body{margin:0}canvas{width:1000px;height:666.667px}</style><canvas></canvas>",
    }),
  );
  await page.goto("https://ants-benchmark.test/");
  const measurement = await page.evaluate(async () => {
    const m = await import("/model.js");
    const world = m.createSimulation(m.createDemoLayout());
    const renderer = m.createAntRenderer(document.querySelector("canvas"));
    renderer.resize();
    const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;
    const describe = (values) => ({
      mean: mean(values),
      p95: values.toSorted((a, b) => a - b)[Math.floor(values.length * 0.95)],
      max: Math.max(...values),
    });
    const ticks = [],
      observations = [];
    for (let i = 0; i < 1800; i++) {
      const start = performance.now();
      m.step(world);
      ticks.push(performance.now() - start);
      if ([299, 899, 1799].includes(i))
        observations.push({
          seconds: (i + 1) / 30,
          ...m.summarize(world),
          homeTrailCells: world.homePheromone.filter((v) => v > 0.5).length,
          foodTrailCells: world.foodPheromone.filter((v) => v > 0.5).length,
        });
    }
    const diffusion = [];
    for (let i = 0; i < 300; i++) {
      const start = performance.now();
      m.diffuseField(world, world.homePheromone, world.homePheromoneWork);
      m.diffuseField(world, world.foodPheromone, world.foodPheromoneWork);
      diffusion.push(performance.now() - start);
    }
    const rendering = [];
    for (let i = 0; i < 300; i++) {
      const start = performance.now();
      renderer.draw(world, true, i % 6 === 0);
      rendering.push(performance.now() - start);
    }
    renderer.draw(world, true, true);
    return {
      world: { columns: 240, rows: 160, ants: 300, dt: 1 / 30 },
      observations,
      stepMs: describe(ticks.slice(60)),
      diffusionMs: describe(diffusion),
      renderMs: describe(rendering),
      userAgent: navigator.userAgent,
    };
  });
  await page.screenshot({ path: resolve(destination, "demo-60s.png") });
  if (process.argv[2]) {
    const ui = await browser.newPage({
      viewport: { width: 1280, height: 1000 },
      reducedMotion: "reduce",
    });
    await ui.goto(process.argv[2]);
    await ui.getByRole("button", { name: "再開", exact: true }).waitFor();
    const realtime = [];
    for (const speed of [1, 8, 32]) {
      const slider = ui.getByRole("slider", { name: "再生速度", exact: true });
      if (speed === 32) await slider.press("End");
      else {
        await slider.press("Home");
        for (let i = 0; i < (speed - 0.5) / 0.25; i++)
          await slider.press("ArrowRight");
      }
      const startTick = Number(
        await ui.getByTestId("ants-canvas").getAttribute("data-tick"),
      );
      await ui.getByRole("button", { name: "再開", exact: true }).click();
      const sample = await ui.evaluate(async (speed) => {
        const frames = [],
          longTasks = [],
          start = performance.now();
        let previous = start,
          id;
        const observer = new PerformanceObserver((list) =>
          longTasks.push(...list.getEntries().map((entry) => entry.duration)),
        );
        observer.observe({ type: "longtask", buffered: false });
        const frame = (now) => {
          frames.push(now - previous);
          previous = now;
          id = requestAnimationFrame(frame);
        };
        id = requestAnimationFrame(frame);
        await new Promise((resolve) => setTimeout(resolve, 12_000));
        cancelAnimationFrame(id);
        observer.disconnect();
        const sorted = frames.slice(2).toSorted((a, b) => a - b);
        return {
          speed,
          durationMs: performance.now() - start,
          frames: sorted.length,
          frameP95Ms: sorted[Math.floor(sorted.length * 0.95)],
          maxFrameMs: Math.max(...sorted),
          longTasksOver50Ms: longTasks.length,
        };
      }, speed);
      await ui.getByRole("button", { name: "一時停止", exact: true }).click();
      const endTick = Number(
        await ui.getByTestId("ants-canvas").getAttribute("data-tick"),
      );
      const modelSeconds = (endTick - startTick) / 30;
      realtime.push({
        ...sample,
        modelSeconds,
        actualSpeed: modelSeconds / (sample.durationMs / 1000),
      });
    }
    measurement.realtime = realtime;
    await ui.screenshot({
      path: resolve(destination, "preview-desktop.png"),
      fullPage: true,
    });
    await ui.setViewportSize({ width: 375, height: 812 });
    await ui.screenshot({
      path: resolve(destination, "preview-mobile.png"),
      fullPage: true,
    });
    await ui.close();
  }
  await writeFile(
    resolve(destination, "performance.json"),
    JSON.stringify(measurement, null, 2) + "\n",
  );
  process.stdout.write(JSON.stringify(measurement, null, 2) + "\n");
} finally {
  await browser?.close();
  await rm(temporary, { recursive: true, force: true });
}
