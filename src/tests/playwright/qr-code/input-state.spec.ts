import { expect, test } from "@playwright/test";
import jsQR from "jsqr";
import { PNG } from "pngjs";

const decode = (buffer: Buffer) => {
  const png = PNG.sync.read(buffer);
  return jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data;
};

test("QR input stays off the URL and is discarded on reload", async ({
  page,
}) => {
  await page.goto("/ja/qr-code?ref=example");
  const input = page.getByRole("textbox", { name: "URLまたは文章" });
  const url = page.url();
  const historyLength = await page.evaluate(() => history.length);
  const payload = "https://example.com/?q=日本語&value=1#test";
  await input.fill(payload);
  await expect(page.getByTestId("qr-image")).toBeVisible();
  await expect(page).toHaveURL(url);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  await page.getByRole("button", { name: "全消去", exact: true }).click();
  await page.getByRole("button", { name: "元に戻す", exact: true }).click();
  await expect(input).toHaveValue(payload);
  await expect(page).toHaveURL(url);
  await page.locator("#language-switcher-button").click();
  await page.locator("#language-option-en").click();
  await expect(page.getByRole("textbox")).toHaveValue(payload);
  await expect(page).toHaveURL(/\/en\/qr-code\?ref=example$/);
  await page.reload();
  await expect(page.getByRole("textbox")).toHaveValue("");
  await expect(page.getByTestId("qr-image")).toHaveCount(0);
});

for (const locale of ["ja", "en"]) {
  test(`QR ${locale} discards the old input query without restoring the input`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/qr-code?ref=example&text=old-input`);
    await expect(page).toHaveURL(
      new RegExp(String.raw`/${locale}/qr-code\?ref=example$`),
    );
    await expect(page.getByRole("textbox")).toHaveValue("");
    await expect(page.getByTestId("qr-image")).toHaveCount(0);
  });
}

test("a normal URL remains readable in the small-screen preview", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/ja/qr-code");
  const payload = "https://example.com/?q=日本語&value=1#test";
  await page.getByRole("textbox").fill(payload);
  const image = page.getByTestId("qr-image");
  await expect(image).toBeVisible();
  expect(decode(await image.screenshot())).toBe(payload);
  expect(
    await image.evaluate(
      (element) => (element as HTMLImageElement).naturalWidth,
    ),
  ).toBe(1024);
});
