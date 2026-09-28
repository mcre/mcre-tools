import { afterEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import { useQrCode } from "@/composables/useQrCode";

const generate = vi.hoisted(() => vi.fn());
vi.mock("@/utils/qrCode", () => ({ generateQrCode: generate }));

describe("QR preview state", () => {
  afterEach(() => vi.resetAllMocks());

  it("never exposes an old QR after the input has changed or been cleared", async () => {
    let resolveFirst!: (image: string) => void;
    generate.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    generate.mockResolvedValueOnce("data:image/png;base64,new");
    const scope = effectScope();
    const text = ref("");
    const qr = scope.run(() => useQrCode(text))!;
    text.value = "first";
    await nextTick();
    text.value = "second";
    expect(qr.image.value).toBe("");
    await nextTick();
    await nextTick();
    expect(qr.image.value).toBe("data:image/png;base64,new");
    resolveFirst("data:image/png;base64,old");
    await nextTick();
    expect(qr.image.value).toBe("data:image/png;base64,new");
    text.value = "";
    expect(qr.image.value).toBe("");
    scope.stop();
  });

  it("recovers from over-capacity input without retaining a stale preview", async () => {
    generate.mockRejectedValueOnce(new Error("capacity"));
    generate.mockResolvedValueOnce("data:image/png;base64,ok");
    const scope = effectScope();
    const text = ref("");
    const qr = scope.run(() => useQrCode(text))!;
    text.value = "too long";
    await nextTick();
    await nextTick();
    expect(qr.error.value).toBe(true);
    expect(qr.image.value).toBe("");
    text.value = "short";
    await nextTick();
    await nextTick();
    expect(qr.error.value).toBe(false);
    expect(qr.image.value).toBe("data:image/png;base64,ok");
    scope.stop();
  });
});
