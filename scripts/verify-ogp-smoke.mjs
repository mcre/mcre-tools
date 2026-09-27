#!/usr/bin/env node
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BOT_USER_AGENT = "Twitterbot/1.0";
const TIMEOUT_MS = Number(process.env.OGP_SMOKE_TIMEOUT_MS ?? "15000");

class OgpSmokeError extends Error {
  constructor(message) {
    super(message);
    this.name = "OgpSmokeError";
  }
}

function ensure(condition, message) {
  if (!condition) {
    throw new OgpSmokeError(message);
  }
}

function readAttributes(tag) {
  const attributes = {};
  for (const match of tag.matchAll(/\s([^\s=]+)=("([^"]*)"|'([^']*)')/g)) {
    attributes[match[1].toLowerCase()] = match[3] ?? match[4] ?? "";
  }
  return attributes;
}

export function extractMetaContent(html, attrName, attrValue) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const attributes = readAttributes(tag);
    if (attributes[attrName] === attrValue) {
      return attributes.content;
    }
  }
  return undefined;
}

export function validateOgpHtml(html, pageUrl) {
  const ogUrl = extractMetaContent(html, "property", "og:url");
  const imageUrl = extractMetaContent(html, "property", "og:image");
  const twitterCard = extractMetaContent(html, "name", "twitter:card");
  const twitterImage = extractMetaContent(html, "name", "twitter:image");

  ensure(ogUrl === pageUrl, `unexpected og:url: ${ogUrl ?? "(missing)"}`);
  ensure(imageUrl, "missing og:image");
  ensure(
    twitterCard === "summary_large_image",
    `unexpected twitter:card: ${twitterCard ?? "(missing)"}`,
  );
  ensure(
    twitterImage === imageUrl,
    `twitter:image does not match og:image: ${twitterImage ?? "(missing)"}`,
  );

  return {
    imageUrl,
    ogUrl,
  };
}

function fetchWithTimeout(url, init = {}) {
  const { headers = {}, ...rest } = init;
  return fetch(url, {
    redirect: "follow",
    ...rest,
    headers: {
      "user-agent": BOT_USER_AGENT,
      accept: "*/*",
      ...headers,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

export async function runOgpSmoke(pageUrl) {
  const pageResponse = await fetchWithTimeout(pageUrl, {
    headers: {
      accept: "text/html,*/*",
    },
  });
  ensure(
    pageResponse.ok,
    `OGP page request failed: ${pageResponse.status} ${pageResponse.statusText}`,
  );

  const html = await pageResponse.text();
  const { imageUrl } = validateOgpHtml(html, pageUrl);

  const headResponse = await fetchWithTimeout(imageUrl, {
    method: "HEAD",
    headers: {
      accept: "image/*,*/*",
    },
  });
  ensure(
    headResponse.status >= 200 && headResponse.status < 400,
    `OGP image HEAD failed: ${headResponse.status} ${headResponse.statusText}`,
  );

  const imageResponse = await fetchWithTimeout(imageUrl, {
    method: "GET",
    headers: {
      accept: "image/*,*/*",
    },
  });
  ensure(
    imageResponse.ok,
    `OGP image GET failed: ${imageResponse.status} ${imageResponse.statusText}`,
  );

  const contentType = imageResponse.headers.get("content-type") ?? "";
  ensure(
    contentType.toLowerCase().startsWith("image/"),
    `OGP image content-type is not image/*: ${contentType || "(missing)"}`,
  );

  const imageBytes = await imageResponse.arrayBuffer();
  ensure(imageBytes.byteLength > 0, "OGP image response body is empty");

  return {
    imageUrl,
    contentType,
    bytes: imageBytes.byteLength,
  };
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const pageUrl = process.argv[2] ?? process.env.OGP_SMOKE_URL;
  if (!pageUrl) {
    console.error("Usage: node scripts/verify-ogp-smoke.mjs <page-url>");
    process.exit(2);
  }

  try {
    const result = await runOgpSmoke(pageUrl);
    console.log(`OGP smoke passed: ${pageUrl}`);
    console.log(`og:image: ${result.imageUrl}`);
    console.log(`image: ${result.contentType}, ${result.bytes} bytes`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
