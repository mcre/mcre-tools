import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { useRoute } from "vue-router";
import XShareButton from "@/components/XShareButton.vue";
import { find } from "@/tests/vitest/helpers";

vi.mock("vue-router", () => ({
  useRoute: vi.fn(),
}));

describe("XShareButton", () => {
  it("クリック時に updateAndOpenShareUrl が呼び出され、window.open が正しく動作する", async () => {
    (useRoute as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      fullPath: "/test-path?param=value",
    });

    const w = mount(XShareButton);

    const windowOpenMock = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);

    const button = find(w, "button");
    await button.trigger("click");

    expect(windowOpenMock).toHaveBeenCalled();
    const expectedUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.origin + "/test-path?param=value")}&text=${encodeURIComponent("#McreTools\n")}`;
    expect(windowOpenMock).toHaveBeenCalledWith(expectedUrl, "_blank");

    windowOpenMock.mockRestore();
  });
});
