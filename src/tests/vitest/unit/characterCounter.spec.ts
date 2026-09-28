import { describe, expect, it } from "vitest";
import { countCharacters, countTextDetails } from "@/utils/characterCounter";

describe("character counting", () => {
  it.each([
    ["", 0, 0],
    ["あいう ABC\n", 8, 6],
    ["A\r\nB\rC", 5, 3],
    [" \t\n　\u00A0", 5, 0],
    ["👨‍👩‍👧‍👦👍🏽🇯🇵か\u3099e\u0301", 5, 5],
  ])("counts visible characters in %j", (text, total, withoutWhitespace) => {
    expect(countCharacters(text)).toEqual({ total, withoutWhitespace });
  });
});

describe("additional text counts", () => {
  it("returns zero for an empty input", () => {
    expect(countTextDetails("")).toEqual({
      lines: 0,
      paragraphs: 0,
      words: 0,
      utf8Bytes: 0,
    });
  });

  it("counts blank lines but only nonempty paragraphs", () => {
    expect(countTextDetails("a \n\nあ")).toEqual({
      lines: 3,
      paragraphs: 2,
      words: 1,
      utf8Bytes: 7,
    });
    expect(countTextDetails(" \t\n　\n")).toEqual({
      lines: 3,
      paragraphs: 0,
      words: 0,
      utf8Bytes: 7,
    });
    expect(countTextDetails("第一行\n第二行\n \t\n次の段落\n")).toMatchObject({
      lines: 5,
      paragraphs: 2,
      words: 0,
    });
  });

  it("normalizes CRLF and CR as a single LF for lines and UTF-8 bytes", () => {
    expect(countTextDetails("A\r\nB\rC")).toEqual({
      lines: 3,
      paragraphs: 1,
      words: 3,
      utf8Bytes: 5,
    });
  });

  it("counts Latin words including contractions, hyphens and accents", () => {
    expect(
      countTextDetails(
        "Hello, don't stop. It’s well-known. café nai\u0308ve ＡＢＣ 日本語123 😊",
      ).words,
    ).toBe(8);
    expect(countTextDetails("123 あいう 😊").words).toBe(0);
  });

  it("keeps byte size distinct from visible character count", () => {
    const text = "Aあ😊👨‍👩‍👧‍👦";
    expect(countCharacters(text).total).toBe(4);
    expect(countTextDetails(text).utf8Bytes).toBe(33);
    expect(countTextDetails("e\u0301").utf8Bytes).toBe(3);
  });
});
