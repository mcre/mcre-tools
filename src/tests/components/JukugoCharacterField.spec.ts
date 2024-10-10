import { mount } from "@vue/test-utils";
import { describe, it, expect } from "vitest";
import { ref, nextTick } from "vue";
import { find, findComponent } from "@/tests/helpers";
import JukugoCharacterField from "@/components/JukugoCharacterField.vue";

describe("JukugoCharacterField", () => {
  const createWrapper = (modelValueRef: { value: string }) => {
    return mount(JukugoCharacterField, {
      props: {
        modelValue: modelValueRef.value,
        "onUpdate:modelValue": (val) => {
          modelValueRef.value = val;
        },
      },
    });
  };

  it("何も入力していない場合にエラーが出ない", async () => {
    const model = ref("");
    const w = createWrapper(model);

    const textField = findComponent(w, "VTextField");

    expect(model.value).toBe("");
    expect(textField.props("error")).toBe(false);
  });

  it("漢字1文字を入力した場合にエラーが出ない", async () => {
    const model = ref("");
    const w = createWrapper(model);

    const textField = findComponent(w, "VTextField");
    const input = find(textField, "input");

    await input.trigger("compositionstart");
    await input.setValue("漢");
    await input.trigger("compositionend");
    await nextTick();

    expect(model.value).toBe("漢");
    expect(textField.props("error")).toBe(false);
  });

  it("複数文字列を入力すると1文字目だけが採用され、エラーが出ない", async () => {
    const model = ref("");
    const w = createWrapper(model);

    const textField = findComponent(w, "VTextField");
    const input = find(textField, "input");

    await input.trigger("compositionstart");
    await input.setValue("太陽");
    await input.trigger("compositionend");
    await nextTick();

    expect(model.value).toBe("太");
    expect(textField.props("error")).toBe(false);
  });

  it("ひらがなを入力するとエラー", async () => {
    const model = ref("");
    const w = createWrapper(model);

    const textField = findComponent(w, "VTextField");
    const input = find(textField, "input");

    await input.trigger("compositionstart");
    await input.setValue("あ");
    await input.trigger("compositionend");
    await nextTick();

    expect(model.value).toBe("あ");
    expect(textField.props("error")).toBe(true);
  });

  it("アルファベットを入力するとエラー", async () => {
    const model = ref("");
    const w = createWrapper(model);

    const textField = findComponent(w, "VTextField");
    const input = find(textField, "input");

    await input.trigger("compositionstart");
    await input.setValue("a");
    await input.trigger("compositionend");
    await nextTick();

    expect(model.value).toBe("a");
    expect(textField.props("error")).toBe(true);
  });

  it("IMEの入力中はエラーが出ない", async () => {
    const model = ref("");
    const w = createWrapper(model);

    const textField = findComponent(w, "VTextField");
    const input = find(textField, "input");

    await input.trigger("compositionstart"); // ---

    await input.setValue("ｋ");
    await nextTick();
    expect(textField.props("error")).toBe(false);

    await input.setValue("か");
    await nextTick();
    expect(textField.props("error")).toBe(false);

    await input.setValue("かｎ");
    await nextTick();
    expect(textField.props("error")).toBe(false);

    await input.setValue("かんｊ");
    await nextTick();
    expect(textField.props("error")).toBe(false);

    await input.setValue("かんじ");
    await nextTick();
    expect(textField.props("error")).toBe(false);

    await input.setValue("漢字");
    await nextTick();
    expect(textField.props("error")).toBe(false);

    await input.trigger("compositionend"); // ---

    await nextTick();
    expect(model.value).toBe("漢");
    expect(textField.props("error")).toBe(false);
  });
});
