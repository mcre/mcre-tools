import type { JukugoSearchResponse } from "@/apis/@types";
import { describe, expect, it, vi } from "vitest";
import { createJukugoSolver } from "@/composables/useJukugoSolver";

describe("createJukugoSolver", () => {
  it("入力ごとのAPI結果をキャッシュし、共通候補を合計cost順で返す", async () => {
    const calls: string[] = [];
    const responses: Record<string, JukugoSearchResponse> = {
      "長-true": [
        { character: "老", cost: 3 },
        { character: "海", cost: 1 },
      ],
      "海-true": [
        { character: "老", cost: 2 },
        { character: "山", cost: 1 },
      ],
    };
    const search = vi.fn(async (character: string, rightSearch: boolean) => {
      const key = `${character}-${rightSearch}`;
      calls.push(key);
      return responses[key] ?? [];
    });

    const solver = createJukugoSolver(search);
    const first = await solver.solve({
      arrows: { bottom: true, left: true, right: true, top: true },
      inputs: { bottom: "", left: "海", right: "", top: "長" },
    });
    const second = await solver.solve({
      arrows: { bottom: true, left: true, right: true, top: true },
      inputs: { bottom: "", left: "海", right: "", top: "長" },
    });

    expect(first.answers).toEqual([
      {
        character: "老",
        cost: 5,
        costs: { left: 2, top: 3 },
      },
    ]);
    expect(second.answers).toEqual(first.answers);
    expect(calls).toEqual(["長-true", "海-true"]);
  });

  it("queryを公開URL形式に変換し、履歴を増やさない更新だけを要求する", () => {
    const solver = createJukugoSolver(async () => []);

    expect(
      solver.toQuery({
        answers: [{ character: "老", cost: 1, costs: { top: 1 } }],
        arrows: { bottom: false, left: true, right: false, top: true },
        hideAnswer: false,
        inputs: { bottom: "舗", left: "", right: "化", top: "長" },
        loading: false,
        selectedAnswerId: 0,
      }),
    ).toEqual({
      a: "老",
      ab: "0",
      ar: "0",
      b: "舗",
      r: "化",
      t: "長",
    });
  });
});
