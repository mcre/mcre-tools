export const usePiPlayback = (
  step: (elapsed: number) => boolean,
  interval: number,
) => {
  const running = ref(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let previousTime = 0;
  const stop = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    running.value = false;
  };
  const tick = () => {
    const now = performance.now();
    const shouldContinue = step(now - previousTime);
    previousTime = now;
    if (!shouldContinue) stop();
    if (running.value) timer = setTimeout(tick, interval);
  };
  const start = () => {
    if (running.value) return;
    previousTime = performance.now();
    running.value = true;
    timer = setTimeout(tick, interval);
  };
  onScopeDispose(stop);
  return { running: readonly(running), start, stop };
};
