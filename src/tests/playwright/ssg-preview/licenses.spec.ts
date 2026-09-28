import { readdir, readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("the distribution includes full license texts and QR source notices", async ({
  request,
}) => {
  const response = await request.get("/licenses.txt");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/plain");
  const licenses = await response.text();
  for (const path of [
    "node_modules/qrcode/license",
    "node_modules/dijkstrajs/LICENSE.md",
    "LICENSE",
  ]) {
    expect(licenses).toContain((await readFile(path, "utf8")).trim());
  }
  expect(licenses).toContain("Copyright (c) 2009 Kazuhiko Arase");
  expect(licenses).toContain("Copyright (c) 2011 Ryan Day");
  expect(licenses).toContain("## qrcode - 1.5.4 (MIT)");
  expect(licenses).toContain("## dijkstrajs - 1.0.3 (MIT)");
  expect(licenses).toContain(
    "TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION",
  );
  expect(licenses).toContain("END OF TERMS AND CONDITIONS");
  // The test-only QR decoder and PNG reader must not enter the client bundle.
  expect(licenses).not.toMatch(/^## (jsqr|pngjs) - /m);
  const qrChunk = (await readdir("dist/assets")).find(
    (name) => name.startsWith("qr-code-") && name.endsWith(".js"),
  );
  expect(qrChunk).toBeDefined();
  expect(await readFile(`dist/assets/${qrChunk}`, "utf8")).toContain(
    "Third-party licenses: /licenses.txt",
  );
});

for (const locale of ["ja", "en"]) {
  test(`${locale} static home links to the distributed licenses`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:4173/${locale}/index.html`);
      const link = page.getByRole("link", {
        name: locale === "ja" ? "ライセンスに関して" : "Licenses",
        exact: true,
      });
      await expect(link).toHaveAttribute("href", "/licenses.txt");
    } finally {
      await context.close();
    }
  });
}
