import { parentPort, workerData } from "node:worker_threads";

const { createMapLayout, runTrial, runExplorationTrial } = await import(
  workerData.bundleURL
);
parentPort.on("message", (job) => {
  try {
    const layout = createMapLayout(job.mapId, job.seed);
    layout.config = { ...job.config };
    if (job.amountPerCell !== undefined)
      for (const food of layout.food) food.amount = job.amountPerCell;
    parentPort.postMessage({
      result: job.scenario
        ? runExplorationTrial(job.mapId, layout, job.scenario)
        : runTrial(job.mapId, layout, job.seconds),
    });
  } catch (error) {
    parentPort.postMessage({ error: String(error.stack || error) });
  }
});
