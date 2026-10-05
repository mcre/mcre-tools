type HistoryPoint = { total: number; estimate: number };
type Interval = {
  first: HistoryPoint;
  last: HistoryPoint;
  min: HistoryPoint;
  max: HistoryPoint;
  points: HistoryPoint[];
};

// At least 1024 intervals survive each merge. They are narrower than a CSS
// pixel even at the widest plot, so visible fluctuations are not flattened.
const intervalLimit = 2048;

const mergeIntervals = (earlier: Interval, later: Interval): Interval => {
  const first = earlier.first;
  const last = later.last;
  const min =
    earlier.min.estimate <= later.min.estimate ? earlier.min : later.min;
  const max =
    earlier.max.estimate >= later.max.estimate ? earlier.max : later.max;
  return {
    first,
    last,
    min,
    max,
    points: [...new Set([first, min, max, last])].toSorted(
      (a, b) => a.total - b.total,
    ),
  };
};

export const createMonteCarloHistory = () => {
  let intervalWidth = 1;
  let intervals: (Interval | undefined)[] = [];

  const record = (point: HistoryPoint): HistoryPoint[] => {
    // Widen trial-count intervals together, so repeated compression does not
    // discard the middle of a long experiment in favor of recent samples.
    while (point.total > intervalWidth * intervalLimit) {
      const merged: (Interval | undefined)[] = [];
      for (let i = 0; i < intervals.length; i += 2) {
        const earlier = intervals[i];
        const later = intervals[i + 1];
        merged[i / 2] =
          earlier && later
            ? mergeIntervals(earlier, later)
            : (earlier ?? later);
      }
      intervals = merged;
      intervalWidth *= 2;
    }
    const index = Math.floor((point.total - 1) / intervalWidth);
    const incoming = {
      first: point,
      last: point,
      min: point,
      max: point,
      points: [point],
    };
    const existing = intervals[index];
    intervals[index] = existing ? mergeIntervals(existing, incoming) : incoming;

    // Retain real endpoints and extrema, never averaged or fabricated values.
    // Cache each interval's selected points so only the changed interval needs
    // sorting. At most four per interval bounds the trace at 8192 samples.
    const trace: HistoryPoint[] = [];
    for (const interval of intervals) {
      if (interval) trace.push(...interval.points);
    }
    return trace;
  };
  const reset = () => {
    intervalWidth = 1;
    intervals = [];
  };
  return { record, reset };
};
