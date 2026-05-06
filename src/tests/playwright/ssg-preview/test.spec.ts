import type { Locator, Page } from "@playwright/test";
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

const expectShareButtonIconContained = async (button: Locator) => {
  await expect(button).toBeVisible();

  const icon = button.locator("img.share-button__icon--x");
  await expectLoadedImage(icon);

  const buttonBox = await button.boundingBox();
  const iconBox = await icon.boundingBox();
  expect(buttonBox).not.toBeNull();
  expect(iconBox).not.toBeNull();

  expect(iconBox!.x).toBeGreaterThanOrEqual(buttonBox!.x);
  expect(iconBox!.y).toBeGreaterThanOrEqual(buttonBox!.y);
  expect(iconBox!.x + iconBox!.width).toBeLessThanOrEqual(
    buttonBox!.x + buttonBox!.width,
  );
  expect(iconBox!.y + iconBox!.height).toBeLessThanOrEqual(
    buttonBox!.y + buttonBox!.height,
  );
  expect(iconBox!.width).toBeGreaterThanOrEqual(18);
  expect(iconBox!.width).toBeLessThanOrEqual(22);
  expect(iconBox!.height).toBeGreaterThanOrEqual(18);
  expect(iconBox!.height).toBeLessThanOrEqual(22);

  await expect(icon).toHaveCSS("display", "block");
  await expect(icon).toHaveCSS("object-fit", "contain");
};

const expectHeadMetadata = async (
  page: Page,
  path: string,
  canonicalUrl: string,
  schemaTypes: string[],
) => {
  await page.goto(path);

  await expect(page.locator(`head link[rel="canonical"]`)).toHaveAttribute(
    "href",
    canonicalUrl,
  );
  await expect(page.locator(`head meta[name="description"]`)).toHaveAttribute(
    "content",
    /.+/,
  );
  await expect(page.locator(`head meta[property="og:url"]`)).toHaveAttribute(
    "content",
    canonicalUrl,
  );
  await expect(
    page.locator(`head meta[name="twitter:description"]`),
  ).toHaveAttribute("content", /.+/);

  const structuredData = await page
    .locator(`head script[type="application/ld+json"]`)
    .textContent();
  expect(structuredData).not.toBeNull();
  const jsonLd = JSON.parse(structuredData!) as {
    "@graph": Array<{ "@type": string }>;
  };
  const graph = jsonLd["@graph"];
  expect(graph.map((entry: { "@type": string }) => entry["@type"])).toEqual(
    expect.arrayContaining(schemaTypes),
  );
};

const referenceLinkLabels = [
  "作者について",
  "ソースコード",
  "ライセンスに関して",
] as const;

const getReferenceLinkGaps = async (page: Page) =>
  page.evaluate((labels) => {
    const readTextRect = (container: Element, label: string) => {
      const labelElement = [
        ...container.querySelectorAll<HTMLElement>(".reference-link__label"),
      ].find((element) => element.textContent?.trim() === label);
      if (labelElement) return labelElement.getBoundingClientRect();

      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const start = node.textContent?.indexOf(label) ?? -1;
        if (start < 0) continue;

        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + label.length);
        return range.getBoundingClientRect();
      }

      throw new Error(`Reference link label was not found: ${label}`);
    };

    return Object.fromEntries(
      labels.map((label) => {
        const button = [
          ...document.querySelectorAll<HTMLElement>("a[aria-label]"),
        ].find((element) => element.getAttribute("aria-label") === label);
        const container = button?.parentElement;
        if (!button || !container) {
          throw new Error(`Reference link button was not found: ${label}`);
        }

        const buttonBox = button.getBoundingClientRect();
        const textBox = readTextRect(container, label);
        return [label, textBox.left - buttonBox.right];
      }),
    );
  }, referenceLinkLabels);

const getHeadingIconGap = async (page: Page, label: string) =>
  page.evaluate((label) => {
    const heading = [...document.querySelectorAll("h2")].find((element) =>
      element.textContent?.includes(label),
    );
    if (!heading) throw new Error(`Heading was not found: ${label}`);

    const icon = heading.querySelector(".v-icon");
    if (!icon) throw new Error(`Heading icon was not found: ${label}`);

    const labelElement = [
      ...heading.querySelectorAll<HTMLElement>(".section-heading__label"),
    ].find((element) => element.textContent?.trim() === label);
    let textBox: DOMRect;

    if (labelElement) {
      textBox = labelElement.getBoundingClientRect();
    } else {
      const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const start = node.textContent?.indexOf(label) ?? -1;
        if (start < 0) continue;

        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + label.length);
        textBox = range.getBoundingClientRect();
        const iconBox = icon.getBoundingClientRect();
        return textBox.left - iconBox.right;
      }

      throw new Error(`Heading label was not found: ${label}`);
    }

    const iconBox = icon.getBoundingClientRect();
    return textBox.left - iconBox.right;
  }, label);

