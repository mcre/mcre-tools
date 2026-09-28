import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import jsQR from "jsqr";
import { PNG } from "pngjs";

const decode = (buffer: Buffer) => {
  const png = PNG.sync.read(buffer);
  return jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data;
};

for (const locale of ["ja", "en"]) {
  const ja = locale === "ja";
  for (const [tool, title] of [
    ["qr-code", ja ? "QRコード作成" : "QR Code Generator"],
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

test("exports a readable QR, updates it, and keeps input off the URL", async ({
  page,
}) => {
  await page.goto("/ja/qr-code");
  const input = page.getByRole("textbox", { name: "URLまたは文章" });
  const save = page.getByRole("link", { name: "PNG保存" });
  await expect(save).toHaveCount(0);
  const payload = "https://example.com/?q=日本語&value=1#test";
  await input.fill(payload);
  await expect(page.getByTestId("qr-image")).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await save.click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("qr-code.png");
  expect(decode(await readFile((await download.path())!))).toBe(payload);
  await input.fill("メモ\n👍🏽");
  await expect
    .poll(async () => {
      const source = await page.getByTestId("qr-image").getAttribute("src");
      return source
        ? decode(Buffer.from(source.split(",", 2)[1], "base64"))
        : null;
    })
    .toBe("メモ\n👍🏽");
  await expect
    .poll(() => new URL(page.url()).searchParams.has("text"))
    .toBe(false);
  await page.getByRole("button", { name: "全消去", exact: true }).click();
  await expect(page.getByTestId("qr-image")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "画像コピー", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "元に戻す", exact: true }).click();
  await expect(input).toHaveValue("メモ\n👍🏽");
  await expect(page.getByTestId("qr-image")).toBeVisible();
});

test("copies an actual PNG to the clipboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/ja/qr-code");
  await page.getByRole("textbox", { name: "URLまたは文章" }).fill("コピー確認");
  await page.getByRole("button", { name: "画像コピー", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "コピーしました", exact: true }),
  ).toBeVisible();
  const bytes = await page.evaluate(async () => {
    const item = (await navigator.clipboard.read())[0];
    return [
      ...new Uint8Array(await (await item.getType("image/png")).arrayBuffer()),
    ];
  });
  expect(decode(Buffer.from(bytes))).toBe("コピー確認");
});

test("keeps PNG saving available when clipboard permission is refused", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.clipboard, "write", {
      value: () =>
        Promise.reject(new DOMException("Denied", "NotAllowedError")),
    });
  });
  await page.goto("/en/qr-code");
  await page.getByRole("textbox", { name: "URL or text" }).fill("hello");
  await page.getByRole("button", { name: "Copy image", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Save PNG");
  await expect(page.getByRole("link", { name: "Save PNG" })).toBeVisible();
});

test("handles unsupported clipboard and QR capacity errors", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { value: undefined });
  });
  await page.goto("/ja/qr-code");
  const input = page.getByRole("textbox", { name: "URLまたは文章" });
  await input.fill("あ".repeat(4000));
  await expect(page.getByRole("alert")).toContainText("短く");
  await expect(page.getByTestId("qr-image")).toHaveCount(0);
  await input.fill("https://example.com");
  await expect(page.getByTestId("qr-image")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "画像コピー", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("PNG保存");
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`small screen in ${colorScheme} keeps tools within the viewport`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.emulateMedia({ colorScheme });
    for (const tool of ["qr-code"]) {
      await page.goto(`/en/${tool}`);
      await page.getByRole("textbox").fill("A small example 👋");
      await expect(page.locator("textarea")).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(375);
      if (tool === "qr-code") {
        await expect(page.getByTestId("qr-image")).toBeVisible();
        await expect(page.getByTestId("qr-paper")).toHaveCSS(
          "background-color",
          "rgb(255, 255, 255)",
        );
      }
    }
  });
}
