import { expect, test } from "@playwright/test";

const description = "音を鳴らすかわりに、画面の色が変わるメトロノームです。";
const storageKey = "mcre-tools.color-metronome.settings.v1";

test.describe("color metronome first visit", () => {
  for (const locale of ["ja", "en"]) {
    test(`autoplays once in ${locale}, then stays stopped on return`, async ({
      page,
    }) => {
      const ja = locale === "ja";
      const start = page.getByRole("button", {
        name: ja ? "開始" : "Start",
        exact: true,
      });
      const stop = page.getByRole("button", {
        name: ja ? "停止" : "Stop",
        exact: true,
      });
      await page.clock.install();
      await page.clock.pauseAt(new Date());
      await page.goto(`/${locale}`);
      await page
        .getByRole("main")
        .getByRole("link", { name: ja ? /色メトロノーム/ : /Color Metronome/ })
        .click();
      // Vuetify's navigation guard runs on the next timer turn.
      await page.clock.runFor(1);
      await expect(stop).toBeVisible();
      await expect(
        page.getByRole("spinbutton", { name: "BPM", exact: true }),
      ).toHaveValue("90");
      await expect(
        page.getByLabel(ja ? "1小節の拍数" : "Beats per measure", {
          exact: true,
        }),
      ).toHaveValue("2");
      const display = page.getByTestId("color-display");
      await expect(display).toHaveCSS("background-color", "rgb(255, 255, 255)");
      await page.clock.runFor(667);
      await expect(display).toHaveCSS("background-color", "rgb(64, 64, 64)");
      await stop.click();
      await page.clock.runFor(3000);
      await expect(display).toHaveCSS("background-color", "rgb(64, 64, 64)");
      await page.clock.resume();
      await page.reload();
      await expect(start).toBeVisible();
      await start.click();
      await page.locator("#language-switcher-button").click();
      await page.locator(`#language-option-${ja ? "en" : "ja"}`).click();
      await expect(
        page.getByRole("button", { name: ja ? "Start" : "開始", exact: true }),
      ).toBeVisible();
      await page.goto(`/${locale}`);
      await page
        .getByRole("main")
        .getByRole("link", { name: ja ? /色メトロノーム/ : /Color Metronome/ })
        .click();
      await expect(start).toBeVisible();
    });
  }

  test("does not autoplay when first opened in a hidden tab or when it becomes visible", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: true,
      });
    });
    await page.goto("/ja/color-metronome");
    const start = page.getByRole("button", { name: "開始", exact: true });
    await expect(start).toBeVisible();
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: false,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(start).toBeVisible();
  });
});

