import type { Ref } from "vue";

export const usePiAreaExperiment = (reducedMotion: Readonly<Ref<boolean>>) => {
  const count = ref(8);
  const layout = ref(0);
  const target = ref(0);
  const playback = usePiPlayback((elapsed) => {
    const distance = Math.min(elapsed, 100) / 1200;
    layout.value = Math.max(
      0,
      Math.min(1, layout.value + (target.value === 1 ? distance : -distance)),
    );
    return layout.value !== target.value;
  }, 16);
  const stop = () => {
    playback.stop();
    layout.value = target.value;
  };
  const toggle = () => {
    target.value = 1 - target.value;
    if (reducedMotion.value) stop();
    else playback.start();
  };
  const setCount = (value: number) => {
    if (!Number.isFinite(value)) throw new RangeError("Invalid sector count");
    stop();
    count.value = Math.max(
      4,
      Math.min(AREA_MAX_SECTORS, Math.round(value / 2) * 2),
    );
  };
  watch(reducedMotion, (reduced) => {
    if (reduced) stop();
  });
  return {
    count: readonly(count),
    layout: readonly(layout),
    target: readonly(target),
    toggle,
    setCount,
    stop,
  };
};
