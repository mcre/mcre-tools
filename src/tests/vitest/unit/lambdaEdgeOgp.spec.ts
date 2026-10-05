import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

type CloudFrontRequest = {
  uri: string;
  querystring: string;
  headers: {
    "user-agent": Array<{ key: string; value: string }>;
    authorization?: Array<{ key: string; value: string }>;
  };
};

type EdgeLocales = Record<
  string,
  {
    localeName: string;
    common: { title: string };
    tools: Record<string, { title: string; description: string }>;
  }
>;

const locales = {
  ja: {
    localeName: "ja_JP",
    common: {
      title: "MCRE Tools",
    },
    tools: {
      jukugo: {
        title: "熟語パズル",
        description: "漢字一文字を入れて熟語を完成させるパズル",
      },
    },
  },
  en: {
    localeName: "en_US",
    common: {
      title: "MCRE Tools",
    },
    tools: {
      jukugo: {
        title: "Jukugo Puzzle",
        description: "A kanji compound word puzzle",
      },
    },
  },
};

const loadHandler = (
  options: {
    noindex?: boolean;
    messages?: EdgeLocales;
  } = {},
) => {
  const template = readFileSync(
    resolve(
      __dirname,
      "../../../../backend/cdk/resource-files/lambda-edge/response-to-bot-with-directory-index/index.js",
    ),
    "utf8",
  );
  const source = template
    .replace("@{LOCALES}", JSON.stringify(options.messages ?? locales))
    .replaceAll("@{DOMAIN_NAME_DIST}", "tools.mcre.info")
    .replaceAll("@{DOMAIN_NAME_OGP}", "tools-ogp.mcre.info")
    .replace("@{NOINDEX}", String(options.noindex ?? false));
  const sandbox = {
    exports: {} as {
      handler?: (event: unknown) => Promise<any>;
    },
    console: {
      log: vi.fn(),
    },
  };

  vm.runInNewContext(source, sandbox);

  return sandbox.exports.handler!;
};

const createEvent = (request: CloudFrontRequest) => ({
  Records: [
    {
      cf: {
        request,
      },
    },
  ],
});

const createRequest = (
  overrides: Partial<CloudFrontRequest> = {},
): CloudFrontRequest => ({
  uri: "/ja/jukugo",
  querystring: "t=%E9%95%B7&a=%E8%80%81",
  headers: {
    "user-agent": [{ key: "User-Agent", value: "Twitterbot/1.0" }],
  },
  ...overrides,
});

const metaContent = (
  html: string,
  attrName: "name" | "property",
  attrValue: string,
) => {
  const tag = html.match(
    new RegExp(String.raw`<meta\s+[^>]*${attrName}="${attrValue}"[^>]*>`, "i"),
  )?.[0];

  expect(tag, `${attrName}=${attrValue}`).toBeDefined();
  return tag?.match(/\bcontent="([^"]*)"/i)?.[1];
};

