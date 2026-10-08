import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
const source = await readFile(
  new URL("../public/img/ants/icon.svg", import.meta.url),
  "utf8",
);
const browser = await chromium.launch();
try {
  for (const size of [16, 32, 64, 180]) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    await page.setContent(
      `<style>body{margin:0}svg{width:100vw;height:100vh;display:block}</style>${source}`,
    );
    await page.screenshot({
      path: new URL(`../public/img/ants/${size}.png`, import.meta.url).pathname,
      omitBackground: true,
    });
    await page.close();
  }
} finally {
  await browser.close();
}
