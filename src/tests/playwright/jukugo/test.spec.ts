import { test, expect, Page } from "@playwright/test";

const positions = ["top", "left", "right", "bottom"] as const;

async function jukugoTest(
  page: Page,
  expectedAnswer: string,
  expectedNumOfAnswers: number,
  inputs: { c: string; reverse?: boolean }[],
  expectedQueryParams?: Record<string, string>,
) {
  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    const input = inputs[i];
    if (input?.c) await page.locator(`#input-${pos}`).fill(input.c);
    if (input?.reverse) await page.locator(`#arrow-${pos}`).click();
  }
  const answer = page.locator("#answer");
  const numOfAnswers = page.locator("#num-of-answers div");

  // 読込中
  await expect(answer).toHaveValue(""); // 一時的に空欄になる
  await expect(numOfAnswers).toHaveText(`候補数: -`);

  // 読み込み完了
  await expect(answer).toHaveValue(expectedAnswer);
  await expect(numOfAnswers).toHaveText(`候補数: ${expectedNumOfAnswers}`);

  if (expectedQueryParams) {
    // クエリパラメータのチェック
    const url = new URL(page.url());
    const actualParams = Object.fromEntries(url.searchParams.entries());

    expect(actualParams).toEqual(expectedQueryParams);
  }
}

