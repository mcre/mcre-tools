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
      "llms.txt",
      "robots.txt",
      "sitemap.xml",
    ]) {
      expect(existsSync(resolve(dist, path)), path).toBe(true);
    }

    const jukugoHtml = readFileSync(
      resolve(dist, "ja/jukugo/index.html"),
      "utf8",
    );
    const indexHtml = readFileSync(resolve(dist, "ja/index.html"), "utf8");
    const llmsTxt = readFileSync(resolve(dist, "llms.txt"), "utf8");
    const robotsTxt = readFileSync(resolve(dist, "robots.txt"), "utf8");

    expect(indexHtml).toContain('rel="stylesheet"');
    expect(indexHtml).toContain(
      'rel="canonical" href="https://tools.mcre.info/ja/"',
    );
    expect(indexHtml).toContain(
      'name="description" content="便利ツールやジョークツールなど、いろいろ置いていきます。"',
    );
    expect(indexHtml).toContain(
      'property="og:url" content="https://tools.mcre.info/ja/"',
    );
    expect(indexHtml).toContain('content="https://tools.mcre.info/ja/"');
    expect(indexHtml).toContain("/img/jukugo/32.png");
    expect(indexHtml).toContain("熟語パズル");
    expect(indexHtml).toContain("利用規約");
    expect(indexHtml).toContain('type="application/ld+json"');
    expect(indexHtml).toContain('"@type":"WebSite"');

    expect(jukugoHtml).toContain(
      'rel="canonical" href="https://tools.mcre.info/ja/jukugo"',
    );
    expect(jukugoHtml).toContain('property="og:title"');
    expect(jukugoHtml).toContain('name="twitter:description"');
    expect(jukugoHtml).toContain("熟語パズル - MCRE TOOLS");
    expect(jukugoHtml).toContain("tools.mcre.info/ja/jukugo");
    expect(jukugoHtml).toContain('"@type":"WebApplication"');
    expect(jukugoHtml).toContain('"@type":"BreadcrumbList"');

    expect(llmsTxt).toContain("# MCRE TOOLS");
    expect(llmsTxt).toContain("https://tools.mcre.info/ja/jukugo");
    expect(llmsTxt).toContain("/v1/jukugo/{character}/left-search");

    expect(robotsTxt).toContain("User-agent: OAI-SearchBot");
    expect(robotsTxt).toContain("User-agent: ChatGPT-User");
    expect(robotsTxt).toContain("User-agent: GPTBot");
  });
});