const getHideAnswerButtonBox = async (page: Page) => {
  const box = await page.locator("#button-hide button").boundingBox();
  expect(box).not.toBeNull();
  return box!;
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
    await expect(
      page.locator('script[type="module"][src*="/assets/app-"]'),
    ).toHaveCount(1);
    await expect(page.locator(".v-application")).toBeVisible();
    await expect(page.locator(".v-app-bar")).toBeVisible();
    await expect(page.locator("#termsOfUseTitle")).toHaveText("利用規約");

    const toolCard = page.locator(".v-card").first();
    await expect(toolCard).toBeVisible();
    await expectInsideViewport(toolCard, 1280);
    expect((await toolCard.boundingBox())!.width).toBeGreaterThan(600);
    const toolIcon = toolCard.locator('img[src="/img/jukugo/32.png"]');
    await expectLoadedImage(toolIcon);
    await expect(toolIcon).toHaveAttribute(
      "srcset",
      /\/img\/jukugo\/32\.png(?: 1x)?, \/img\/jukugo\/64\.png 2x/,
    );

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

  test("build output keeps share button icons contained on desktop and mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/ja");
    await expectShareButtonIconContained(
      page.getByRole("button", { name: /share/i }).first(),
    );

    await page.goto("/ja/jukugo");
    await expectShareButtonIconContained(
      page.getByRole("button", { name: /share/i }).last(),
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ja");
    await expectShareButtonIconContained(
      page.getByRole("button", { name: /share/i }).first(),
    );

    await page.goto("/ja/jukugo");
    await expectShareButtonIconContained(
      page.getByRole("button", { name: /share/i }).last(),
    );
  });

  test("build output exposes AIO metadata and crawler hints", async ({
    page,
    request,
  }) => {
    await expectHeadMetadata(page, "/ja", "https://tools.mcre.info/ja/", [
      "WebSite",
    ]);
    await expectHeadMetadata(
      page,
      "/ja/jukugo",
      "https://tools.mcre.info/ja/jukugo",
      ["WebSite", "WebApplication", "BreadcrumbList"],
    );

    const llms = await request.get("/llms.txt");
    expect(llms.ok()).toBe(true);
    const llmsText = await llms.text();
    expect(llmsText).toContain("https://tools.mcre.info/ja/jukugo");

    const robots = await request.get("/robots.txt");
    expect(robots.ok()).toBe(true);
    const robotsText = await robots.text();
    expect(robotsText).toContain("User-agent: OAI-SearchBot");
    expect(robotsText).toContain("User-agent: ChatGPT-User");
    expect(robotsText).toContain("User-agent: GPTBot");
  });

  test("build output exposes accessible names for icon-only controls", async ({
    page,
  }) => {
    await page.goto("/ja");

    await expect(page.getByRole("link", { name: /MCRE TOOLS/ })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "表示言語を変更" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "作者について" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "ソースコード" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "ライセンスに関して" }),
    ).toBeVisible();

    await page.goto("/ja/jukugo");
    await expect(
      page.getByRole("button", { name: "矢印の向きを切り替える" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "答えを隠す" }),
    ).toBeVisible();
    await page.locator("#input-top").fill("長");
    await expect(
      page.getByRole("button", { name: "入力をリセット" }),
    ).toBeVisible();
  });

  test("reference link icon gaps match before and after hydration", async ({
    baseURL,
    browser,
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/ja/");
    const hydratedGaps = await getReferenceLinkGaps(page);

    const noScriptContext = await browser.newContext({
      baseURL,
      javaScriptEnabled: false,
      viewport: { width: 1280, height: 720 },
    });
    const noScriptPage = await noScriptContext.newPage();
    await noScriptPage.goto("/ja/");
    const ssgGaps = await getReferenceLinkGaps(noScriptPage);
    await noScriptContext.close();

    for (const label of referenceLinkLabels) {
      expect(hydratedGaps[label]).toBeGreaterThanOrEqual(7.5);
      expect(hydratedGaps[label]).toBeLessThanOrEqual(8.5);
      expect(
        Math.abs(hydratedGaps[label] - ssgGaps[label]),
      ).toBeLessThanOrEqual(0.5);
    }
  });

  test("reference heading icon gap matches before and after hydration", async ({
    baseURL,
    browser,
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/ja/");
    const hydratedGap = await getHeadingIconGap(page, "参考情報");

    const noScriptContext = await browser.newContext({
      baseURL,
      javaScriptEnabled: false,
      viewport: { width: 1280, height: 720 },
    });
    const noScriptPage = await noScriptContext.newPage();
    await noScriptPage.goto("/ja/");
    const ssgGap = await getHeadingIconGap(noScriptPage, "参考情報");
    await noScriptContext.close();

    expect(hydratedGap).toBeGreaterThanOrEqual(7.5);
    expect(hydratedGap).toBeLessThanOrEqual(8.5);
    expect(Math.abs(hydratedGap - ssgGap)).toBeLessThanOrEqual(0.5);
  });

  test("jukugo hide-answer button position matches before and after hydration", async ({
    baseURL,
    browser,
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ja/jukugo/");
    await expect(page.locator("#button-hide .v-fab")).toBeVisible();
    await expect(page.locator("#button-reset .v-fab")).toBeAttached();
    const hydratedBox = await getHideAnswerButtonBox(page);

    const noScriptContext = await browser.newContext({
      baseURL,
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
    const noScriptPage = await noScriptContext.newPage();
    await noScriptPage.goto("/ja/jukugo/");
    const ssgBox = await getHideAnswerButtonBox(noScriptPage);
    await noScriptContext.close();

    expect(Math.abs(hydratedBox.x - ssgBox.x)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(hydratedBox.y - ssgBox.y)).toBeLessThanOrEqual(0.5);
  });

  test("build preview exposes query-specific large OGP metadata after hydration", async ({
    page,
  }) => {
    await page.goto("/ja/jukugo?t=%E9%95%B7&a=%E8%80%81");

    await expect
      .poll(async () => {
        const currentPath = await page.evaluate(
          () => window.location.pathname + window.location.search,
        );
        const ogUrl = await page
          .locator(`head meta[property="og:url"]`)
          .getAttribute("content");
        const ogImage = await page
          .locator(`head meta[property="og:image"]`)
          .getAttribute("content");

        return (
          ogUrl === `https://tools.mcre.info${currentPath}` &&
          ogImage === `https://tools-ogp.mcre.info${currentPath}`
        );
      })
      .toBe(true);
    await expect(
      page.locator(`head meta[name="twitter:card"]`),
    ).toHaveAttribute("content", "summary_large_image");
  });
});
