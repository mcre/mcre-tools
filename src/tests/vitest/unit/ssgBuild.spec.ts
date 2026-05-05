import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("SSG build output", () => {
  it("localized pages, sitemap, and OGP metadata are emitted", () => {
    const dist = resolve(__dirname, "../../../..", "dist");

    for (const path of [
      "ja/index.html",
      "en/index.html",
      "ja/jukugo/index.html",
      "sitemap.xml",
    ]) {
      expect(existsSync(resolve(dist, path)), path).toBe(true);
    }

    const jukugoHtml = readFileSync(
      resolve(dist, "ja/jukugo/index.html"),
      "utf8",
    );
    const indexHtml = readFileSync(resolve(dist, "ja/index.html"), "utf8");

    expect(indexHtml).toContain('rel="stylesheet"');
    expect(indexHtml).toContain("/img/jukugo/32.png");
    expect(indexHtml).toContain("熟語パズル");
    expect(indexHtml).toContain("利用規約");

    expect(jukugoHtml).toContain('property="og:title"');
    expect(jukugoHtml).toContain("熟語パズル - MCRE TOOLS");
    expect(jukugoHtml).toContain("tools.mcre.info/ja/jukugo");
  });
});
