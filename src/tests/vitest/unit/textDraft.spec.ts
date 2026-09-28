import { describe, expect, it } from "vitest";
import { effectScope } from "vue";
import { useTextDraft } from "@/composables/useTextDraft";

describe("temporary text draft", () => {
  it("restores cleared text exactly, without storing it on the device", () => {
    const scope = effectScope();
    const draft = scope.run(useTextDraft)!;
    draft.text.value = "  原稿\n👨‍👩‍👧‍👦";
    draft.clear();
    expect(draft.text.value).toBe("");
    expect(draft.canRestore.value).toBe(true);
    draft.restore();
    expect(draft.text.value).toBe("  原稿\n👨‍👩‍👧‍👦");
    expect(draft.canRestore.value).toBe(false);
    scope.stop();
  });

  it("does not overwrite a new draft when restoring an older clear", () => {
    const scope = effectScope();
    const draft = scope.run(useTextDraft)!;
    draft.text.value = "old";
    draft.clear();
    draft.text.value = "new";
    draft.restore();
    expect(draft.text.value).toBe("new");
    expect(draft.canRestore.value).toBe(false);
    scope.stop();
  });
});
