import type { Ref } from "vue";

export const useMetronomeFullscreen = (
  target: Readonly<Ref<HTMLElement | null>>,
  isRunning: Readonly<Ref<boolean>>,
) => {
  const isExpanded = ref(false);
  const controlsVisible = ref(true);
  let controlsFocused = false;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let previousOverflow: string | undefined;
  let requestId = 0;
  let disposed = false;

  const clearIdle = () => {
    if (idleTimer !== undefined) clearTimeout(idleTimer);
    idleTimer = undefined;
  };
  const activity = () => {
    controlsVisible.value = true;
    clearIdle();
    if (isExpanded.value && isRunning.value && !controlsFocused) {
      idleTimer = setTimeout(() => {
        controlsVisible.value = false;
        idleTimer = undefined;
      }, 2000);
    }
  };
  const setControlsFocused = (focused: boolean) => {
    if (controlsFocused === focused) return;
    controlsFocused = focused;
    activity();
  };
  const expand = () => {
    if (disposed || isExpanded.value) return;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    isExpanded.value = true;
    activity();
  };
  const collapse = () => {
    isExpanded.value = false;
    controlsVisible.value = true;
    controlsFocused = false;
    clearIdle();
    if (previousOverflow !== undefined) {
      document.body.style.overflow = previousOverflow;
      previousOverflow = undefined;
    }
  };
  const exit = async () => {
    requestId++;
    collapse();
    if (target.value && document.fullscreenElement === target.value) {
      try {
        await document.exitFullscreen();
      } catch {
        /* The browser may already be exiting. */
      }
    }
  };
  const enter = async () => {
    const element = target.value;
    if (!element || disposed || isExpanded.value) return;
    const id = ++requestId;
    try {
      if (typeof element.requestFullscreen === "function")
        await element.requestFullscreen();
    } catch {
      // Unsupported or denied fullscreen still permits a viewport-sized view.
    }
    if (disposed || id !== requestId) {
      if (document.fullscreenElement === element) {
        try {
          await document.exitFullscreen();
        } catch {
          /* No longer active. */
        }
      }
      return;
    }
    expand();
  };
  const onFullscreenChange = () => {
    if (target.value && document.fullscreenElement === target.value) expand();
    else collapse();
  };
  const onKeydown = (event: KeyboardEvent) => {
    if (!isExpanded.value) return;
    if (event.key === "Escape") {
      void exit();
      return;
    }
    activity();
    if (
      event.key === "Tab" &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      setControlsFocused(true);
      void nextTick(() => {
        if (!isExpanded.value || disposed) return;
        const buttons = Array.from(
          target.value?.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ) ?? [],
        );
        const focusedButton = document.activeElement;
        const index =
          focusedButton instanceof HTMLButtonElement
            ? buttons.indexOf(focusedButton)
            : -1;
        const next =
          index === -1
            ? event.shiftKey
              ? buttons.length - 1
              : 0
            : (index + (event.shiftKey ? -1 : 1) + buttons.length) %
              buttons.length;
        buttons[next]?.focus();
      });
    }
  };
  watch(isRunning, activity, { flush: "sync" });
  if (typeof document !== "undefined") {
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("keydown", onKeydown);
  }
  onScopeDispose(() => {
    disposed = true;
    if (typeof document !== "undefined") {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("keydown", onKeydown);
      void exit();
    }
  });
  return {
    isExpanded: readonly(isExpanded),
    controlsVisible: readonly(controlsVisible),
    enter,
    exit,
    activity,
    setControlsFocused,
  };
};
