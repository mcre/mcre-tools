import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import GroupRouletteOptionEditor from "@/components/GroupRouletteOptionEditor.vue";

const messages: Record<string, string> = {
  "tools.group-roulette.addOption": "項目を追加",
  "tools.group-roulette.optionEditorHelp":
    "ルーレットに入れる項目を追加します。",
  "tools.group-roulette.optionEditorTitle": "項目を追加",
  "tools.group-roulette.optionLabel": "項目名",
};

const t = (key: string) => messages[key] ?? key;

const defaultProps = {
  addingOption: false,
  canAddOption: true,
  guestAddEnabled: true,
  member: {
    id: "member_host",
    displayName: "ホスト",
    role: "host" as const,
  },
  status: "waiting" as const,
};

const mountEditor = (props: Partial<typeof defaultProps> = {}) =>
  mount(GroupRouletteOptionEditor, {
    props: {
      ...defaultProps,
      ...props,
    },
    global: {
      mocks: {
        $t: t,
      },
    },
  });

describe("GroupRouletteOptionEditor", () => {
  it("項目追加中は入力を操作不可にし、送信中表示にする", async () => {
    const wrapper = mountEditor({
      addingOption: true,
    });

    expect(wrapper.getComponent({ name: "VTextField" }).props("disabled")).toBe(
      true,
    );
    const button = wrapper.getComponent({ name: "VBtn" });
    expect(button.props("disabled")).toBe(false);
    expect(button.props("loading")).toBe(true);

    await wrapper.get("form").trigger("submit");
    expect(wrapper.emitted("add")).toBeUndefined();
  });
});
