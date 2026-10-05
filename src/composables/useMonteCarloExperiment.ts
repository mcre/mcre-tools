import type { SquarePoint } from "@/utils/piExperiments";

export const MONTE_CARLO_DRAW_LIMIT = 20_000;
const batchLimit = 1_000_000;

export const useMonteCarloExperiment = (
  random: () => number = Math.random,
  now: () => number = () => performance.now(),
) => {
  const total = ref(0);
  const inside = ref(0);
  const drawn = ref(0);
  const batch = shallowRef<SquarePoint[]>([]);
  const history = shallowRef<{ total: number; estimate: number }[]>([]);
  const historyStore = createMonteCarloHistory();
  const estimate = computed(() => estimatePi(inside.value, total.value));
  const atLimit = computed(() => total.value >= Number.MAX_SAFE_INTEGER);
  const drawingComplete = computed(() => drawn.value >= MONTE_CARLO_DRAW_LIMIT);

  const add = (count: number, timeBudgetMs = Infinity) => {
    const amount = Number.isFinite(count)
      ? Math.max(
          0,
          Math.min(
            Math.floor(count),
            batchLimit,
            Number.MAX_SAFE_INTEGER - total.value,
          ),
        )
      : 0;
    const points: SquarePoint[] = [];
    const drawCount = Math.min(amount, MONTE_CARLO_DRAW_LIMIT - drawn.value);
    let insideCount = 0;
    const deadline = Number.isFinite(timeBudgetMs)
      ? now() + Math.max(0, timeBudgetMs)
      : Infinity;
    let processed = 0;
    // Only the initial drawing samples need coordinate objects. Later trials
    // update counts without retaining coordinates or creating point arrays.
    for (; processed < amount; processed++) {
      // Check between complete points so pausing never leaves half a sample.
      if (processed % 1024 === 0 && deadline !== Infinity && now() >= deadline)
        break;
      const x = 2 * random() - 1;
      const y = 2 * random() - 1;
      const inCircle = isInsideUnitCircle(x, y);
      if (inCircle) insideCount++;
      if (processed < drawCount) points.push({ x, y, inside: inCircle });
    }
    batch.value = points;
    if (!processed) return;
    total.value += processed;
    inside.value += insideCount;
    drawn.value += points.length;
    history.value = historyStore.record({
      total: total.value,
      estimate: estimate.value!,
    });
  };
  const reset = () => {
    total.value = 0;
    inside.value = 0;
    drawn.value = 0;
    batch.value = [];
    history.value = [];
    historyStore.reset();
  };
  return {
    total: readonly(total),
    inside: readonly(inside),
    batch,
    history,
    estimate,
    atLimit,
    drawingComplete,
    add,
    reset,
  };
};
