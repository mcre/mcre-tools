import type { Ref } from "vue";

export const useQrCode = (text: Ref<string>) => {
  const image = ref("");
  const error = ref(false);
  const pending = ref(false);

  watch(
    text,
    async (value, _oldValue, onCleanup) => {
      let current = true;
      onCleanup(() => {
        current = false;
      });
      image.value = "";
      error.value = false;
      pending.value = !!value;
      if (!value) return;
      try {
        const generated = await generateQrCode(value);
        if (current) image.value = generated;
      } catch {
        if (current) error.value = true;
      } finally {
        if (current) pending.value = false;
      }
    },
    { flush: "sync", immediate: true },
  );

  return { image, error, pending };
};
