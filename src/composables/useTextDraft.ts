export const useTextDraft = () => {
  const text = ref("");
  const clearedText = ref("");
  const canRestore = computed(() => !text.value && !!clearedText.value);

  watch(
    text,
    () => {
      clearedText.value = "";
    },
    { flush: "sync" },
  );

  const clear = () => {
    if (!text.value) return;
    const previous = text.value;
    text.value = "";
    clearedText.value = previous;
  };
  const restore = () => {
    if (canRestore.value) text.value = clearedText.value;
  };

  return { text, canRestore, clear, restore };
};
