import type { Ref } from "vue";

export const useQrClipboard = (image: Ref<string>) => {
  const supported = ref(false);
  const status = ref<"idle" | "copying" | "copied" | "failed">("idle");
  let revision = 0;

  onMounted(() => {
    supported.value =
      typeof navigator.clipboard?.write === "function" &&
      typeof ClipboardItem !== "undefined" &&
      (typeof ClipboardItem.supports !== "function" ||
        ClipboardItem.supports("image/png"));
  });
  watch(
    image,
    () => {
      revision++;
      status.value = "idle";
    },
    { flush: "sync" },
  );
  onScopeDispose(() => {
    revision++;
  });

  const copy = async () => {
    if (!supported.value || !image.value || status.value === "copying") return;
    const current = ++revision;
    status.value = "copying";
    try {
      const bytes = Uint8Array.from(
        atob(image.value.split(",", 2)[1]),
        (character) => character.codePointAt(0)!,
      );
      const blob = new Blob([bytes], { type: "image/png" });
      // Call write during the click event to preserve Safari's user activation.
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      if (current === revision) status.value = "copied";
    } catch {
      if (current === revision) status.value = "failed";
    }
  };

  return { supported, status, copy };
};
