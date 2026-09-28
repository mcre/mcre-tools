import jsQR from "jsqr";
import { PNG } from "pngjs";
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { generateQrCode } from "@/utils/qrCode";

describe("QR image generation", () => {
  it.each([
    "https://example.com/path?q=日本語&value=1#section",
    "  メモ\n👨‍👩‍👧‍👦 & <hello>  ",
  ])("creates a PNG that decodes to the unmodified input", async (text) => {
    const image = await generateQrCode(text);
    const png = PNG.sync.read(Buffer.from(image.split(",", 2)[1], "base64"));
    expect(png.width).toBeGreaterThanOrEqual(800);
    expect(png.width).toBe(png.height);
    expect([...png.data.subarray(0, 4)]).toEqual([255, 255, 255, 255]);
    const decoded = jsQR(
      new Uint8ClampedArray(png.data),
      png.width,
      png.height,
    );
    expect(decoded?.data).toBe(text);
  });

  it("rejects content that exceeds QR capacity", async () => {
    await expect(generateQrCode("あ".repeat(4000))).rejects.toThrow();
  });

  it.each(["x".repeat(2331), "1".repeat(5596), "あ".repeat(770)])(
    "keeps dense codes readable at the full PNG resolution (%#)",
    async (text) => {
      const image = await generateQrCode(text);
      const png = PNG.sync.read(Buffer.from(image.split(",", 2)[1], "base64"));
      expect(png.width).toBe(1024);
      expect(png.height).toBe(1024);
      const decoded = jsQR(
        new Uint8ClampedArray(png.data),
        png.width,
        png.height,
      );
      expect(decoded?.data).toBe(text);
      expect(decoded?.version).toBe(40);
      // Even version 40 leaves at least 5 pixels per module and a white margin.
      const margin = Math.floor((1024 * 4) / (177 + 8));
      for (let y = 0; y < png.height; y++) {
        for (let x = 0; x < png.width; x++) {
          if (
            x < margin ||
            y < margin ||
            x >= 1024 - margin ||
            y >= 1024 - margin
          ) {
            const offset = (y * png.width + x) * 4;
            if (png.data[offset] !== 255 || png.data[offset + 3] !== 255) {
              throw new Error("QR quiet zone is not opaque white");
            }
          }
        }
      }
    },
  );
});
