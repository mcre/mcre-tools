import type { Locator } from "@playwright/test";
import { expect, test } from "@playwright/test";

const expectInsideViewport = async (
  locator: Locator,
  viewportWidth: number,
) => {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth);
};

const expectLoadedImage = async (locator: Locator) => {
  await expect(locator).toBeVisible();
  const loaded = await locator.evaluate((element) => {
    const image = element as HTMLImageElement;
    return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
  });
  expect(loaded).toBe(true);
};

test.describe("SSG preview layout", () => {
  test("build output keeps home CSS, cards, and images on desktop", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/ja");

    await expect(
      page.locator('link[rel="stylesheet"][href*="/assets/"]'),
    ).toHaveCount(1);
    await expect(page.locator(".v-application")).toBeVisible();
    await expect(page.locator(".v-app-bar")).toBeVisible();
    await expect(page.locator("#termsOfUseTitle")).toHaveText("利用規約");

    const toolCard = page.locator(".v-card").first();
    await expect(toolCard).toBeVisible();
    await expectInsideViewport(toolCard, 1280);
    expect((await toolCard.boundingBox())!.width).toBeGreaterThan(600);
    await expectLoadedImage(toolCard.locator('img[src="/img/jukugo/32.png"]'));

    const creator = await page.getByText("作者について").boundingBox();
    const source = await page.getByText("ソースコード").boundingBox();
    const license = await page.getByText("ライセンスに関して").boundingBox();
    expect(creator).not.toBeNull();
    expect(source).not.toBeNull();
    expect(license).not.toBeNull();
    expect(Math.abs(creator!.y - source!.y)).toBeLessThan(12);
    expect(Math.abs(source!.y - license!.y)).toBeLessThan(12);
  });

  test("build output keeps mobile layout inside the viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ja");

    const toolCard = page.locator(".v-card").first();
    await expect(toolCard).toBeVisible();
    await expectInsideViewport(toolCard, 390);

    const creator = await page.getByText("作者について").boundingBox();
    const source = await page.getByText("ソースコード").boundingBox();
    const license = await page.getByText("ライセンスに関して").boundingBox();
    expect(creator).not.toBeNull();
    expect(source).not.toBeNull();
    expect(license).not.toBeNull();
    expect(source!.y).toBeGreaterThan(creator!.y);
    expect(license!.y).toBeGreaterThan(source!.y);
  });

  test("build output keeps jukugo board content and icon renderable", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/ja/jukugo");

    await expect(page.locator("h1")).toHaveText("熟語パズル");
    await expectLoadedImage(
      page.locator('img[src="/img/jukugo/32.png"]').first(),
    );
    await expect(page.locator("#input-top")).toBeVisible();
    await expect(page.locator("#input-left")).toBeVisible();
    await expect(page.locator("#answer")).toBeVisible();
    await expectInsideViewport(page.locator("table"), 1280);
  });
});