describe("Lambda@Edge OGP response", () => {
  it.each(["ja", "en"])(
    "preserves every %s tool response with only the OGP metadata embedded",
    async (lang) => {
      const full: EdgeLocales = Object.fromEntries(
        ["ja", "en"].map((locale) => [
          locale,
          JSON.parse(
            readFileSync(
              resolve(__dirname, `../../../locales/${locale}.json`),
              "utf8",
            ),
          ),
        ]),
      );
      const reduced: EdgeLocales = Object.fromEntries(
        Object.entries(full).map(([locale, data]) => [
          locale,
          {
            localeName: data.localeName,
            common: { title: data.common.title },
            tools: Object.fromEntries(
              Object.entries(data.tools).map(([tool, messages]) => [
                tool,
                { title: messages.title, description: messages.description },
              ]),
            ),
          },
        ]),
      );
      for (const noindex of [false, true]) {
        const before = loadHandler({ messages: full, noindex });
        const after = loadHandler({ messages: reduced, noindex });
        for (const tool of Object.keys(full[lang]!.tools)) {
          const request = createRequest({
            uri: `/${lang}/${tool}`,
            querystring: "t=%E9%95%B7&a=%E8%80%81",
          });
          const original = await before(createEvent(structuredClone(request)));
          const result = await after(createEvent(structuredClone(request)));
          expect(result).toEqual(original);
          expect(metaContent(result.body, "property", "og:title")).toBe(
            `${full[lang]!.tools[tool]!.title} - ${full[lang]!.common.title}`,
          );
          expect(metaContent(result.body, "property", "og:description")).toBe(
            full[lang]!.tools[tool]!.description,
          );
        }
        for (const request of [
          createRequest({ uri: `/${lang}/jukugo/`, querystring: "" }),
          createRequest({
            uri: `/${lang}/jukugo`,
            headers: {
              "user-agent": [{ key: "User-Agent", value: "Mozilla/5.0" }],
            },
          }),
          createRequest({ uri: "/unknown-language/jukugo" }),
          createRequest({ uri: `/${lang}/unknown-tool` }),
          createRequest({ uri: "/assets/app.js" }),
          createRequest({
            uri: `/${lang}/jukugo`,
            headers: {
              "user-agent": [{ key: "User-Agent", value: "Discordbot" }],
            },
          }),
        ]) {
          expect(await after(createEvent(structuredClone(request)))).toEqual(
            await before(createEvent(structuredClone(request))),
          );
        }
      }
    },
  );

  it("returns query-specific OGP HTML for bot access", async () => {
    const handler = loadHandler();
    const response = await handler(createEvent(createRequest()));
    const expectedPageUrl =
      "https://tools.mcre.info/ja/jukugo?t=%E9%95%B7&a=%E8%80%81";
    const expectedImageUrl =
      "https://tools-ogp.mcre.info/ja/jukugo?t=%E9%95%B7&a=%E8%80%81";

    expect(response.status).toBe("200");
    expect(response.headers["content-type"][0].value).toBe("text/html");
    expect(response.body).toContain('<html lang="ja">');
    expect(metaContent(response.body, "property", "og:url")).toBe(
      expectedPageUrl,
    );
    expect(metaContent(response.body, "property", "og:image")).toBe(
      expectedImageUrl,
    );
    expect(metaContent(response.body, "name", "twitter:card")).toBe(
      "summary_large_image",
    );
    expect(metaContent(response.body, "name", "twitter:image")).toBe(
      expectedImageUrl,
    );
  });

  it("uses localized metadata for localized bot URLs", async () => {
    const handler = loadHandler();
    const response = await handler(
      createEvent(
        createRequest({
          uri: "/en/jukugo",
          querystring: "t=long&a=old",
        }),
      ),
    );

    expect(response.status).toBe("200");
    expect(response.body).toContain('<html lang="en">');
    expect(metaContent(response.body, "property", "og:locale")).toBe("en_US");
    expect(metaContent(response.body, "property", "og:title")).toBe(
      "Jukugo Puzzle - MCRE Tools",
    );
  });

  it("passes non-bot requests through directory index routing", async () => {
    const handler = loadHandler();
    const response = await handler(
      createEvent(
        createRequest({
          headers: {
            "user-agent": [{ key: "User-Agent", value: "Mozilla/5.0" }],
          },
        }),
      ),
    );

    expect(response.status).toBeUndefined();
    expect(response.uri).toBe("/ja/jukugo/index.html");
  });

  it("does not emit query-specific OGP HTML without query state", async () => {
    const handler = loadHandler();
    const response = await handler(
      createEvent(
        createRequest({
          querystring: "",
        }),
      ),
    );

    expect(response.status).toBeUndefined();
    expect(response.uri).toBe("/ja/jukugo/index.html");
  });

  it("allows dev requests without authorization", async () => {
    const handler = loadHandler({ noindex: true });
    const response = await handler(
      createEvent(
        createRequest({
          headers: {
            "user-agent": [{ key: "User-Agent", value: "Mozilla/5.0" }],
          },
        }),
      ),
    );

    expect(response.status).toBeUndefined();
    expect(response.uri).toBe("/ja/jukugo/index.html");
  });

  it("marks dev bot responses noindex without authorization", async () => {
    const handler = loadHandler({ noindex: true });
    const response = await handler(
      createEvent(
        createRequest({
          headers: {
            "user-agent": [{ key: "User-Agent", value: "Twitterbot/1.0" }],
          },
        }),
      ),
    );

    expect(response.status).toBe("200");
    expect(response.headers["x-robots-tag"][0].value).toBe("noindex, nofollow");
    expect(metaContent(response.body, "name", "robots")).toBe(
      "noindex, nofollow",
    );
    expect(metaContent(response.body, "property", "og:url")).toBe(
      "https://tools.mcre.info/ja/jukugo?t=%E9%95%B7&a=%E8%80%81",
    );
  });
});
