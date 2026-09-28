import { expect, test } from "@playwright/test";

for (const locale of ["ja", "en"]) {
  test(`character clipboard in ${locale} copies all text and pastes at the selection`, async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`/${locale}/character-count`);
    const input = page.getByRole("textbox");
    const copy = page.getByRole("button", {
      name: locale === "ja" ? "全文をコピー" : "Copy all text",
      exact: true,
    });
    const paste = page.getByRole("button", {
      name: locale === "ja" ? "貼り付け" : "Paste",
      exact: true,
    });
    await expect(copy).toBeDisabled();
    await expect(paste).toBeEnabled();
    await input.fill("前あA😊後");
    await copy.click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "前あA😊後",
    );
    await expect(page.getByRole("status")).toContainText(
      locale === "ja" ? "コピーしました" : "Copied",
    );
    await page.evaluate(() => navigator.clipboard.writeText("日本語👋"));
    await input.evaluate((element) => {
      const textarea = element as HTMLTextAreaElement;
      textarea.focus();
      textarea.setSelectionRange(1, 5);
    });
    await paste.click();
    await expect(input).toHaveValue("前日本語👋後");
    await expect(input).toBeFocused();
    await expect(page.getByTestId("total-count")).toHaveText("6");
    await expect(page.getByRole("status")).toContainText(
      locale === "ja" ? "貼り付けました" : "Pasted",
    );
    await page.evaluate(() => navigator.clipboard.writeText("!"));
    await paste.click();
    await expect(input).toHaveValue("前日本語👋!後");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(375);
  });
}

for (const failure of ["denied", "unsupported"]) {
  test(`character clipboard ${failure} keeps the draft and explains manual fallback`, async ({
    page,
  }) => {
    await page.addInitScript((mode) => {
      Object.defineProperty(navigator, "clipboard", {
        value:
          mode === "unsupported"
            ? undefined
            : {
                readText: () =>
                  Promise.reject(new DOMException("Denied", "NotAllowedError")),
                writeText: () =>
                  Promise.reject(new DOMException("Denied", "NotAllowedError")),
              },
      });
    }, failure);
    await page.goto("/ja/character-count");
    const input = page.getByRole("textbox");
    await input.fill("残しておく文章");
    await page
      .getByRole("button", { name: "全文をコピー", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "文章を選択してコピー",
    );
    await page.getByRole("button", { name: "貼り付け", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("入力欄のメニュー");
    await expect(input).toHaveValue("残しておく文章");
    await expect(input).toBeFocused();
    await input.fill("引き続き編集できます");
    await expect(page.getByRole("status")).toBeEmpty();
  });
}

test("a delayed clipboard read does not overwrite newer edits", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        readText: () =>
          new Promise<string>((resolve) => {
            window.addEventListener(
              "resolve-clipboard",
              () => resolve("古い値"),
              {
                once: true,
              },
            );
          }),
      },
    });
  });
  await page.goto("/ja/character-count");
  const input = page.getByRole("textbox");
  await input.fill("初期値");
  await page.getByRole("button", { name: "貼り付け", exact: true }).click();
  await input.fill("新しい編集");
  await page.evaluate(() =>
    window.dispatchEvent(new Event("resolve-clipboard")),
  );
  await expect(input).toHaveValue("新しい編集");
  await expect(page.getByRole("status")).toBeEmpty();
});
