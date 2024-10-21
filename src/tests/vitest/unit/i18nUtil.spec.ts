import { describe, it, expect, vi } from "vitest";
import { useI18nUtil } from "@/utils/i18nUtil";
import { useI18n } from "vue-i18n";
import type { WritableComputedRef } from "vue";

// useI18nをモック
vi.mock("vue-i18n", () => ({
  useI18n: vi.fn(),
}));

describe("useI18nUtil", () => {
  it("パスにロケールが付加されるかを確認する", () => {
    const mockLocale = { value: "ja" } as WritableComputedRef<string>;
    (useI18n as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      locale: mockLocale,
    }));

    const { path } = useI18nUtil();
    expect(path("jukugo")).toBe("/ja/jukugo");
    expect(path("/jukugo")).toBe("/ja/jukugo");
    expect(path("jukugo?ab=cd&ef=gh")).toBe("/ja/jukugo?ab=cd&ef=gh");
    expect(path("/jukugo?ab=cd&ef=gh")).toBe("/ja/jukugo?ab=cd&ef=gh");
  });
});