test.describe("color metronome", () => {
  // These checks cover returning visitors with previously saved settings.
  test.use({
    storageState: async ({ baseURL }, use) => {
      await use({
        cookies: [],
        origins: [
          {
            origin: baseURL!,
            localStorage: [
              {
                name: storageKey,
                value: JSON.stringify({ bpm: 90, beats: 2, subdivision: 1 }),
              },
            ],
          },
        ],
      });
    },
  });

  test("switches directly between colors without dimming or fading, including fullscreen", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Element.prototype.requestFullscreen = () =>
        Promise.reject(new Error("unsupported"));
    });
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.goto("/ja/color-metronome");
    const bpm = page.getByRole("spinbutton", { name: "BPM", exact: true });
    await bpm.fill("120");
    await bpm.press("Enter");
    await page.getByLabel("1小節の拍数").selectOption("3");
    await page.getByRole("button", { name: "開始", exact: true }).click();
    const display = page.getByTestId("color-display");
    const shade = page.getByTestId("color-shade");
    for (const color of [
      "rgb(255, 255, 255)",
      "rgb(64, 64, 64)",
      "rgb(255, 99, 71)",
    ]) {
      const state = () =>
        display.evaluate((element) => ({
          color: getComputedStyle(element).backgroundColor,
          opacity: getComputedStyle(element.firstElementChild!).opacity,
        }));
      expect(await state()).toEqual({ color, opacity: "0" });
      await page.clock.runFor(80);
      expect(await state()).toEqual({ color, opacity: "0" });
      await expect(display).toHaveCSS("transition-duration", "0s");
      await expect(display).toHaveCSS("animation-name", "none");
      await expect(shade).toHaveCSS("transition-duration", "0s");
      await expect(shade).toHaveCSS("animation-name", "none");
      if (color === "rgb(255, 255, 255)") {
        await page.getByRole("button", { name: "全画面", exact: true }).click();
        await expect(page.getByTestId("metronome-stage")).toHaveAttribute(
          "data-expanded",
          "true",
        );
      }
      await page.clock.runFor(420);
    }
  });

  test("darkens white and dark gray subdivisions once and holds each level without API calls", async ({
    page,
  }) => {
    const requests: string[] = [];
    await page.route("**/v1/**", (route) => {
      requests.push(route.request().url());
      return route.abort();
    });
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.goto("/ja/color-metronome");
    await expect(
      page.getByTestId("tool-heading").getByText(description, { exact: true }),
    ).toBeVisible();
    const bpm = page.getByRole("spinbutton", { name: "BPM", exact: true });
    await bpm.fill("120");
    await bpm.press("Enter");
    await page.getByLabel("1拍の分割", { exact: true }).selectOption("4");
    await page.getByRole("button", { name: "開始", exact: true }).click();
    const display = page.getByTestId("color-display");
    const shade = page.getByTestId("color-shade");
    await expect(display).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(shade).toHaveCSS("opacity", "0");
    for (const opacity of ["0", "0.15", "0.3", "0.45"]) {
      await expect(shade).toHaveCSS("opacity", opacity);
      await expect(display).toHaveCSS("background-color", "rgb(255, 255, 255)");
      await page.clock.runFor(124);
      await expect(shade).toHaveCSS("opacity", opacity);
      await page.clock.runFor(1);
    }
    await expect(display).toHaveCSS("background-color", "rgb(64, 64, 64)");
    await expect(shade).toHaveCSS("opacity", "0");
    await expect(shade).toHaveCSS("background-color", "rgb(0, 0, 0)");
    await page.clock.runFor(125);
    await expect(shade).toHaveCSS("opacity", "0.15");
    await page.clock.runFor(124);
    await expect(shade).toHaveCSS("opacity", "0.15");
    await page.getByRole("button", { name: "停止", exact: true }).click();
    await page.clock.runFor(3000);
    await expect(display).toHaveCSS("background-color", "rgb(64, 64, 64)");
    await expect(shade).toHaveCSS("opacity", "0");
    await page.getByRole("button", { name: "開始", exact: true }).click();
    await expect(display).toHaveCSS("background-color", "rgb(255, 255, 255)");
    expect(requests).toEqual([]);
  });

  test("starts with two beats, offers nine distinct colors and one-click tempo presets", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/ja/color-metronome");
    await expect(page.getByLabel("1小節の拍数")).toHaveValue("2");
    await expect(page.locator('input[type="color"]')).toHaveCount(2);
    await page.getByLabel("1小節の拍数").selectOption("9");
    const colors = await page
      .locator('input[type="color"]')
      .evaluateAll((inputs) =>
        inputs.map((input) => (input as HTMLInputElement).value),
      );
    expect(colors).toHaveLength(9);
    expect(new Set(colors).size).toBe(9);
    const presets = page.getByRole("group", { name: "BPMの選択", exact: true });
    await expect(presets.getByRole("button")).toHaveText([
      "60",
      "80",
      "90",
      "100",
      "120",
      "140",
      "160",
      "180",
    ]);
    const bpm = page.getByRole("spinbutton", { name: "BPM", exact: true });
    await expect(
      presets.getByRole("button", { name: "90 BPM", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    for (const tempo of [60, 80, 90, 100, 120, 140, 160, 180]) {
      const button = presets.getByRole("button", {
        name: `${tempo} BPM`,
        exact: true,
      });
      await button.click();
      await expect(bpm).toHaveValue(String(tempo));
      await expect(button).toHaveAttribute("aria-pressed", "true");
      const bounds = (await button.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(375);
    }
    await page.reload();
    await expect(bpm).toHaveValue("180");
    await page.goto("/en/color-metronome");
    await page
      .getByRole("group", { name: "BPM presets", exact: true })
      .getByRole("button", { name: "120 BPM", exact: true })
      .click();
    await expect(bpm).toHaveValue("120");
    await page
      .getByRole("button", { name: "Increase BPM by 1", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "120 BPM", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  test("resets saved settings and playback in both languages without clearing other storage", async ({
    page,
  }) => {
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    for (const locale of ["ja", "en"]) {
      const ja = locale === "ja";
      await page.goto(`/${locale}/color-metronome`);
      await page.evaluate(() => localStorage.setItem("another-tool", "keep"));
      const beats = page.getByLabel(ja ? "1小節の拍数" : "Beats per measure", {
        exact: true,
      });
      const subdivision = page.getByLabel(
        ja ? "1拍の分割" : "Beat subdivision",
        { exact: true },
      );
      await beats.selectOption("9");
      await page
        .getByLabel(ja ? "1拍目の色" : "Beat 1 color", { exact: true })
        .fill("#000000");
      await page
        .getByLabel(ja ? "9拍目の色" : "Beat 9 color", { exact: true })
        .fill("#123456");
      await beats.selectOption("2");
      await subdivision.selectOption("4");
      await page.getByRole("button", { name: "120 BPM", exact: true }).click();
      await page
        .getByRole("button", { name: ja ? "開始" : "Start", exact: true })
        .click();
      await page.clock.runFor(750);
      await page
        .getByRole("button", {
          name: ja ? "設定をリセット" : "Reset settings",
          exact: true,
        })
        .click();
      const bpm = page.getByRole("spinbutton", { name: "BPM", exact: true });
      await expect(bpm).toHaveValue("90");
      await expect(beats).toHaveValue("2");
      await expect(subdivision).toHaveValue("1");
      await expect(
        page.getByRole("button", { name: ja ? "開始" : "Start", exact: true }),
      ).toBeVisible();
      await page.clock.runFor(3000);
      await expect(page.getByTestId("color-display")).toHaveCSS(
        "background-color",
        "rgb(255, 255, 255)",
      );
      await expect(page.getByTestId("color-shade")).toHaveCSS("opacity", "0");
      expect(
        await page.evaluate((key) => localStorage.getItem(key), storageKey),
      ).toBeNull();
      expect(
        await page.evaluate(() => localStorage.getItem("another-tool")),
      ).toBe("keep");
      await page.reload();
      await expect(bpm).toHaveValue("90");
      await expect(beats).toHaveValue("2");
      await expect(subdivision).toHaveValue("1");
      await page
        .getByRole("button", { name: ja ? "停止" : "Stop", exact: true })
        .click();
      await beats.selectOption("9");
      await expect(
        page.getByLabel(ja ? "1拍目の色" : "Beat 1 color", { exact: true }),
      ).toHaveValue("#ffffff");
      await expect(
        page.getByLabel(ja ? "9拍目の色" : "Beat 9 color", { exact: true }),
      ).toHaveValue("#8b6f47");
    }
  });

  test("edits settings, preserves hidden colors and restores across languages", async ({
    page,
  }) => {
    await page.goto("/ja/color-metronome");
    const bpm = page.getByRole("spinbutton", { name: "BPM", exact: true });
    await bpm.fill("123");
    await bpm.press("Tab");
    await page.getByLabel("1小節の拍数").selectOption("4");
    await page.getByLabel("1拍の分割", { exact: true }).selectOption("3");
    await page.getByLabel("4拍目の色", { exact: true }).fill("#123456");
    await page.getByLabel("1小節の拍数").selectOption("2");
    await page.getByRole("button", { name: "開始", exact: true }).click();
    await page.reload();
    await expect(bpm).toHaveValue("123");
    await expect(
      page.getByRole("button", { name: "開始", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("1小節の拍数")).toHaveValue("2");
    await expect(page.getByLabel("1拍の分割", { exact: true })).toHaveValue(
      "3",
    );
    await page.getByLabel("1小節の拍数").selectOption("4");
    await expect(page.getByLabel("4拍目の色", { exact: true })).toHaveValue(
      "#123456",
    );
    await page.getByRole("button", { name: "開始", exact: true }).click();
    await page.locator("#language-switcher-button").click();
    await page.locator("#language-option-en").click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Color Metronome",
    );
    await expect(
      page.getByRole("button", { name: "Start", exact: true }),
    ).toBeVisible();
    await expect(bpm).toHaveValue("123");
    await expect(page.getByLabel("Beat 4 color", { exact: true })).toHaveValue(
      "#123456",
    );
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await page.getByRole("link", { name: "MCRE TOOLS - Move to Home" }).click();
    await page
      .getByRole("main")
      .getByRole("link", { name: /Color Metronome/ })
      .click();
    await expect(
      page.getByRole("button", { name: "Start", exact: true }),
    ).toBeVisible();
  });

  test("supports tap tempo, step buttons and invalid BPM drafts", async ({
    page,
  }) => {
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.goto("/ja/color-metronome");
    const bpm = page.getByRole("spinbutton", { name: "BPM", exact: true });
    const tap = page.getByRole("button", { name: "タップ", exact: true });
    await tap.click();
    await page.clock.runFor(500);
    await tap.click();
    await expect(bpm).toHaveValue("120");
    await page.getByRole("button", { name: "BPMを1増やす" }).click();
    await expect(bpm).toHaveValue("121");
    await page.getByRole("button", { name: "BPMを1減らす" }).click();
    await expect(bpm).toHaveValue("120");
    await bpm.fill("");
    await bpm.press("Tab");
    await expect(bpm).toHaveValue("120");
    await bpm.fill("999");
    await bpm.press("Enter");
    await expect(bpm).toHaveValue("250");
  });

  test("uses native fullscreen without changing playback", async ({ page }) => {
    await page.goto("/ja/color-metronome");
    await page.getByRole("button", { name: "開始", exact: true }).click();
    await page.getByRole("button", { name: "全画面", exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
      .toBe(true);
    await page
      .getByRole("button", { name: "全画面を解除", exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
      .toBe(false);
    await expect(
      page.getByRole("button", { name: "停止", exact: true }),
    ).toBeVisible();
  });

  test("falls back on fullscreen rejection, hides controls and exits with Escape", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Element.prototype.requestFullscreen = () =>
        Promise.reject(new Error("unsupported"));
    });
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.goto("/ja/color-metronome");
    await page.getByRole("button", { name: "開始", exact: true }).click();
    await page.getByRole("button", { name: "全画面", exact: true }).click();
    const display = page.getByTestId("color-display");
    await expect(page.getByTestId("metronome-stage")).toHaveAttribute(
      "data-expanded",
      "true",
    );
    expect((await display.boundingBox())!.height).toBe(
      page.viewportSize()!.height,
    );
    await page.clock.runFor(2100);
    await expect(
      page.getByRole("button", { name: "停止", exact: true }),
    ).toBeHidden();
    await display.click({ position: { x: 30, y: 30 } });
    await expect(
      page.getByRole("button", { name: "停止", exact: true }),
    ).toBeVisible();
    const stop = page.getByRole("button", { name: "停止", exact: true });
    await stop.focus();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "全画面を解除", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(stop).toBeFocused();
    await page.clock.runFor(2100);
    await expect(stop).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("metronome-stage")).toHaveAttribute(
      "data-expanded",
      "false",
    );
    await expect(
      page.getByRole("button", { name: "停止", exact: true }),
    ).toBeVisible();
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  });

  test("stops when the document is hidden and does not resume automatically", async ({
    page,
  }) => {
    await page.goto("/ja/color-metronome");
    await page.getByRole("button", { name: "開始", exact: true }).click();
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(
      page.getByRole("button", { name: "開始", exact: true }),
    ).toBeVisible();
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: false,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(
      page.getByRole("button", { name: "開始", exact: true }),
    ).toBeVisible();
  });

  test("survives corrupt and unavailable storage", async ({ page }) => {
    await page.addInitScript(
      (key) => localStorage.setItem(key, "not JSON"),
      storageKey,
    );
    await page.goto("/ja/color-metronome");
    await expect(
      page.getByRole("spinbutton", { name: "BPM", exact: true }),
    ).toHaveValue("90");
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("blocked");
        },
      });
    });
    await page.reload();
    await page.getByRole("button", { name: "BPMを1増やす" }).click();
    await expect(
      page.getByRole("spinbutton", { name: "BPM", exact: true }),
    ).toHaveValue("91");
    await page.getByRole("button", { name: "開始", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "停止", exact: true }),
    ).toBeVisible();
  });

  test("preserves the shared heading, localized SSG and mobile layout", async ({
    page,
    request,
  }) => {
    for (const [locale, title] of [
      ["ja", "色メトロノーム"],
      ["en", "Color Metronome"],
    ] as const) {
      const response = await request.get(
        `/${locale}/color-metronome/index.html`,
      );
      expect(response.ok()).toBe(true);
      const html = await response.text();
      expect(html).toContain(title);
      expect(html).toContain(
        `https://tools.mcre.info/${locale}/color-metronome`,
      );
      expect(html).toContain(
        locale === "ja"
          ? description
          : "A metronome that changes the screen color instead of making a sound.",
      );
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`/${locale}`);
      await page
        .getByRole("main")
        .getByRole("link", { name: new RegExp(title) })
        .click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await expect(
        page.getByRole("button", {
          name: locale === "ja" ? "開始" : "Start",
          exact: true,
        }),
      ).toBeInViewport();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(375);
      await expect(
        page.getByTestId("tool-heading").locator("img"),
      ).toHaveAttribute("width", "32");
      await page.goto(`/${locale}/jukugo`);
      await expect(
        page.getByTestId("tool-heading").locator("img"),
      ).toHaveAttribute("width", "32");
      await expect(
        page.getByTestId("tool-heading").locator(".text-caption"),
      ).toBeVisible();
    }
  });
});
