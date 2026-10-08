// Offline parameter search. Maps, seeds, horizon and objectives are reproducible;
// this command never changes production defaults or initial map files.
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { availableParallelism, tmpdir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { build } from "vite";

const explorationMode = process.argv.includes("--exploration");
const protocol = JSON.parse(
  await readFile(
    new URL(
      explorationMode ? "ants/exploration-protocol.json" : "ants/protocol.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const baseline = JSON.parse(
  await readFile(
    new URL(
      explorationMode ? "ants/exploration-baseline.json" : "ants/baseline.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const temporary = await mkdtemp(resolve(tmpdir(), "mcre-ants-search-"));
const destination = resolve("output/playwright/ants/optimization");
await mkdir(destination, { recursive: true });
const workers = new Set();
let randomState = 20_261_008;
function random() {
  randomState = (randomState + 0x6d_2b_79_f5) >>> 0;
  let t = randomState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
}
function shuffled(items) {
  return items
    .map((item) => ({ item, order: random() }))
    .toSorted((a, b) => a.order - b.order)
    .map((r) => r.item);
}
function configKey(config) {
  return JSON.stringify(
    Object.entries(config).toSorted(([a], [b]) => a.localeCompare(b)),
  );
}
function unique(configs) {
  return [...new Map(configs.map((c) => [configKey(c), c])).values()];
}
const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;
function describeAdaptation(rows) {
  const fraction = [],
    distance = [],
    leastPicked = [];
  for (const r of rows) {
    const late = r.windows.slice(-2);
    const short = late.reduce((sum, w) => sum + w.shortcutReturns, 0);
    const long = late.reduce((sum, w) => sum + w.detourReturns, 0);
    if (short + long > 0) fraction.push(short / (short + long));
    const deliveries = late.reduce((sum, w) => sum + w.delivered, 0);
    if (deliveries)
      distance.push(
        late.reduce(
          (sum, w) => sum + (w.averageReturnDistance ?? 0) * w.delivered,
          0,
        ) / deliveries,
      );
    const large = r.sources.filter((p) => p.initial > r.sources[0].initial * 4);
    if (large.length > 0)
      leastPicked.push(
        Math.min(...large.map((p) => (p.initial - p.remaining) / p.initial)),
      );
  }
  return {
    meanLateShortcutFraction: fraction.length > 0 ? mean(fraction) : null,
    meanLateReturnDistance: distance.length > 0 ? mean(distance) : null,
    meanLeastLargeSourcePickedFraction:
      leastPicked.length > 0 ? mean(leastPicked) : null,
  };
}

try {
  const entry = resolve(temporary, "entry.js");
  await writeFile(
    entry,
    `export * from ${JSON.stringify(resolve("src/lib/ants/maps.ts"))};\nexport * from ${JSON.stringify(resolve("tools/ants/evaluate.ts"))};\nexport * from ${JSON.stringify(resolve("tools/ants/exploration.ts"))};\n`,
  );
  await build({
    configFile: false,
    logLevel: "silent",
    build: {
      outDir: resolve(temporary, "bundle"),
      lib: { entry, formats: ["es"], fileName: () => "model.mjs" },
      minify: false,
    },
  });
  const bundlePath = resolve(temporary, "bundle/model.mjs");
  const bundleURL = pathToFileURL(bundlePath).href;
  const { ANT_MAPS, scoreTrials } = await import(bundleURL);
  const mapIds = ANT_MAPS.map((map) => map.id);
  const sourceHash = createHash("sha256")
    .update(await readFile(bundlePath))
    .digest("hex");
  const evaluate = async (configs, phase, settings) => {
    const jobs = configs.flatMap((config, candidate) =>
      (settings.maps || mapIds).flatMap((mapId) =>
        settings.seeds.map((seed) => ({
          candidate,
          config,
          mapId,
          seed,
          seconds: settings.seconds,
          amountPerCell: settings.amountPerCell,
          scenario: settings.windowSeconds
            ? {
                seconds: settings.seconds,
                windowSeconds: settings.windowSeconds,
                ...settings.scenarios?.[mapId],
              }
            : undefined,
        })),
      ),
    );
    const rows = Array.from({ length: jobs.length });
    let cursor = 0,
      completed = 0;
    const started = performance.now();
    await Promise.all(
      Array.from(
        { length: Math.min(8, availableParallelism(), jobs.length) },
        async () => {
          const worker = new Worker(
            new URL("ants/worker.mjs", import.meta.url),
            { workerData: { bundleURL } },
          );
          workers.add(worker);
          try {
            while (cursor < jobs.length) {
              const index = cursor++;
              rows[index] = await new Promise((resolveJob, reject) => {
                const cleanup = () => {
                  worker.off("message", message);
                  worker.off("error", error);
                  worker.off("exit", exit);
                };
                const message = (value) => {
                  cleanup();
                  if (value.error) reject(new Error(value.error));
                  else resolveJob(value.result);
                };
                const error = (value) => {
                  cleanup();
                  reject(value);
                };
                const exit = (code) => {
                  cleanup();
                  reject(new Error(`Worker exited (${code})`));
                };
                worker.once("message", message);
                worker.once("error", error);
                worker.once("exit", exit);
                worker.postMessage(jobs[index]);
              });
              completed++;
              if (
                completed === 1 ||
                completed % Math.ceil(jobs.length / 20) === 0 ||
                completed === jobs.length
              )
                process.stdout.write(
                  `${phase}: ${completed}/${jobs.length} trials (${((performance.now() - started) / 1000).toFixed(1)}s)\n`,
                );
            }
          } finally {
            await worker.terminate();
            workers.delete(worker);
          }
        },
      ),
    );
    const results = configs.map((config, candidate) => ({
      config,
      trials: rows.filter((_, index) => jobs[index].candidate === candidate),
    }));
    const original = results.find(
      (r) => configKey(r.config) === configKey(baseline),
    );
    const ranked = results
      .map((r) => ({ ...r, score: scoreTrials(r.trials, original.trials) }))
      .toSorted((a, b) => b.score - a.score);
    await writeFile(
      resolve(destination, `${phase}.json`),
      JSON.stringify({ protocol, sourceHash, ranked }, null, 2) + "\n",
    );
    return ranked;
  };
  const describe = (trials) =>
    mapIds
      .filter((id) => trials.some((r) => r.mapId === id))
      .map((mapId) => {
        const rows = trials.filter((r) => r.mapId === mapId);
        return {
          mapId,
          meanDelivered: mean(rows.map((r) => r.delivered)),
          minDelivered: Math.min(...rows.map((r) => r.delivered)),
          meanReturnFraction: mean(
            rows.map(
              (r) => r.delivered / Math.max(1, r.delivered + r.carrying),
            ),
          ),
          meanSourcesVisited: mean(rows.map((r) => r.sourcesVisited)),
          valid: rows.every((r) => r.valid),
          ...(explorationMode ? describeAdaptation(rows) : {}),
        };
      });

  if (explorationMode) {
    const filename = process.argv.includes("--validate")
      ? process.argv[process.argv.indexOf("--validate") + 1]
      : undefined;
    const input = filename
      ? JSON.parse(await readFile(filename, "utf8"))
      : undefined;
    const chosen = input?.chosen || input;
    if (
      chosen &&
      !Object.keys(baseline).every((key) => Number.isFinite(chosen[key]))
    )
      throw new Error("Candidate must contain every finite model parameter");
    const phase = chosen
      ? process.argv.includes("--regression")
        ? "regression"
        : "validation"
      : "screen";
    const configs = chosen
      ? unique([baseline, chosen])
      : unique(
          protocol.candidates.map((candidate) => ({
            ...baseline,
            ...candidate.config,
          })),
        );
    const ranked = await evaluate(
      configs,
      `exploration-${phase}`,
      protocol[phase],
    );
    process.stdout.write(
      JSON.stringify(
        ranked.map((r) => ({
          config: r.config,
          score: r.score,
          summary: describe(r.trials),
        })),
        null,
        2,
      ) + "\n",
    );
  } else if (process.argv.includes("--validate")) {
    const filename = process.argv[process.argv.indexOf("--validate") + 1];
    const input = JSON.parse(await readFile(filename, "utf8"));
    const chosen = input.chosen || input;
    if (!Object.keys(baseline).every((key) => Number.isFinite(chosen[key])))
      throw new Error("Candidate must contain every finite model parameter");
    const phase = process.argv.includes("--depletion")
      ? "depletion"
      : "followup-validation";
    const settings =
      phase === "depletion" ? protocol.depletion : protocol.followupValidation;
    const validation = await evaluate(
      unique([baseline, chosen]),
      phase,
      settings,
    );
    const original = validation.find(
      (r) => configKey(r.config) === configKey(baseline),
    );
    const optimized = validation.find(
      (r) => configKey(r.config) === configKey(chosen),
    );
    const report = {
      protocol,
      sourceHash,
      baseline,
      chosen,
      validationScore: optimized.score,
      summary: {
        baseline: describe(original.trials),
        optimized: describe(optimized.trials),
      },
      validationTrials: {
        baseline: original.trials,
        optimized: optimized.trials,
      },
    };
    await writeFile(
      resolve(destination, `${phase}-result.json`),
      JSON.stringify(report, null, 2) + "\n",
    );
    process.stdout.write(
      JSON.stringify({ chosen, summary: report.summary }, null, 2) + "\n",
    );
  } else if (process.argv.includes("--baseline")) {
    const [result] = await evaluate([baseline], "baseline", protocol.refine);
    process.stdout.write(
      JSON.stringify(describe(result.trials), null, 2) + "\n",
    );
  } else {
    const changes = [
      { sensorDistance: 4 },
      { sensorDistance: 6 },
      { sensorAngle: 0.75 },
      { turnRate: 3 },
      { distanceDecay: 50 },
      { evaporation: 0.075 },
      { diffusion: 0.6 },
    ];
    const configs = [
      baseline,
      ...changes.map((change) => ({ ...baseline, ...change })),
    ];
    while (unique(configs).length < protocol.screen.candidates) {
      const sampled = Object.fromEntries(
        Object.entries(protocol.ranges).map(([name, values]) => [
          name,
          values[Math.floor(random() * values.length)],
        ]),
      );
      configs.push({ ...baseline, ...sampled });
    }
    const screen = await evaluate(unique(configs), "screen", protocol.screen);
    process.stdout.write(
      `Screen best: ${JSON.stringify({ score: screen[0].score, config: screen[0].config })}\n`,
    );
    const neighbours = screen.slice(0, 2).flatMap(({ config }) =>
      Object.entries(protocol.ranges).flatMap(([name, values]) => {
        const delta = {
          sensorDistance: 1,
          sensorAngle: 0.1,
          turnRate: 0.5,
          distanceDecay: 10,
        }[name];
        return [-1, 1].map((sign) => ({
          ...config,
          [name]: Number(
            Math.max(
              Math.min(...values),
              Math.min(
                Math.max(...values),
                delta
                  ? config[name] + sign * delta
                  : config[name] * (sign < 0 ? 0.7 : 1.3),
              ),
            ).toFixed(4),
          ),
        }));
      }),
    );
    const refinedConfigs = unique([
      baseline,
      ...screen.slice(0, 5).map((r) => r.config),
      ...shuffled(neighbours),
    ]).slice(0, protocol.refine.candidates);
    const refine = await evaluate(refinedConfigs, "refine", protocol.refine);
    const chosen = refine[0].config;
    process.stdout.write(
      `Refined best: ${JSON.stringify({ score: refine[0].score, config: chosen })}\n`,
    );
    const validation = await evaluate(
      unique([baseline, chosen]),
      "validation",
      protocol.validation,
    );
    const original = validation.find(
      (r) => configKey(r.config) === configKey(baseline),
    );
    const optimized = validation.find(
      (r) => configKey(r.config) === configKey(chosen),
    );
    const report = {
      protocol,
      sourceHash,
      baseline,
      chosen,
      trainingScore: refine[0].score,
      validationScore: optimized.score,
      summary: {
        baseline: describe(original.trials),
        optimized: describe(optimized.trials),
      },
      validationTrials: {
        baseline: original.trials,
        optimized: optimized.trials,
      },
    };
    await writeFile(
      resolve(destination, "result.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    process.stdout.write(
      JSON.stringify(
        {
          chosen,
          validationScore: report.validationScore,
          summary: report.summary,
        },
        null,
        2,
      ) + "\n",
    );
  }
} finally {
  await Promise.allSettled([...workers].map((worker) => worker.terminate()));
  await rm(temporary, { recursive: true, force: true });
}
