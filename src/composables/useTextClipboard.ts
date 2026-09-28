import type { Ref } from "vue";

export const useTextClipboard = (
  text: Ref<string>,
  editor: Ref<HTMLTextAreaElement | null>,
) => {
  const status = ref<
    | "idle"
    | "copying"
    | "copied"
    | "pasting"
    | "pasted"
    | "copyFailed"
    | "pasteFailed"
  >("idle");
  const busy = computed(
    () => status.value === "copying" || status.value === "pasting",
  );
  let revision = 0;
  watch(
    text,
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
    if (!text.value || busy.value) return;
    const current = ++revision;
    status.value = "copying";
    try {
      await navigator.clipboard.writeText(text.value);
      if (current === revision) status.value = "copied";
    } catch {
      if (current === revision) status.value = "copyFailed";
    }
  };

  const paste = async () => {
    const input = editor.value;
    if (!input || busy.value) return;
    const current = ++revision;
    const previous = text.value;
    const { selectionStart: start, selectionEnd: end } = input;
    status.value = "pasting";
    try {
      const pasted = (await navigator.clipboard.readText()).replace(
        /\r\n?/g,
        "\n",
      );
      // Permission prompts can stay open while the user edits the draft.
      if (current !== revision) return;
      if (!pasted) {
        status.value = "idle";
        input.focus();
        return;
      }
      text.value = previous.slice(0, start) + pasted + previous.slice(end);
      status.value = "pasted";
      const applied = revision;
      await nextTick();
      if (applied !== revision) return;
      input.focus();
      input.setSelectionRange(start + pasted.length, start + pasted.length);
    } catch {
      if (current !== revision) return;
      status.value = "pasteFailed";
      input.focus();
    }
  };

  return { status, busy, copy, paste };
};
