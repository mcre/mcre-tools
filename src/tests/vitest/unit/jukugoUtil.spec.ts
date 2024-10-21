import { describe, it, expect, vi } from "vitest";
import { useJukugoUtil } from "@/utils/jukugoUtil";

vi.mock("@unhead/vue", () => ({
  useHead: vi.fn(),
}));

describe("useJukugoUtil", () => {
  const { isKanji } = useJukugoUtil();

  describe("isKanji", () => {
    it("何も入力していない場合はfalse", () => {
      expect(isKanji("")).toBe(false);
    });

    it("1文字の漢字はtrue", () => {
      expect(isKanji("漢")).toBe(true);
      expect(isKanji("字")).toBe(true);
      expect(isKanji("検")).toBe(true);
      expect(isKanji("鬱")).toBe(true);
    });

    it("2文字以上の漢字はfalse", () => {
      expect(isKanji("漢字")).toBe(false);
      expect(isKanji("対象")).toBe(false);
      expect(isKanji("人間")).toBe(false);
    });

    it("漢字以外はfalse", () => {
      expect(isKanji("あ")).toBe(false);
      expect(isKanji("1")).toBe(false);
      expect(isKanji("🌛")).toBe(false);
    });

    it("文字型以外はfalse", () => {
      expect(isKanji(123)).toBe(false);
      expect(isKanji(null)).toBe(false);
      expect(isKanji(undefined)).toBe(false);
    });
  });
});