test.describe.parallel("jukugo", () => {
  test("「老」", async ({ page }) => {
    await page.goto("/ja/jukugo");

    await jukugoTest(
      page,
      "老",
      3,
      [
        { c: "長" },
        { c: "海" },
        { c: "化", reverse: true },
        { c: "舗", reverse: true },
      ],
      {
        t: "長",
        l: "海",
        r: "化",
        b: "舗",
        ar: "0",
        ab: "0",
        a: "老",
      },
    );
  });

  test("「海」", async ({ page }) => {
    await page.goto("/ja/jukugo");

    await jukugoTest(
      page,
      "海",
      2,
      [
        { c: "近" },
        { c: "禁", reverse: true },
        { c: "原", reverse: true },
        { c: "運", reverse: true },
      ],
      {
        t: "近",
        l: "禁",
        r: "原",
        b: "運",
        ar: "0",
        ab: "0",
        al: "0",
        a: "海",
      },
    );
  });

  test("「×」", async ({ page }) => {
    await page.goto("/ja/jukugo");

    await jukugoTest(
      page,
      "×",
      0,
      [{ c: "近" }, { c: "禁" }, { c: "原" }, { c: "運" }],
      { t: "近", l: "禁", r: "原", b: "運", a: "×" },
    );
  });

  test("矢印ボタンの動作チェック", async ({ page }) => {
    await page.goto("/ja/jukugo");

    await jukugoTest(
      page,
      "海",
      2,
      [
        { c: "近" },
        { c: "禁", reverse: true },
        { c: "原", reverse: true },
        { c: "運", reverse: true },
      ],
      {
        t: "近",
        l: "禁",
        r: "原",
        b: "運",
        al: "0",
        ar: "0",
        ab: "0",
        a: "海",
      },
    );

    await page.locator("#arrow-top").click();

    await expect(page.locator("#answer")).toHaveValue("国");

    const url = new URL(page.url());
    const actualParams = Object.fromEntries(url.searchParams.entries());
    expect(actualParams).toEqual({
      t: "近",
      l: "禁",
      r: "原",
      b: "運",
      at: "0",
      al: "0",
      ar: "0",
      ab: "0",
      a: "国",
    });
  });

  test("「老」クエリパラメータ直接指定", async ({ page }) => {
    await page.goto(
      "/ja/jukugo?t=%E9%95%B7&r=%E5%8C%96&b=%E8%88%97&l=%E6%B5%B7&ar=0&ab=0&a=%E8%80%81",
    );
    const answer = page.locator("#answer");
    await expect(answer).toHaveValue("老");
  });

  test("「老」ID含むクエリパラメータ直接指定", async ({ page }) => {
    await page.goto(
      "/ja/jukugo?t=%E9%95%B7&r=%E5%8C%96&b=%E8%88%97&l=%E6%B5%B7&ar=0&ab=0&id=1&a=%E8%80%81",
    );
    const answer = page.locator("#answer");
    await expect(answer).toHaveValue("本");
  });

  test("「老」逐次＋リセット", async ({ page }) => {
    await page.goto("/ja/jukugo");

    await jukugoTest(page, "崎", 489, [{ c: "長" }], { t: "長", a: "崎" });
    await jukugoTest(page, "野", 150, [{ c: "長" }, { c: "海" }], {
      t: "長",
      l: "海",
      a: "野",
    });
    await jukugoTest(
      page,
      "老",
      22,
      [{ c: "長" }, { c: "海" }, { c: "化", reverse: true }],
      { t: "長", l: "海", r: "化", ar: "0", a: "老" },
    );
    await jukugoTest(
      page,
      "老",
      3,
      [
        { c: "長" },
        { c: "海" },
        { c: "化" }, // すでにreverse済みなので何もしない
        { c: "舗", reverse: true },
      ],
      { t: "長", l: "海", r: "化", b: "舗", ar: "0", ab: "0", a: "老" },
    );

    await page.locator("#button-reset button").click();
    await Promise.all(
      positions.map(async (pos) => {
        await expect(page.locator(`#input-${pos}`)).toHaveValue("");
      }),
    );
    const answer = page.locator("#answer");
    await expect(answer).toHaveValue("");
  });

  test("「老」＋ HIDE", async ({ page }) => {
    await page.goto("/ja/jukugo");
    await jukugoTest(
      page,
      "老",
      3,
      [
        { c: "長" },
        { c: "海" },
        { c: "化", reverse: true },
        { c: "舗", reverse: true },
      ],
      {
        t: "長",
        l: "海",
        r: "化",
        b: "舗",
        ar: "0",
        ab: "0",
        a: "老",
      },
    );

    // ==== hideボタンを押す ====
    await page.locator("#button-hide button").click();

    // クエリパラメータのチェック
    await page.waitForTimeout(500);
    let url = new URL(page.url());
    let actualParams = Object.fromEntries(url.searchParams.entries());
    expect(actualParams).toEqual({
      t: "長",
      l: "海",
      r: "化",
      b: "舗",
      ar: "0",
      ab: "0",
      h: "1",
    });

    // answerなどが表示されない
    await expect(page.locator("#answer")).not.toBeVisible();
    await expect(page.locator("#num-of-answers")).not.toBeVisible();
    await expect(page.locator("#list-answers")).not.toBeVisible();

    // answer-hideが表示される
    await expect(page.locator("#answer-hide")).toBeVisible();

    // ==== もう一回hideボタンを押す ====
    await page.locator("#button-hide button").click();

    // クエリパラメータのチェック
    await page.waitForTimeout(500);
    url = new URL(page.url());
    actualParams = Object.fromEntries(url.searchParams.entries());
    expect(actualParams).toEqual({
      t: "長",
      l: "海",
      r: "化",
      b: "舗",
      ar: "0",
      ab: "0",
      a: "老",
    });

    // answerなどが表示されてる
    const answer = page.locator("#answer");
    await expect(answer).toBeVisible();
    await expect(page.locator("#num-of-answers")).toBeVisible();
    await expect(page.locator("#list-answers")).toBeVisible();

    // answer-hideが表示されてない
    await expect(page.locator("#answer-hide")).not.toBeVisible();

    // answerが「老」かどうか
    await expect(answer).toHaveValue("老");
  });

  test("「老」＋リストのチェック", async ({ page }) => {
    await page.goto("/ja/jukugo");

    await jukugoTest(
      page,
      "老",
      3,
      [
        { c: "長" },
        { c: "海" },
        { c: "化", reverse: true },
        { c: "舗", reverse: true },
      ],
      {
        t: "長",
        l: "海",
        r: "化",
        b: "舗",
        ar: "0",
        ab: "0",
        a: "老",
      },
    );

    await expect(page.locator("#list-answers")).toBeVisible();
    const items = page.locator("#list-answers .v-list-item");

    // 数を確認
    await expect(items).toHaveCount(3 + 1);

    // リスト内の2個目をクリックして選択
    const selectItem = 1;
    await items.nth(selectItem + 1).click();

    // クリックの反映を確認
    await expect(page.locator("#answer")).toHaveValue("本");
    await expect(items.nth(selectItem + 1)).toHaveClass(/v-list-item--active/);

    // クエリパラメータの更新を確認
    const url = new URL(page.url());
    const actualParams = Object.fromEntries(url.searchParams.entries());
    expect(actualParams).toEqual({
      t: "長",
      l: "海",
      r: "化",
      b: "舗",
      ar: "0",
      ab: "0",
      a: "本",
      id: `${selectItem}`,
    });
  });
});
