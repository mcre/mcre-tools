const characterSegmenter = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
});

export const countCharacters = (text: string) => {
  let total = 0;
  let withoutWhitespace = 0;
  for (const { segment } of characterSegmenter.segment(
    text.replace(/\r\n?/g, "\n"),
  )) {
    total++;
    if (/\S/u.test(segment)) withoutWhitespace++;
  }
  return { total, withoutWhitespace };
};

export const countTextDetails = (text: string) => {
  const normalized = text.replace(/\r\n?/g, "\n");
  const lines = normalized ? normalized.split("\n") : [];
  let paragraphs = 0;
  let inParagraph = false;
  for (const line of lines) {
    const hasText = line.trim().length > 0;
    if (hasText && !inParagraph) paragraphs++;
    inParagraph = hasText;
  }

  // Latin-letter sequences; keep internal apostrophes and hyphens in one word.
  const words = normalized.match(
    /\p{Script=Latin}[\p{Script=Latin}\p{M}]*(?:['’-]\p{Script=Latin}[\p{Script=Latin}\p{M}]*)*/gu,
  );
  return {
    lines: lines.length,
    paragraphs,
    words: words?.length ?? 0,
    utf8Bytes: new TextEncoder().encode(normalized).length,
  };
};
