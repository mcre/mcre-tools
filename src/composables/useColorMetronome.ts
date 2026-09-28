import type { ColorMetronomeSettings } from "@/composables/useColorMetronomeSettings";
import type { DeepReadonly, Ref } from "vue";

export const useColorMetronome = (
  settings: DeepReadonly<Ref<ColorMetronomeSettings>> = ref(
    createColorMetronomeSettings(),
  ),
) => {
  const currentIndex = ref(0);
  const isRunning = ref(false);
  const currentBeat = ref(0);
  const currentStep = ref(0);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let epoch = 0;
  let baseBeat = 0;
  let pendingAt: number | undefined;

  const configuration = () => ({
    bpm: settings.value.bpm,
    beats: settings.value.beats,
    subdivision: settings.value.subdivision,
  });

  const active = shallowRef(configuration());

  // Deadlines stay anchored to elapsed time, including after a delayed callback.
  const refresh = () => {
    if (!isRunning.value) return;
    const now = performance.now();
    if (pendingAt !== undefined && now >= pendingAt) {
      const next = configuration();
      const reset =
        next.beats !== active.value.beats ||
        next.subdivision !== active.value.subdivision;
      baseBeat = reset
        ? 0
        : baseBeat +
          Math.round((pendingAt - epoch) / (60_000 / active.value.bpm));
      epoch = pendingAt;
      active.value = next;
      pendingAt = undefined;
    }
    const interval = 60_000 / active.value.bpm / active.value.subdivision;
    const tick = Math.floor((now - epoch) / interval + 1e-9);
    const tickStart = epoch + tick * interval;
    currentBeat.value = baseBeat + Math.floor(tick / active.value.subdivision);
    currentIndex.value = currentBeat.value % active.value.beats;
    currentStep.value = tick % active.value.subdivision;
    const nextUpdate = Math.min(tickStart + interval, pendingAt ?? Infinity);
    timer = setTimeout(refresh, Math.max(1, nextUpdate - performance.now()));
  };

  const stop = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    pendingAt = undefined;
    isRunning.value = false;
  };
  const start = () => {
    if (isRunning.value) return;
    active.value = configuration();
    epoch = performance.now();
    baseBeat = 0;
    pendingAt = undefined;
    isRunning.value = true;
    refresh();
  };
  const reset = () => {
    stop();
    currentIndex.value = 0;
    currentBeat.value = 0;
    currentStep.value = 0;
  };

  watch(
    configuration,
    () => {
      if (!isRunning.value) {
        if (currentIndex.value >= settings.value.beats) currentIndex.value = 0;
        return;
      }
      if (pendingAt === undefined) {
        const beatDuration = 60_000 / active.value.bpm;
        pendingAt =
          epoch +
          (Math.floor((performance.now() - epoch) / beatDuration + 1e-9) + 1) *
            beatDuration;
      }
    },
    { flush: "sync" },
  );

  const currentColor = computed(() => ({
    hex: settings.value.colors[currentIndex.value]!,
  }));
  const shadeColor = computed(() => {
    const hex = currentColor.value.hex;
    const channel = (offset: number) =>
      Number.parseInt(hex.slice(offset, offset + 2), 16);
    const brightness =
      (channel(1) * 0.2126 + channel(3) * 0.7152 + channel(5) * 0.0722) / 255;
    return brightness < 0.2 ? "#ffffff" : "#000000";
  });

  const shadeOpacity = computed(() => {
    if (!isRunning.value) return 0;
    if (active.value.subdivision > 1)
      return (0.6 * currentStep.value) / active.value.subdivision;

    // Equal adjacent colors alternate brightness once per beat, without flashing back.
    const { beats } = active.value;
    const { colors } = settings.value;
    let precedingMatches = 0;
    while (
      precedingMatches < beats - 1 &&
      colors[(currentIndex.value - precedingMatches - 1 + beats) % beats] ===
        currentColor.value.hex
    )
      precedingMatches++;
    const position =
      precedingMatches === beats - 1 ? currentBeat.value : precedingMatches;
    return (position % 2) * 0.3;
  });

  onScopeDispose(stop);
  return {
    currentIndex: readonly(currentIndex),
    currentColor,
    isRunning: readonly(isRunning),
    shadeOpacity,
    shadeColor,
    start,
    stop,
    reset,
  };
};
