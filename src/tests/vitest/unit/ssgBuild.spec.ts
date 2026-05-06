import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dist = resolve(__dirname, "../../../..", "dist");
const describeWhenDistExists = existsSync(resolve(dist, "ja/index.html"))
  ? describe
  : describe.skip;

describeWhenDistExists("SSG build output", () => {
  it("localized pages, sitemap, and OGP metadata are emitted", () => {
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

  it("keeps initial build output free of eager third-party scripts and webfont assets", () => {
    const htmlFiles = [
      "index.html",
      "ja/index.html",
      "en/index.html",
      "ja/jukugo/index.html",
      "en/jukugo/index.html",
    ].map((path) => readFileSync(resolve(dist, path), "utf8"));
    const assetFiles = readdirSync(resolve(dist, "assets"));

    for (const html of htmlFiles) {
      expect(html).not.toContain("googletagmanager.com/gtag/js");
      expect(html).not.toContain("pagead2.googlesyndication.com/pagead/js");
      expect(
        html.match(/<link[^>]+rel="stylesheet"[^>]+href="\/assets\//g) ?? [],
      ).toHaveLength(1);
    }

    expect(assetFiles.some((name) => name.includes("roboto-flex"))).toBe(false);
    expect(
      assetFiles.some(
        (name) => name.startsWith("pages-") && name.endsWith(".js"),
      ),
    ).toBe(true);
    expect(
      assetFiles.some(
        (name) => name.startsWith("jukugo-") && name.endsWith(".js"),
      ),
    ).toBe(true);
  });
});
