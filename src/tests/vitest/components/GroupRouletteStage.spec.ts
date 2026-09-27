import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import GroupRouletteStage from "@/components/GroupRouletteStage.vue";

const messages: Record<string, string> = {
  "tools.group-roulette.candidateCount": "{count}件の項目",
  "tools.group-roulette.emptyStageGuidance":
    "項目を追加するとルーレットを回せます。",
  "tools.group-roulette.guestCanAdd":
    "項目を追加できます。ホストの開始を待っています。",
  "tools.group-roulette.noOptionsShort": "項目なし",
  "tools.group-roulette.startSpinPrimary": "ルーレットを回す",
  "tools.group-roulette.stopSpinPrimary": "結果を出す",
  "tools.group-roulette.waiting": "準備中",
  "tools.group-roulette.winner": "結果",
};

const t = (key: string, params?: Record<string, unknown>) => {
  const message = messages[key] ?? key;
  return message.replaceAll(/\{(\w+)\}/g, (_, name: string) =>
    String(params?.[name] ?? ""),
  );
};

const defaultProps = {
  activeOptions: [],
  canStart: false,
  canStop: false,
  currentSpin: null,
  guestAddEnabled: true,
  isHost: false,
  member: null,
  serverNow: () => Date.parse("2026-05-08T09:30:00Z"),
  status: "waiting" as const,
  winnerOption: null,
};

