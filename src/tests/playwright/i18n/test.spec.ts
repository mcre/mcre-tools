import { test, expect } from "@playwright/test";

test.describe("i18n", () => {
  test("日本語のページが表示される", async ({ page }) => {
    await page.goto("/ja");
    await expect(page.locator("#termsOfUseTitle")).toHaveText("利用規約");
  });

  test("英語のページが表示される", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("#termsOfUseTitle")).toHaveText("Terms of Use");
  });

  test("日本語から英語に切り替えできる", async ({ page }) => {
    await page.goto("/ja/jukugo");
    await expect(page.locator("h1")).toHaveText("熟語パズル");
    await page.click("#language-switcher-button");
    await page.click("#language-option-en");
    await expect(page).toHaveURL("/en/jukugo");
    await expect(page.locator("h1")).toHaveText("Jukugo Puzzle");
  });

  test("英語から日本語に切り替えできる", async ({ page }) => {
    await page.goto("/en/jukugo");
    await expect(page.locator("h1")).toHaveText("Jukugo Puzzle");
    await page.click("#language-switcher-button");
    await page.click("#language-option-ja");
    await expect(page).toHaveURL("/ja/jukugo");
    await expect(page.locator("h1")).toHaveText("熟語パズル");
  });

  test("言語指定なしURLの場合日本語にリダイレクトされる", async ({ page }) => {
    await page.goto("/jukugo");
    await expect(page).toHaveURL("/ja/jukugo");
    await expect(page.locator("h1")).toHaveText("熟語パズル");

    await page.goto(
      "/jukugo?t=%E9%95%B7&r=%E5%8C%96&b=%E8%88%97&l=%E6%B5%B7&ar=0&ab=0&a=%E8%80%81",
    );
    await expect(page).toHaveURL(
      "/ja/jukugo?t=%E9%95%B7&r=%E5%8C%96&b=%E8%88%97&l=%E6%B5%B7&ar=0&ab=0&a=%E8%80%81",
    );
    await expect(page.locator("h1")).toHaveText("熟語パズル");

    await page.goto("/");
    await expect(page).toHaveURL("/ja");
    await expect(page.locator("#termsOfUseTitle")).toHaveText("利用規約");
  });
});
