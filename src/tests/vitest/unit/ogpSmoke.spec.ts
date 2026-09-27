import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

type RunOgpSmoke = (pageUrl: string) => Promise<{
  imageUrl: string;
  contentType: string;
  bytes: number;
}>;

const loadRunOgpSmoke = async (): Promise<RunOgpSmoke> => {
  const moduleUrl = pathToFileURL(
    resolve(__dirname, "../../../../scripts/verify-ogp-smoke.mjs"),
  ).href;
  const module = (await import(moduleUrl)) as { runOgpSmoke: RunOgpSmoke };
  return module.runOgpSmoke;
};

describe("OGP smoke script", () => {
  afterEach(() => {
    delete process.env.OGP_SMOKE_BASIC_AUTH;
    vi.unstubAllGlobals();
  });

  it("sends optional Basic auth only to the OGP page request", async () => {
    process.env.OGP_SMOKE_BASIC_AUTH = "mcre:53";
    const pageUrl =
      "https://tools-dev.mcre.info/ja/jukugo?t=%E9%95%B7&a=%E8%80%81";
    const imageUrl =
      "https://tools-ogp-dev.mcre.info/ja/jukugo?t=%E9%95%B7&a=%E8%80%81";
    const html = `
      <meta property="og:url" content="${pageUrl}">
      <meta property="og:image" content="${imageUrl}">
      <meta name="twitter:card" content="summary_large_image">
      <meta name="twitter:image" content="${imageUrl}">
    `;
    const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      if (init?.method === "HEAD") {
        return new Response(null, { status: 200 });
      }
      if (
        init?.headers &&
        "accept" in init.headers &&
        init.headers.accept === "image/*,*/*"
      ) {
        return new Response(new Uint8Array([1]), {
          status: 200,
          headers: { "content-type": "image/png" },
        });
      }
      return new Response(html, {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const runOgpSmoke = await loadRunOgpSmoke();
    await runOgpSmoke(pageUrl);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      authorization: "Basic bWNyZTo1Mw==",
    });
    expect(fetchMock.mock.calls[1][1]?.headers).not.toHaveProperty(
      "authorization",
    );
    expect(fetchMock.mock.calls[2][1]?.headers).not.toHaveProperty(
      "authorization",
    );
  });
});