const mountStage = (props: Partial<typeof defaultProps> = {}) =>
  mount(GroupRouletteStage, {
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

describe("GroupRouletteStage", () => {
  it("ホストにはステージ上の開始ボタンを表示する", async () => {
    const wrapper = mountStage({
      activeOptions: [{ id: "option_1", label: "Pizza", order: 1 }],
      canStart: true,
      isHost: true,
      member: {
        id: "member_host",
        displayName: "ホスト",
        role: "host",
      },
    });

    expect(wrapper.text()).toContain("ルーレットを回す");
    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("start")).toHaveLength(1);
  });

  it("ゲストにはホスト専用操作を出さず待機状態を表示する", () => {
    const wrapper = mountStage({
      guestAddEnabled: true,
      member: {
        id: "member_guest",
        displayName: "ゲスト1",
        role: "guest",
      },
    });

    expect(wrapper.text()).toContain("ホストの開始を待っています");
    const buttonText = wrapper.findAll("button").map((button) => button.text());
    expect(buttonText).not.toContain("ルーレットを回す");
    expect(buttonText).not.toContain("結果を出す");
  });

  it("ルーレット面に項目名を表示する", () => {
    const wrapper = mountStage({
      activeOptions: [
        { id: "option_1", label: "Pizza", order: 1 },
        { id: "option_2", label: "寿司", order: 2 },
        { id: "option_3", label: "掃除当番", order: 3 },
      ],
    });

    const labels = wrapper.findAll(".roulette-wheel__label");
    expect(labels.map((label) => label.text())).toEqual([
      "Pizza",
      "寿司",
      "掃除当番",
    ]);
    expect(labels[0].attributes("style")).toContain("--label-angle: 60deg");
  });

  it("ルーレット面の項目名は全て内側から外側へ向けた縦書きにする", () => {
    const wrapper = mountStage({
      activeOptions: [
        { id: "option_1", label: "Pizza", order: 1 },
        { id: "option_2", label: "寿司", order: 2 },
        { id: "option_3", label: "掃除当番", order: 3 },
      ],
    });

    const labelStyle = wrapper
      .get(".roulette-wheel__label")
      .attributes("style");
    expect(labelStyle).not.toContain("--label-counter-angle");
    expect(labelStyle).not.toContain("--label-offset");
    expect(labelStyle).not.toContain("--label-radius:");
    expect(labelStyle).toContain("--label-rotation:");
    expect(labelStyle).toContain("--label-track-width:");
    expect(labelStyle).toContain("--label-font-size: 1.08rem");
    expect(labelStyle).toContain("--label-edge-margin: 16px");
    expect(labelStyle).toContain("--label-line-offset:");
    expect(labelStyle).toContain("--label-text-color: #ffffff");
    expect(labelStyle).toContain("--label-text-shadow: 1px 0 0 #111827");
    expect(labelStyle).not.toContain("--label-text-rotation");
    expect(labelStyle).not.toContain("--label-width:");

    const characters = wrapper.findAll(".roulette-wheel__label-character");
    expect(characters.map((character) => character.text()).join("")).toBe(
      "Pizza寿司掃除当番",
    );
    const firstCharacterStyle = characters[0].attributes("style");
    expect(firstCharacterStyle).toContain(
      "--label-character-offset: calc(100% - var(--label-edge-margin) - 0em)",
    );
    expect(firstCharacterStyle).toContain("--label-character-rotation: 180deg");
    expect(characters[4].attributes("style")).toContain(
      "--label-character-offset: calc(100% - var(--label-edge-margin) - 4.72em)",
    );

    const firstLineStyle = wrapper
      .get(".roulette-wheel__label-line")
      .attributes("style");
    expect(firstLineStyle).toContain("--label-line-x: 0em");
  });

  it("長い項目名は最大2列に分け、省略時も元の項目名をtitleに残す", () => {
    const longLabel = "あいうえおかきくけこさしすせそたちつてと";
    const wrapper = mountStage({
      activeOptions: [
        { id: "option_1", label: longLabel, order: 1 },
        { id: "option_2", label: "寿司", order: 2 },
        { id: "option_3", label: "掃除当番", order: 3 },
        { id: "option_4", label: "旅行先", order: 4 },
        { id: "option_5", label: "ランチ", order: 5 },
        { id: "option_6", label: "会議室", order: 6 },
        { id: "option_7", label: "映画", order: 7 },
        { id: "option_8", label: "温泉", order: 8 },
      ],
    });

    const label = wrapper.get(".roulette-wheel__label");
    const lines = label.findAll(".roulette-wheel__label-line");
    const characters = label
      .findAll(".roulette-wheel__label-character")
      .map((character) => character.text());

    expect(lines).toHaveLength(2);
    expect(
      lines[0].find(".roulette-wheel__label-character").attributes("style"),
    ).toContain(
      "--label-character-offset: calc(100% - var(--label-edge-margin) - 0em)",
    );
    expect(
      lines[1].find(".roulette-wheel__label-character").attributes("style"),
    ).toContain(
      "--label-character-offset: calc(100% - var(--label-edge-margin) - 0em)",
    );
    expect(lines[0].attributes("style")).toContain(
      "--label-line-x: calc(var(--label-line-offset) * -1)",
    );
    expect(lines[1].attributes("style")).toContain(
      "--label-line-x: calc(var(--label-line-offset) * 1)",
    );
    expect(characters.join("")).toBe("あいうえおかきくけ...");
    expect(label.attributes("title")).toBe(longLabel);
    expect(label.text()).not.toContain(longLabel);
  });

  it("扇形とラベル角度は同じ基準にし、区切り線は固定幅の要素で描く", () => {
    const wrapper = mountStage({
      activeOptions: [
        { id: "option_1", label: "Pizza", order: 1 },
        { id: "option_2", label: "寿司", order: 2 },
        { id: "option_3", label: "掃除当番", order: 3 },
      ],
    });

    const wheelStyle = wrapper.get(".roulette-wheel").attributes("style");
    expect(wheelStyle).toContain("conic-gradient(from 0deg");
    expect(wheelStyle).toContain("rgb(47, 143, 131) 0deg 120deg");
    expect(wheelStyle).not.toContain("0.36deg");
    expect(wheelStyle).not.toContain("0.09deg");
    expect(wheelStyle).not.toContain("0.22deg");
    expect(wheelStyle).not.toContain("1.35deg");

    const separators = wrapper.findAll(".roulette-wheel__separator");
    expect(separators).toHaveLength(3);
    expect(separators[0].attributes("style")).toContain(
      "--separator-angle: 0deg",
    );
    expect(separators[1].attributes("style")).toContain(
      "--separator-angle: 120deg",
    );
  });

  it("ルーレット中は開始時点の項目名をルーレット面に表示する", () => {
    const wrapper = mountStage({
      activeOptions: [{ id: "option_late", label: "あとから追加", order: 99 }],
      currentSpin: {
        id: "spin_1",
        startedAt: "2026-05-08T09:30:00Z",
        durationMs: 5000,
        options: [
          { id: "option_1", label: "Pizza", order: 1 },
          { id: "option_2", label: "寿司", order: 2 },
        ],
      },
      status: "spinning",
    });

    expect(
      wrapper.findAll(".roulette-wheel__label").map((label) => label.text()),
    ).toEqual(["Pizza", "寿司"]);
    expect(wrapper.text()).not.toContain("あとから追加");
  });

  it("結果はaria-liveのステージ結果として一度だけ表示する", () => {
    const winner = { id: "option_2", label: "寿司", order: 2 };
    const wrapper = mountStage({
      activeOptions: [{ id: "option_1", label: "Pizza", order: 1 }, winner],
      currentSpin: {
        id: "spin_1",
        options: [{ id: "option_1", label: "Pizza", order: 1 }, winner],
        winnerOptionId: "option_2",
      },
      status: "stopping",
      winnerOption: winner,
    });

    const outcome = wrapper.get("[aria-live='polite']");
    expect(outcome.text()).toContain("結果");
    expect(outcome.text()).toContain("寿司");
    expect(wrapper.text().match(/結果/g)).toHaveLength(1);
    expect(wrapper.get(".roulette-wheel__center").text()).toBe("");
  });

  it("当選位置は扇形内で安定してずらし、中央固定にしない", () => {
    const wrapper = mountStage({
      activeOptions: [
        { id: "option_1", label: "Pizza", order: 1 },
        { id: "option_2", label: "寿司", order: 2 },
        { id: "option_3", label: "掃除当番", order: 3 },
      ],
      currentSpin: {
        id: "spin_1",
        options: [
          { id: "option_1", label: "Pizza", order: 1 },
          { id: "option_2", label: "寿司", order: 2 },
          { id: "option_3", label: "掃除当番", order: 3 },
        ],
        winnerOptionId: "option_2",
      },
      status: "result",
    });

    const wheelStyle = wrapper.get(".roulette-wheel").attributes("style");
    const rotation = Number(
      wheelStyle.match(/rotate\((-?\d+(?:\.\d+)?)deg\)/)?.[1],
    );
    const selectedAngle = ((-rotation % 360) + 360) % 360;

    expect(selectedAngle).toBeGreaterThan(120 + 120 * 0.28);
    expect(selectedAngle).toBeLessThan(120 + 120 * 0.72);
    expect(selectedAngle).not.toBe(180);
  });
});
