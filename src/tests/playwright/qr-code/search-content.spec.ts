import { expect, test } from "@playwright/test";

const cases = [
  {
    path: "/ja/qr-code",
    title: "QRコード作成｜無料・PNG保存 - MCRE TOOLS",
    description: /無料.*1024px.*PNG/,
    lead: "シンプルなQRコード生成ツール",
    guide: "使い方・保存について",
    answer: "画像のサイズや誤り訂正は変更できますか？",
  },
  {
    path: "/en/qr-code",
    title: "QR Code Generator | Free PNG Download - MCRE TOOLS",
    description: /free.*1024px PNG/,
    lead: "A simple QR code generator",
    guide: "How to create and save a QR code",
    answer: "Can I change the image size or error correction?",
  },
];

for (const entry of cases) {
  test(`${entry.path} has useful search metadata and help without JavaScript`, async ({
    browser,
    request,
  }) => {
    const html = await (await request.get(`${entry.path}/index.html`)).text();
    expect(html).toContain(`<title>${entry.title}</title>`);
    expect(html).toContain(entry.answer);

    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:4173${entry.path}/index.html`);
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
