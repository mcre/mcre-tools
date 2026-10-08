import type { Ref } from "vue";

export const useAntExpandedView = (
  target: Readonly<Ref<HTMLElement | undefined>>,
  nestedOverlay?: Readonly<Ref<boolean>>,
) => {
  const isExpanded = ref(false);
  let previousOverflow: string | undefined;
  let previousFocus: HTMLElement | undefined;
  let disposed = false;

  const enter = async () => {
    if (!target.value || disposed || isExpanded.value) return;
    previousOverflow = document.body.style.overflow;
    previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : undefined;
    document.body.style.overflow = "hidden";
    isExpanded.value = true;
    await nextTick();
    if (!disposed && isExpanded.value) target.value?.focus();
  };
  const exit = () => {
    isExpanded.value = false;
    if (previousOverflow !== undefined) {
      document.body.style.overflow = previousOverflow;
      previousOverflow = undefined;
    }
    const focus = previousFocus;
    previousFocus = undefined;
    void nextTick(() => {
      if (!disposed && focus?.isConnected) focus.focus();
    });
  };
  const keydown = (event: KeyboardEvent) => {
    if (!isExpanded.value || event.defaultPrevented || nestedOverlay?.value)
      return;
    if (event.key === "Escape") {
      event.preventDefault();
      exit();
    } else if (
      event.key === "Tab" &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      const controls = Array.from(
        target.value?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), summary",
        ) ?? [],
      ).filter((element) => element.getClientRects().length > 0);
      if (controls.length === 0) return;
      const index = controls.indexOf(document.activeElement as HTMLElement);
      const next =
        index === -1
          ? event.shiftKey
            ? controls.length - 1
            : 0
          : (index + (event.shiftKey ? -1 : 1) + controls.length) %
            controls.length;
      event.preventDefault();
      controls[next]?.focus();
    }
  };
  if (typeof document !== "undefined")
    document.addEventListener("keydown", keydown);
  onScopeDispose(() => {
    disposed = true;
    if (typeof document !== "undefined") {
      document.removeEventListener("keydown", keydown);
      exit();
    }
  });
  return { isExpanded: readonly(isExpanded), enter, exit };
};
