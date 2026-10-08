import { expect, test } from "@playwright/test";

const cases = [
  {
    path: "/ja/character-count",
    title: "文字数カウント｜無料・登録不要 - MCRE TOOLS",
    description: /UTF-8.*無料・登録不要/,
    lead: "シンプルな文字数カウンター",
    guide: "使い方・文字数の数え方",
    answer: "空白・改行・絵文字はどう数えますか？",
  },
  {
    path: "/en/character-count",
    title: "Character Counter | Free Online Tool - MCRE TOOLS",
    description: /UTF-8.*No sign-up/,
    lead: "A simple character counter",
    guide: "How to use and count characters",
    answer: "How are spaces, line breaks, and emoji counted?",
  },
];

for (const entry of cases) {
  test(`${entry.path} has useful search metadata and help without JavaScript`, async ({
    browser,
    request,
    baseURL,
  }) => {
    const html = await (await request.get(`${entry.path}/index.html`)).text();
    expect(html).toContain(`<title>${entry.title}</title>`);
    expect(html).toContain(entry.answer);

    const context = await browser.newContext({
      javaScriptEnabled: false,
      baseURL,
    });
    try {
      const page = await context.newPage();
      await page.goto(`${entry.path}/index.html`);
      const description = page.locator('head meta[name="description"]');
      await expect(description).toHaveCount(1);
      await expect(description).toHaveAttribute("content", entry.description);
      await expect(
        page.locator('head meta[property="og:description"]'),
      ).toHaveAttribute(
        "content",
        (await description.getAttribute("content"))!,
      );
      await expect(page.getByTestId("tool-heading")).toContainText(entry.lead);
      const guide = page.getByTestId("tool-guide");
      await expect(guide).not.toHaveAttribute("open");
      await expect(guide.locator("summary")).toHaveText(entry.guide);
      await guide.locator("summary").click();
      await expect(
        guide.getByRole("heading", { name: entry.answer }),
      ).toBeVisible();
      await expect(guide).toHaveAttribute("open");
    } finally {
      await context.close();
    }
  });
}

test("search metadata follows language and tool navigation", async ({
  page,
}) => {
  await page.goto("/ja/character-count");
  await expect(page).toHaveTitle(cases[0].title);
  await page.locator("#language-switcher-button").click();
  await page.locator("#language-option-en").click();
  await expect(page).toHaveTitle(cases[1].title);
  await expect(page.locator('head meta[name="description"]')).toHaveAttribute(
    "content",
    cases[1].description,
  );
  await page.getByRole("link", { name: "MCRE TOOLS - Move to Home" }).click();
  await expect(page).toHaveTitle("MCRE TOOLS");
  await expect(page.locator('head meta[name="description"]')).toHaveAttribute(
    "content",
    "A collection of useful and fun tools.",
  );
  await page
    .getByRole("main")
    .getByRole("link", { name: /Character Count/ })
    .click();
  await expect(page).toHaveTitle(cases[1].title);
  await expect(page.locator('head meta[name="description"]')).toHaveAttribute(
    "content",
    cases[1].description,
  );
});
