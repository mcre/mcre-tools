import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const canvas = (page: Page) => page.getByTestId("ants-canvas");
const ground = async (page: Page) =>
  Number(
    (await page.getByTestId("ants-ground").textContent())!.replaceAll(",", ""),
  );
const tick = async (page: Page) =>
  Number(await canvas(page).getAttribute("data-tick"));
const slide = async (slider: Locator, value: number) => {
  const minimum = Number(await slider.getAttribute("min"));
  const step = Number(await slider.getAttribute("step"));
  await slider.focus();
  if (value === Number(await slider.getAttribute("max"))) {
    await slider.press("End");
    await expect(slider).toHaveValue(String(value));
    return;
  }
  await slider.press("Home");
  for (let i = 0; i < (value - minimum) / step; i++)
    await slider.press("ArrowRight");
  await expect(slider).toHaveValue(String(value));
};
const edit = async (
  page: Page,
  x: number,
  y: number,
  to?: [number, number],
) => {
  await canvas(page).scrollIntoViewIfNeeded();
  const box = (await canvas(page).boundingBox())!;
  await page.mouse.move(
    box.x + (x / 240) * box.width,
    box.y + (y / 160) * box.height,
  );
  await page.mouse.down();
  if (to)
    await page.mouse.move(
      box.x + (to[0] / 240) * box.width,
      box.y + (to[1] / 160) * box.height,
    );
  await page.mouse.up();
};
const pixel = (page: Page, x: number, y: number) =>
  canvas(page).evaluate(
    (element, p) => {
      const c = element as HTMLCanvasElement;
      return Array.from(
        c
          .getContext("2d")!
          .getImageData(
            Math.floor((p.x / 240) * c.width),
            Math.floor((p.y / 160) * c.height),
            1,
            1,
          ).data,
      ).slice(0, 3);
    },
    { x, y },
  );

