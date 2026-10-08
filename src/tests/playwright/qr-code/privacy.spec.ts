import { expect, test } from "@playwright/test";

for (const locale of ["ja", "en"]) {
  test(`QR ${locale} links to clear terms in static HTML and after hydration`, async ({
    browser,
    baseURL,
  }) => {
    for (const javaScriptEnabled of [false, true]) {
      const context = await browser.newContext({ javaScriptEnabled, baseURL });
      try {
        const page = await context.newPage();
        await page.goto(
          `/${locale}/qr-code${javaScriptEnabled ? "" : "/index.html"}`,
        );
        const guide = page.getByTestId("tool-guide");
        await guide.locator("summary").click();
        await expect(guide).toContainText("Google Analytics");
        await expect(guide).toContainText("Google AdSense");
        await expect(guide).not.toContainText("?text=");
        await guide
          .getByRole("link", {
            name: locale === "ja" ? "利用規約" : "Terms of Use",
            exact: true,
          })
          .click();
        await expect(page.locator("#termsOfUseTitle")).toBeInViewport();
        await expect(page.getByRole("main")).toContainText(
          locale === "ja" ? "第三者の権利" : "third-party rights",
        );
        await expect(page.getByRole("main")).toContainText(
          locale === "ja" ? "詐欺" : "fraud",
        );
        await expect(page.getByRole("main")).toContainText(
          locale === "ja" ? "審査・承認" : "review or endorse",
        );
        await expect(page.getByRole("main")).toContainText(
          locale === "ja"
            ? "法令上の権利を制限するものではありません"
            : "does not limit your statutory rights",
        );
        await expect(page.getByRole("main")).not.toContainText(
          locale === "ja"
            ? "一切の責任を負いません"
            : "not responsible for any damages",
        );
      } finally {
        await context.close();
      }
    }
  });
}

test("QR keeps both production scripts enabled with input absent from the URL", async ({
  page,
  request,
}) => {
  const origin = "https://tools.mcre.info";
  const scripts: string[] = [];
  // Route every request locally: no real analytics events or ad requests.
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin) {
      const response = await request.get(`${url.pathname}${url.search}`);
      await route.fulfill({ response });
    } else {
      scripts.push(url.href);
      await route.fulfill({
        contentType: "text/javascript",
        body: "window.__scriptPageUrls = [...(window.__scriptPageUrls || []), location.href];",
      });
    }
  });
  await page.clock.install();
  await page.goto(`${origin}/ja/qr-code?text=old-input`);
  await expect(page).toHaveURL(`${origin}/ja/qr-code`);
  await expect(page.getByRole("textbox")).toHaveValue("");
  await page.getByRole("textbox").fill("日本語のQRテスト😊");
  await expect(page.getByTestId("qr-image")).toBeVisible();
  await page.clock.fastForward(6000);
  await expect.poll(() => scripts.length).toBe(2);
  expect(scripts).toEqual(
    expect.arrayContaining([
      expect.stringContaining("googletagmanager.com/gtag/js"),
      expect.stringContaining(
        "pagead2.googlesyndication.com/pagead/js/adsbygoogle.js",
      ),
    ]),
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { __scriptPageUrls?: string[] }).__scriptPageUrls,
      ),
    )
    .toEqual([`${origin}/ja/qr-code`, `${origin}/ja/qr-code`]);
});
