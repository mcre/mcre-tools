import { expect, test } from "@playwright/test";

for (const locale of ["ja", "en"]) {
  const ja = locale === "ja";
  for (const [tool, title] of [
    ["character-count", ja ? "文字数カウント" : "Character Count"],
  ]) {
    test(`${locale}/${tool} has a home link, localized SSG and language navigation`, async ({
      page,
      request,
    }) => {
      const html = await (
        await request.get(`/${locale}/${tool}/index.html`)
      ).text();
      expect(html).toContain(`<h1>${title}</h1>`);
      expect(html).toContain(`https://tools.mcre.info/${locale}/${tool}`);
      expect(await (await request.get("/sitemap.xml")).text()).toContain(
        `/${locale}/${tool}`,
      );
      await page.goto(`/${locale}`);
      await page
        .getByRole("main")
        .getByRole("link", { name: new RegExp(title) })
        .click();
      await expect(page.locator("h1")).toHaveText(title);
      await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
        "href",
        `https://tools.mcre.info/${locale}/${tool}`,
      );
      await page.locator("#language-switcher-button").click();
      await page.locator(`#language-option-${ja ? "en" : "ja"}`).click();
      await expect(page).toHaveURL(new RegExp(`/${ja ? "en" : "ja"}/${tool}$`));
    });
  }
}

test("counts whole text and selected graphemes, and restores a cleared draft", async ({
  page,
}) => {
  await page.goto("/ja/character-count");
  const input = page.getByRole("textbox", { name: "文章" });
  await input.fill("あいう ABC\n👨‍👩‍👧‍👦");
  await expect(page.getByTestId("total-count")).toHaveText("9");
  await expect(page.getByTestId("compact-count")).toHaveText("7");
  await input.evaluate((element) => {
    const textarea = element as HTMLTextAreaElement;
    textarea.setSelectionRange(8, textarea.value.length);
    textarea.dispatchEvent(new Event("select"));
  });
  await expect(page.getByTestId("selection-count")).toHaveText("1");
  await expect(page.getByTestId("total-count")).toHaveText("9");
  await page.getByRole("button", { name: "全消去", exact: true }).click();
  await expect(input).toHaveValue("");
  await expect(page.getByTestId("total-count")).toHaveText("0");
  await page.getByRole("button", { name: "元に戻す", exact: true }).click();
  await expect(input).toHaveValue("あいう ABC\n👨‍👩‍👧‍👦");
  await page.reload();
  await expect(input).toHaveValue("");
});

test("keeps native Japanese composition and caret position", async ({
  page,
}) => {
  await page.goto("/ja/character-count");
  const input = page.getByRole("textbox", { name: "文章" });
  await input.fill("前後");
  await input.evaluate((element) => {
    const textarea = element as HTMLTextAreaElement;
    textarea.setSelectionRange(1, 1);
    textarea.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true }),
    );
    textarea.setRangeText("か", 1, 1, "end");
    textarea.dispatchEvent(
      new InputEvent("input", { bubbles: true, isComposing: true }),
    );
    textarea.setRangeText("漢字", 1, 2, "end");
    textarea.dispatchEvent(
      new CompositionEvent("compositionend", { bubbles: true, data: "漢字" }),
    );
    textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
  });
  await expect(input).toHaveValue("前漢字後");
  await expect(page.getByTestId("total-count")).toHaveText("4");
  expect(
    await input.evaluate(
      (element) => (element as HTMLTextAreaElement).selectionStart,
    ),
  ).toBe(3);
});

for (const locale of ["ja", "en"]) {
  test(`optional character details in ${locale} start closed and update with the text`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`/${locale}/character-count`);
    const input = page.getByRole("textbox");
    const details = page.getByTestId("text-details");
    const summary = details.locator("summary");
    await expect(summary).toHaveText(
      locale === "ja" ? "詳しいカウント" : "More counts",
    );
    expect(
      await details.evaluate((element) => (element as HTMLDetailsElement).open),
    ).toBe(false);
    await expect(page.getByTestId("utf8-count")).not.toBeVisible();
    await expect(page.getByTestId("counting-note")).toContainText("A");
    await expect(page.getByTestId("counting-note")).toContainText("あ");
    await expect(page.getByTestId("counting-note")).toContainText("😊");
    await input.fill("あA😊\n\nHello world");
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("line-count")).toHaveText("3");
    await expect(page.getByTestId("paragraph-count")).toHaveText("2");
    await expect(page.getByTestId("word-count")).toHaveText("3");
    await expect(page.getByTestId("utf8-count")).toHaveText("21");
    await input.fill("Aあ😊👨‍👩‍👧‍👦");
    await expect(page.getByTestId("total-count")).toHaveText("4");
    await expect(page.getByTestId("utf8-count")).toHaveText("33");
    await page
      .getByRole("button", {
        name: locale === "ja" ? "全消去" : "Clear all",
        exact: true,
      })
      .click();
    await expect(page.getByTestId("line-count")).toHaveText("0");
    await expect(page.getByTestId("paragraph-count")).toHaveText("0");
    await expect(page.getByTestId("utf8-count")).toHaveText("0");
    await page
      .getByRole("button", {
        name: locale === "ja" ? "元に戻す" : "Undo",
        exact: true,
      })
      .click();
    await expect(page.getByTestId("utf8-count")).toHaveText("33");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(375);
    await summary.click();
    await expect(page.getByTestId("utf8-count")).not.toBeVisible();
  });
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`small screen in ${colorScheme} keeps the counter within the viewport`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.emulateMedia({ colorScheme });
    await page.goto("/en/character-count");
    await page.getByRole("textbox").fill("A small example 👋");
    await expect(page.locator("textarea")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(375);
  });
}