test.describe("Ant Observation", () => {
  test.use({ reducedMotion: "reduce" });
  test("SSG, localized controls, pheromone explanation, metadata and icons", async ({
    page,
    request,
  }) => {
    for (const [locale, title, size, resume, explanation] of [
      ["ja", "アリ観察", "編集サイズ", "再開", "餌へのフェロモン"],
      ["en", "Ant Observation", "Brush size", "Resume", "Food pheromone"],
    ]) {
      const response = await request.get(`/${locale}/ants/index.html`);
      expect(response.ok()).toBe(true);
      const html = await response.text();
      expect(html).toContain(title);
      expect(html).toContain(`https://tools.mcre.info/${locale}/ants`);
      expect(html).toContain("WebApplication");
      expect(html).toContain("/img/ants/180.png");
      expect(html).toContain(
        locale === "ja" ? "近くの餌のにおい" : "nearby food odors",
      );
      expect(html).toContain(locale === "ja" ? "リセット" : "Reset");
      expect(html).toContain(
        locale === "ja" ? "巣へのフェロモン" : "Home pheromone",
      );
      expect(html).not.toMatch(
        /この配置で最初から|デモへ戻す|Restart this layout|Reset to demo/,
      );
      expect(html).not.toMatch(
        /自動保存|ファイルへ保存|cloud saving|IndexedDB/,
      );
      await page.goto(`/${locale}`);
      await page
        .getByRole("main")
        .getByRole("link", { name: new RegExp(title) })
        .click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await expect(
        page.getByRole("button", { name: resume, exact: true }),
      ).toBeEnabled();
      await expect(page.getByLabel(size, { exact: true })).toHaveValue("11");
      await expect(page.getByText(explanation, { exact: true })).toBeVisible();
      await expect(canvas(page)).toBeVisible();
      for (const value of [16, 32, 64, 180])
        expect((await request.get(`/img/ants/${value}.png`)).ok()).toBe(true);
    }
  });
  test("compact canvas, separate controls, sliders and a collapsible explanation", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/ja/ants");
    const size = page.getByRole("slider", { name: "編集サイズ", exact: true });
    await expect(size).toBeEnabled();
    await expect(size).toHaveAttribute("min", "3");
    await expect(size).toHaveAttribute("max", "31");
    await expect(size).toHaveAttribute("step", "2");
    await expect(page.getByRole("combobox")).toHaveCount(0);
    const box = (await canvas(page).boundingBox())!;
    expect(box.y).toBeLessThan(250);
    expect(box.y + box.height).toBeLessThan(760);
    const playback = (await page.getByTestId("ants-playback").boundingBox())!;
    const editing = (await page.getByTestId("ants-editing").boundingBox())!;
    expect(playback.y + playback.height).toBeLessThanOrEqual(box.y);
    expect(editing.y).toBeGreaterThanOrEqual(box.y + box.height);
    await expect(
      page.getByText("餌へのフェロモン", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("巣へのフェロモン", { exact: true }),
    ).toBeVisible();
    const details = page.getByTestId("ants-explanation");
    await expect(details).not.toHaveAttribute("open");
    await expect(
      page.getByText("探索中のアリ", { exact: true }),
    ).not.toBeVisible();
    await details.locator("summary").click();
    await expect(page.getByText("探索中のアリ", { exact: true })).toBeVisible();
    await expect(
      page.getByText(/探索中は近くの餌のにおいにも反応します/),
    ).toBeVisible();
  });
  test("expanded view preserves playback and edits, contains focus and closes with Escape", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/ja/ants");
    await expect(
      page.getByRole("button", { name: "再開", exact: true }),
    ).toBeEnabled();
    const initialBox = (await canvas(page).boundingBox())!;
    const initialGround = await ground(page);
    await page.getByRole("button", { name: "拡大表示", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "アリ観察", exact: true });
    await expect(dialog).toBeVisible();
    await expect
      .poll(async () => (await canvas(page).boundingBox())!.width)
      .toBeGreaterThan(initialBox.width);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe(
      "hidden",
    );
    await edit(page, 20.5, 20.5);
    expect(await ground(page)).toBe(initialGround + 8100);
    await page.getByRole("button", { name: "再開", exact: true }).click();
    await expect.poll(() => tick(page)).toBeGreaterThan(0);
    await page.getByRole("button", { name: "一時停止", exact: true }).click();
    const paused = await tick(page);
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      expect(
        await dialog.evaluate((element) =>
          element.contains(document.activeElement),
        ),
      ).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "拡大表示", exact: true }),
    ).toBeFocused();
    expect(await ground(page)).toBe(initialGround + 8100);
    expect(await tick(page)).toBe(paused);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
    await page.getByRole("button", { name: "拡大表示", exact: true }).click();
    await page
      .getByRole("button", { name: "拡大を閉じる", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
  test("readout names its quantities, groups thousands and shows food and ant units", async ({
    page,
  }) => {
    for (const [locale, labels, foodUnit, antUnit] of [
      [
        "ja",
        ["経過時間", "残りの餌", "運搬中のアリ", "巣に運んだ餌"],
        "個",
        "匹",
      ],
      [
        "en",
        [
          "Elapsed time",
          "Food remaining",
          "Ants carrying food",
          "Food delivered",
        ],
        "items",
        "ants",
      ],
    ] as const) {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/${locale}/ants`);
      const readout = page.getByTestId("ants-readout");
      await expect(readout.locator("dt")).toHaveText([...labels]);
      await expect(page.getByTestId("ants-elapsed")).toHaveText("00:00");
      await expect(page.getByTestId("ants-ground")).toHaveText("5,220");
      await expect(page.getByTestId("ants-ground").locator("..")).toHaveText(
        new RegExp(String.raw`5,220\s*${foodUnit}`),
      );
      await expect(page.getByTestId("ants-carrying").locator("..")).toHaveText(
        new RegExp(String.raw`0\s*${antUnit}`),
      );
      await expect(page.getByTestId("ants-delivered").locator("..")).toHaveText(
        new RegExp(String.raw`0\s*${foodUnit}`),
      );
      const wide = await readout
        .locator("dt")
        .evaluateAll((items) =>
          items.map((item) => item.getBoundingClientRect().top),
        );
      expect(new Set(wide).size).toBe(1);
      await page.setViewportSize({ width: 375, height: 812 });
      const narrow = await readout
        .locator("dt")
        .evaluateAll((items) =>
          items.map((item) => item.getBoundingClientRect().top),
        );
      expect(narrow[0]).toBe(narrow[1]);
      expect(narrow[2]).toBe(narrow[3]);
      expect(narrow[2]).toBeGreaterThan(narrow[0]!);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(375);
    }
  });
  test("maximum speed advances about 64 model seconds in two seconds", async ({
    page,
  }) => {
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.goto("/ja/ants");
    const slider = page.getByRole("slider", { name: "再生速度", exact: true });
    await expect(slider).toHaveAttribute("max", "32");
    await slide(slider, 32);
    await page.getByRole("button", { name: "再開", exact: true }).click();
    await page.clock.runFor(2000);
    await page.getByRole("button", { name: "一時停止", exact: true }).click();
    expect(await tick(page)).toBeGreaterThan(1800);
    expect(await tick(page)).toBeLessThanOrEqual(1920);
    await expect(page.getByTestId("ants-elapsed")).toHaveText(/^01:0[0-4]$/);
  });
  test("explains the implemented algorithm in the SSG content and disclosure", async ({
    page,
    request,
  }) => {
    for (const [locale, title, states, evaporation] of [
      ["ja", "移動と採餌", "個体差", "蒸発"],
      ["en", "Movement and foraging", "Individual differences", "evaporation"],
    ]) {
      const response = await request.get(`/${locale}/ants/index.html`);
      const html = await response.text();
      expect(html).toContain(title);
      expect(html).toContain("2.5 × exp(-d / 35)");
      await page.goto(`/${locale}/ants`);
      const explanation = page.getByTestId("ants-explanation");
      await explanation.locator("summary").click();
      await expect(
        explanation.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
      const algorithm = page.getByTestId("ants-algorithm");
      await expect(algorithm).toContainText(states);
      await expect(algorithm).toContainText(evaporation);
      await expect(algorithm).toContainText("0.7");
      await expect(algorithm).toContainText("0.12");
      await expect(algorithm).toContainText("1/30");
    }
  });
  test("initial maps belong to reset and remain selected after editing and expanding", async ({
    page,
  }) => {
    await page.goto("/ja/ants");
    const picker = page.getByRole("button", {
      name: "初期マップを選ぶ",
      exact: true,
    });
    await picker.click();
    await expect(page.getByRole("menuitemradio")).toHaveCount(10);
    await expect(
      page.getByRole("menuitemradio", { name: "開けた場所", exact: true }),
    ).toHaveAttribute("aria-checked", "true");
    await page
      .getByRole("menuitemradio", { name: "狭い通路", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "再開", exact: true }),
    ).toBeVisible();
    expect(await tick(page)).toBe(0);
    expect(await ground(page)).toBe(5220);
    expect(await pixel(page, 100.5, 20.5)).toEqual([79, 87, 82]);
    expect(await pixel(page, 140.5, 55.5)).toEqual([94, 158, 62]);
    await edit(page, 20.5, 20.5);
    expect(await ground(page)).toBe(5220 + 8100);
    await page.getByRole("button", { name: "リセット", exact: true }).click();
    expect(await ground(page)).toBe(5220);
    expect(await pixel(page, 100.5, 20.5)).toEqual([79, 87, 82]);
    await picker.click();
    await expect(
      page.getByRole("menuitemradio", { name: "狭い通路", exact: true }),
    ).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "拡大表示", exact: true }).click();
    await picker.click();
    await expect(
      page.getByRole("menuitemradio", { name: "近道と迂回路", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "アリ観察", exact: true }),
    ).toBeVisible();
    await picker.click();
    await page
      .getByRole("menuitemradio", { name: "近道と迂回路", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "アリ観察", exact: true }),
    ).toBeVisible();
    expect(await pixel(page, 115.5, 20.5)).toEqual([79, 87, 82]);
    await page
      .getByRole("button", { name: "拡大を閉じる", exact: true })
      .click();
    await page.setViewportSize({ width: 320, height: 640 });
    await picker.click();
    await page
      .getByRole("menuitemradio", { name: "開けた場所", exact: true })
      .click();
    expect(await pixel(page, 115.5, 20.5)).toEqual([244, 238, 219]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
    await page.goto("/en/ants");
    await page
      .getByRole("button", { name: "Choose initial map", exact: true })
      .click();
    await expect(
      page.getByRole("menuitemradio", { name: "Narrow passage", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("menuitemradio", { name: "Narrow passage", exact: true })
      .click();
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    expect(await pixel(page, 100.5, 20.5)).toEqual([79, 87, 82]);
  });
  test("pause/resume, speed slider, permanent pheromones and hidden time", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/ja/ants");
    await expect(
      page.getByRole("button", { name: "再開", exact: true }),
    ).toBeEnabled();
    expect(await tick(page)).toBe(0);
    const speedSlider = page.getByRole("slider", { name: "再生速度" });
    await expect(speedSlider).toHaveValue("1");
    await expect(speedSlider).toHaveAttribute("min", "0.5");
    await expect(speedSlider).toHaveAttribute("max", "32");
    await expect(speedSlider).toHaveAttribute("step", "0.25");
    for (const speed of [0.5, 1, 2.5, 4, 16, 32]) {
      await slide(speedSlider, speed);
      await expect(page.getByTestId("ants-speed-value")).toHaveText(
        `${speed}×`,
      );
    }
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "観察", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "再開", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "一時停止", exact: true }),
    ).toBeEnabled();
    await expect.poll(() => tick(page)).toBeGreaterThan(0);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const hidden = await tick(page);
    await page.waitForTimeout(250);
    expect(await tick(page)).toBe(hidden);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: false,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.getByRole("button", { name: "一時停止", exact: true }).click();
    const paused = await tick(page);
    await page.waitForTimeout(150);
    expect(await tick(page)).toBe(paused);
    await expect(
      page.getByRole("button", { name: "再開", exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
  test("small, medium and large brushes edit food, walls and eraser with a visible footprint", async ({
    page,
  }) => {
    await page.goto("/ja/ants");
    await expect(page.getByLabel("編集サイズ", { exact: true })).toBeEnabled();
    let expected = await ground(page);
    for (const [size, count, x] of [
      [5, 13, 20.5],
      [11, 81, 60.5],
      [21, 317, 90.5],
    ]) {
      await slide(
        page.getByRole("slider", { name: "編集サイズ", exact: true }),
        size!,
      );
      await edit(page, x!, 20.5);
      expected += count! * 100;
      expect(await ground(page)).toBe(expected);
      const preview = page.getByTestId("ants-brush-preview");
      await expect(preview).toBeVisible();
      const brush = (await preview.boundingBox())!;
      const box = (await canvas(page).boundingBox())!;
      expect((brush.width / box.width) * 240).toBeCloseTo(size!, 0);
    }
    await page.getByRole("button", { name: "壁", exact: true }).click();
    await slide(
      page.getByRole("slider", { name: "編集サイズ", exact: true }),
      5,
    );
    await edit(page, 20.5, 35.5, [50.5, 35.5]);
    expect(await pixel(page, 35.5, 33.5)).toEqual([79, 87, 82]);
    expect(await pixel(page, 35.5, 31.5)).toEqual([244, 238, 219]);
    await page.getByRole("button", { name: "消しゴム", exact: true }).click();
    await slide(
      page.getByRole("slider", { name: "編集サイズ", exact: true }),
      21,
    );
    await edit(page, 20.5, 20.5);
    expect(await ground(page)).toBe(expected - 1300);
    await edit(page, 35.5, 35.5);
    expect(await pixel(page, 35.5, 33.5)).toEqual([244, 238, 219]);
    expect(await pixel(page, 22.5, 35.5)).toEqual([79, 87, 82]);
    await expect(
      page.getByRole("button", { name: "この配置で最初から", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "リセット", exact: true }).click();
    expect(await ground(page)).toBe(5220);
    expect(await tick(page)).toBe(0);
    expect(await pixel(page, 22.5, 35.5)).toEqual([244, 238, 219]);
    expect(await pixel(page, 60.5, 20.5)).toEqual([244, 238, 219]);
    expect(await pixel(page, 110.5, 55.5)).toEqual([94, 158, 62]);
    expect(await pixel(page, 125.5, 105.5)).toEqual([94, 158, 62]);
    await expect(
      page.getByRole("button", { name: "再開", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
  test("size circle matches the canvas brush after resizing and expanding without overlapping controls", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/ja/ants");
    const slider = page.getByRole("slider", {
      name: "編集サイズ",
      exact: true,
    });
    await expect(slider).toBeEnabled();
    const circle = page.locator(".ants__size-preview i");
    const checkSize = async (size: number) => {
      await slide(slider, size);
      await expect
        .poll(async () => {
          const box = (await canvas(page).boundingBox())!;
          const preview = (await circle.boundingBox())!;
          return Math.abs(preview.width - (box.width / 240) * size);
        })
        .toBeLessThan(1);
      const preview = (await circle.boundingBox())!;
      expect(preview.height).toBeCloseTo(preview.width, 0);
      const input = (await slider.boundingBox())!;
      const output = (await page
        .locator('output[for="ants-size"]')
        .boundingBox())!;
      const editing = (await page.getByTestId("ants-editing").boundingBox())!;
      expect(input.width).toBeGreaterThan(40);
      expect(input.x + input.width).toBeLessThanOrEqual(preview.x);
      expect(preview.x + preview.width).toBeLessThanOrEqual(output.x);
      expect(preview.y).toBeGreaterThanOrEqual(editing.y);
      expect(preview.y + preview.height).toBeLessThanOrEqual(
        editing.y + editing.height,
      );
      const box = (await canvas(page).boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      const footprint = (await page
        .getByTestId("ants-brush-preview")
        .boundingBox())!;
      expect(footprint.width).toBeCloseTo(preview.width, 0);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(page.viewportSize()!.width);
      const dialog = page.getByRole("dialog", {
        name: "アリ観察",
        exact: true,
      });
      if (await dialog.count())
        expect(
          await dialog.evaluate(
            (element) => element.scrollHeight - element.clientHeight,
          ),
        ).toBeLessThanOrEqual(1);
    };
    for (const size of [3, 15, 31]) await checkSize(size);
    await page.getByRole("button", { name: "拡大表示", exact: true }).click();
    for (const size of [15, 31]) await checkSize(size);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await checkSize(31);
    await page
      .getByRole("button", { name: "拡大を閉じる", exact: true })
      .click();
    for (const width of [601, 375, 320]) {
      await page.setViewportSize({ width, height: 812 });
      for (const size of [3, 15, 31]) await checkSize(size);
    }
  });
  test("does not access storage or show save controls and reloads a fresh demo", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as any).__antDbCalls = 0;
      Object.defineProperty(window, "indexedDB", {
        value: {
          open: () => {
            (window as any).__antDbCalls++;
            throw new Error("storage is unavailable");
          },
        },
      });
    });
    await page.goto("/ja/ants");
    await expect(
      page.getByRole("button", { name: "餌", exact: true }),
    ).toBeEnabled();
    await expect(page.getByTestId("ants-import")).toHaveCount(0);
    await expect(page.getByTestId("ants-save-status")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /ファイル.*保存|ファイル.*読み込む/ }),
    ).toHaveCount(0);
    await edit(page, 20.5, 20.5);
    expect(await ground(page)).toBeGreaterThan(5220);
    await page.getByRole("button", { name: "再開", exact: true }).click();
    await expect.poll(() => tick(page)).toBeGreaterThan(0);
    await page.getByRole("button", { name: "一時停止", exact: true }).click();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "再開", exact: true }),
    ).toBeEnabled();
    expect(await ground(page)).toBe(5220);
    expect(await tick(page)).toBe(0);
    expect(await page.evaluate(() => (window as any).__antDbCalls)).toBe(0);
  });
  test("large touch brush works at DPR 3 and fits a narrow screen", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      deviceScaleFactor: 3,
      hasTouch: true,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.goto("/ja/ants");
    await slide(
      page.getByRole("slider", { name: "編集サイズ", exact: true }),
      21,
    );
    await canvas(page).scrollIntoViewIfNeeded();
    const box = (await canvas(page).boundingBox())!;
    await page.touchscreen.tap(
      box.x + (20.5 / 240) * box.width,
      box.y + (20.5 / 160) * box.height,
    );
    expect(await ground(page)).toBe(5220 + 31_700);
    expect(await pixel(page, 29.5, 20.5)).toEqual([94, 158, 62]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(375);
    const editing = page.getByTestId("ants-editing");
    await expect(editing).toHaveCSS("position", "fixed");
    const normalBox = (await canvas(page).boundingBox())!;
    const toolbar = (await editing.boundingBox())!;
    expect(normalBox.y + normalBox.height).toBeLessThanOrEqual(toolbar.y);
    expect(toolbar.y + toolbar.height).toBeLessThanOrEqual(812);
    await page.getByTestId("ants-explanation").locator("summary").click();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(
      editing.getByRole("slider", { name: "編集サイズ" }),
    ).toBeInViewport();
    await expect(
      editing.getByRole("button", { name: "壁", exact: true }),
    ).toBeInViewport();
    await page.screenshot({
      path: "output/playwright/ants/brush-mobile.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "拡大表示", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const expandedBox = (await canvas(page).boundingBox())!;
    const expandedToolbar = (await editing.boundingBox())!;
    expect(expandedBox.y + expandedBox.height).toBeLessThanOrEqual(
      expandedToolbar.y,
    );
    expect(await ground(page)).toBe(5220 + 31_700);
    await page.screenshot({
      path: "output/playwright/ants/expanded-mobile.png",
    });
    await page
      .getByRole("button", { name: "拡大を閉じる", exact: true })
      .click();
    await context.close();
  });
  test("SPA navigation cleans up playback and starts a fresh demo on return", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/ja/ants");
    for (let i = 0; i < 3; i++) {
      await page.getByRole("button", { name: "再開", exact: true }).click();
      await expect.poll(() => tick(page)).toBeGreaterThan(0);
      await page
        .getByRole("link", { name: "MCRE TOOLS - トップページへ移動" })
        .click();
      await page
        .getByRole("main")
        .getByRole("link", { name: /アリ観察/ })
        .click();
      await expect(
        page.getByRole("button", { name: "再開", exact: true }),
      ).toBeEnabled();
      expect(await tick(page)).toBe(0);
      expect(await ground(page)).toBe(5220);
    }
    expect(errors).toEqual([]);
  });
  test("autoplays, finds distant food and starts bringing it back", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.goto("/ja/ants");
    await expect(
      page.getByRole("button", { name: "一時停止", exact: true }),
    ).toBeEnabled();
    await page.clock.runFor(30_000);
    expect(await tick(page)).toBeGreaterThan(890);
    expect(
      Number(await page.getByTestId("ants-delivered").textContent()),
    ).toBeGreaterThan(0);
    await page.screenshot({
      path: "output/playwright/ants/demo-ui-30s.png",
      fullPage: true,
    });
    await page.clock.runFor(30_000);
    expect(
      Number(await page.getByTestId("ants-delivered").textContent()),
    ).toBeGreaterThan(120);
    expect(
      Number(await page.getByTestId("ants-carrying").textContent()),
    ).toBeGreaterThan(30);
    await page.screenshot({
      path: "output/playwright/ants/demo-ui-60s.png",
      fullPage: true,
    });
    await page
      .getByTestId("ants-readout")
      .screenshot({ path: "output/playwright/ants/readout.png" });
  });
});
