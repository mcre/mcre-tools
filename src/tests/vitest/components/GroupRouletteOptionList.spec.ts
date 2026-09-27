import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import GroupRouletteOptionList from "@/components/GroupRouletteOptionList.vue";

const messages: Record<string, string> = {
  "tools.group-roulette.optionListTitle": "{count}件の項目",
  "tools.group-roulette.removeOption": "項目を削除",
};

const t = (key: string, params?: Record<string, unknown>) => {
  const message = messages[key] ?? key;
  return message.replaceAll(/\{(\w+)\}/g, (_, name: string) =>
    String(params?.[name] ?? ""),
  );
};

const mountList = () =>
  mount(GroupRouletteOptionList, {
    props: {
      canEditOptions: true,
      isHost: true,
      options: [
        {
          id: "option_100",
          label: "かなり長い項目名でも番号と削除ボタンに潰されずに読める",
          order: 100,
        },
      ],
    },
    global: {
      mocks: {
        $t: t,
      },
    },
  });

describe("GroupRouletteOptionList", () => {
  it("3桁番号と長い項目名を潰さない構造で表示する", () => {
    const wrapper = mountList();

    expect(wrapper.getComponent({ name: "VList" }).props("lines")).toBe("two");
    expect(wrapper.get(".option-order").text()).toBe("100");

    const title = wrapper.get(".option-list__title");
    expect(title.text()).toBe(
      "かなり長い項目名でも番号と削除ボタンに潰されずに読める",
    );
    expect(title.attributes("title")).toBe(title.text());
  });
});
