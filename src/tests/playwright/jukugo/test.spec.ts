import { test, expect, Page } from "@playwright/test";

const positions = ["top", "left", "right", "bottom"] as const;

async function jukugoTest(
  page: Page,
  expectedAnswer: string,
  inputs: { c: string; reverse?: boolean }[],
) {
  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    const input = inputs[i];
    if (input?.c) await page.locator(`#input-${pos}`).fill(input.c);
    if (input?.reverse) await page.locator(`#arrow-${pos}`).click();
  }
  const answer = page.locator("#answer");
  await expect(answer).toHaveValue(expectedAnswer);
}

test.describe.parallel("並列テスト", () => {
  test("「老」", async ({ page }) => {
    await page.goto("/jukugo");
    await page.waitForLoadState("networkidle");

    await jukugoTest(page, "老", [
      { c: "長" },
      { c: "海" },
      { c: "化", reverse: true },
      { c: "舗", reverse: true },
    ]);
  });

  test("「海」", async ({ page }) => {
    await page.goto("/jukugo");
    await page.waitForLoadState("networkidle");

    await jukugoTest(page, "海", [
      { c: "近" },
      { c: "禁", reverse: true },
      { c: "原", reverse: true },
      { c: "運", reverse: true },
    ]);
  });

  test("「老」逐次＋リセット", async ({ page }) => {
    await page.goto("/jukugo");
    await page.waitForLoadState("networkidle");

    await jukugoTest(page, "崎", [{ c: "長" }]);
    await jukugoTest(page, "野", [{ c: "長" }, { c: "海" }]);
    await jukugoTest(page, "老", [
      { c: "長" },
      { c: "海" },
      { c: "化", reverse: true },
    ]);
    await jukugoTest(page, "老", [
      { c: "長" },
      { c: "海" },
      { c: "化" }, // すでにreverse済みなので何もしない
      { c: "舗", reverse: true },
    ]);
  });
});
