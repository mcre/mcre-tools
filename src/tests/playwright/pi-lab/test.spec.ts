import { expect, test } from "@playwright/test";

test("introduces pi with a short lead and the rolling experiment first", async ({
  page,
  request,
}) => {
  for (const locale of ["ja", "en"]) {
    await page.goto(`/${locale}/pi-lab/`);
    const sections = page.locator(".pi-lab__experiment");
    await expect(sections.locator(".pi-lab__badge")).toHaveText([
      "01",
      "02",
      "03",
      "04",
    ]);
    expect(
      await sections.evaluateAll((elements) => elements.map((e) => e.id)),
    ).toEqual(["pi-wheel", "pi-polygon", "pi-monte", "pi-area"]);
    const lead =
      locale === "ja"
        ? "円周率にまつわる性質や求め方をアニメーションで確認できます。"
        : "Animations show the properties of pi and how to calculate it.";
    await expect(page.getByTestId("tool-heading").locator("p")).toHaveText(
      lead,
    );
    await expect(page.locator(".pi-lab nav, .pi-lab__reference")).toHaveCount(
      0,
    );
    const html = await (await request.get(`/${locale}/pi-lab/`)).text();
    expect(html).toContain(lead);
    expect(html).not.toContain("π = 3.14159265");
    const offsets = ["pi-wheel", "pi-polygon", "pi-monte", "pi-area"].map(
      (id) => html.indexOf(`id="${id}"`),
    );
    expect(offsets.every((offset) => offset >= 0)).toBe(true);
    expect(offsets).toEqual(offsets.toSorted((a, b) => a - b));
  }
});

test("keeps the full text of English controls visible on a narrow phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/en/pi-lab");
  for (const button of await page
    .getByTestId("monte-carlo")
    .getByRole("button")
    .all()) {
    expect(
      await button.evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element.querySelector(".v-btn__content")!);
        const text = range.getBoundingClientRect();
        const box = element.getBoundingClientRect();
        return text.left >= box.left && text.right <= box.right;
      }),
    ).toBe(true);
  }
});

test("keeps graph history across the full horizontal axis after a long run", async ({
  page,
}) => {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto("/ja/pi-lab");
  const section = page.getByTestId("monte-carlo");
  await section.getByRole("button", { name: "自動実行", exact: true }).click();
  await page.clock.runFor(40_000);
  await section.getByRole("button", { name: "停止", exact: true }).click();
  const path = await section.getByTestId("mc-trace").getAttribute("d");
  const xs = [...path!.matchAll(/[ML]([\d.]+),/g)].map((match) =>
    Number(match[1]),
  );
  expect(xs.length).toBeLessThanOrEqual(8192);
  expect(xs[0]).toBeLessThan(73);
  const viewBox = await section.locator("figure svg").getAttribute("viewBox");
  const end = Number(viewBox!.split(" ", 3)[2]) - 10;
  expect(xs.at(-1)).toBe(end);
  for (let i = 1; i < xs.length; i++) {
    expect(xs[i]! - xs[i - 1]!).toBeLessThan((end - 72) * 0.05);
  }
});

test("uses the full section width for the graph and fits the mobile experiment in one screen", async ({
  page,
}) => {
  for (const locale of ["ja", "en"]) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/${locale}/pi-lab`);
    const section = page.getByTestId("monte-carlo");
    const grid = await section.locator(".pi-lab__grid").boundingBox();
    const chart = await section.locator("figure").boundingBox();
    const visual = await section.locator("canvas").boundingBox();
    expect(chart!.width).toBeGreaterThanOrEqual(grid!.width * 0.95);
    expect(chart!.y).toBeGreaterThanOrEqual(visual!.y + visual!.height);
    for (const { width, height } of [
      { width: 390, height: 844 },
      { width: 360, height: 780 },
      { width: 320, height: 740 },
    ]) {
      await page.setViewportSize({ width, height });
      const box = await section.boundingBox();
      expect(box!.height).toBeLessThanOrEqual(height - 64);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      expect(
        (await section.locator("canvas").boundingBox())!.width,
      ).toBeGreaterThanOrEqual(100);
      for (const button of await section.getByRole("button").all()) {
        expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
    }
  }
});

test("fits a 15-digit estimate and the fastest speed at mobile widths in both languages", async ({
  page,
}) => {
  for (const locale of ["ja", "en"]) {
    await page.goto(`/${locale}/pi-lab`);
    const section = page.getByTestId("monte-carlo");
    await section
      .getByRole("button", {
        name: locale === "ja" ? "1点追加" : "Add 1 dot",
        exact: true,
      })
      .click();
    await section.getByRole("slider").press("End");
    await expect(section.getByTestId("mc-speed-value")).toContainText(
      "10,000,000",
    );
    await expect(section.getByTestId("mc-estimate")).toHaveText(
      /^[04]\.\d{15}$/,
    );
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      const textFits = await section
        .getByTestId("mc-estimate")
        .evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          const text = range.getBoundingClientRect();
          const panel = element
            .closest(".pi-lab__result")!
            .getBoundingClientRect();
          return text.left >= panel.left && text.right <= panel.right;
        });
      expect(textFits).toBe(true);
    }
  }
});

test("keeps colored result text readable in dark mode", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/en/pi-lab");
  await expect(page.locator(".v-theme--dark").first()).toBeAttached();
  for (const id of ["polygon-lower", "polygon-upper"]) {
    const contrast = await page.getByTestId(id).evaluate((element) => {
      const luminance = (color: string) => {
        const channels = color
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number)
          .map((channel) => {
            const value = channel / 255;
            return value <= 0.04045
              ? value / 12.92
              : ((value + 0.055) / 1.055) ** 2.4;
          });
        return (
          channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
        );
      };
      const foreground = luminance(getComputedStyle(element).color);
      const background = luminance(
        getComputedStyle(element.closest("section")!).backgroundColor,
      );
      return (
        (Math.max(foreground, background) + 0.05) /
        (Math.min(foreground, background) + 0.05)
      );
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  }
});

test("samples real points, plots estimates, pauses and resets without growing the DOM", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/hydration/i.test(message.text())) errors.push(message.text());
  });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto("/ja/pi-lab");
  const experiment = page.getByTestId("monte-carlo");
  await expect(experiment.getByTestId("mc-total")).toHaveText("0");
  await expect(experiment.locator("details")).toHaveCount(0);
  await expect(
    experiment.getByText("点を追加して開始", { exact: true }),
  ).toHaveCount(0);
  await expect(
    experiment.getByText(
      "点を増やすと推定値はおおむねπに近づきますが、途中では上下します。",
      { exact: true },
    ),
  ).toHaveCount(0);
  await expect(
    experiment.getByText("● 円の内側", { exact: true }),
  ).toBeVisible();
  await expect(
    experiment.getByText("● 円の外側", { exact: true }),
  ).toBeVisible();
  await experiment
    .getByRole("button", { name: "1点追加", exact: true })
    .click();
  await expect(experiment.getByTestId("mc-total")).toHaveText("1");
  await experiment
    .getByRole("button", { name: "100点追加", exact: true })
    .click();
  await expect(experiment.getByTestId("mc-total")).toHaveText("101");
  const inside = Number(
    await experiment.getByTestId("mc-inside").textContent(),
  );
  const estimate = Number(
    await experiment.getByTestId("mc-estimate").textContent(),
  );
  expect(estimate).toBeCloseTo((4 * inside) / 101, 5);
  await expect(experiment.getByTestId("mc-estimate")).toHaveText(
    ((4 * inside) / 101).toFixed(15),
  );
  await expect(experiment.locator("canvas")).toHaveCount(1);
  await expect(experiment.getByTestId("mc-trace")).toHaveAttribute("d", /L/);
  await experiment
    .getByRole("button", { name: "自動実行", exact: true })
    .click();
  await page.clock.runFor(1000);
  expect(
    Number(await experiment.getByTestId("mc-total").textContent()),
  ).toBeGreaterThan(101);
  await experiment.getByRole("button", { name: "停止", exact: true }).click();
  await experiment.getByLabel("実行速度", { exact: true }).press("End");
  await expect(experiment.getByTestId("mc-speed-value")).toContainText(
    "10,000,000",
  );
  const canvasBefore = await experiment
    .locator("canvas")
    .evaluate((element) => (element as HTMLCanvasElement).toDataURL());
  await experiment
    .getByRole("button", { name: "自動実行", exact: true })
    .click();
  await page.clock.runFor(2000);
  await experiment.getByRole("button", { name: "停止", exact: true }).click();
  expect(
    Number(await experiment.getByTestId("mc-total").textContent()),
  ).toBeGreaterThan(1_000_000);
  await expect(experiment.getByTestId("mc-drawing-note")).toBeVisible();
  await expect(experiment.getByTestId("mc-drawing-note")).toHaveText(
    "図には最初の20,000点までを表示します。",
  );
  const min = Number(await experiment.getByTestId("mc-y-min").textContent());
  const max = Number(await experiment.getByTestId("mc-y-max").textContent());
  expect(max - min).toBeLessThan(0.1);
  expect(min).toBeLessThan(Math.PI);
  expect(max).toBeGreaterThan(Math.PI);
  const canvasAfter = await experiment
    .locator("canvas")
    .evaluate((element) => (element as HTMLCanvasElement).toDataURL());
  expect(canvasAfter).not.toBe(canvasBefore);
  await experiment
    .getByRole("button", { name: "自動実行", exact: true })
    .click();
  await page.clock.runFor(1000);
  await experiment.getByRole("button", { name: "停止", exact: true }).click();
  expect(
    await experiment
      .locator("canvas")
      .evaluate((element) => (element as HTMLCanvasElement).toDataURL()),
  ).toBe(canvasAfter);
  await expect(experiment.locator("canvas")).toHaveCount(1);
  const paused = await experiment.getByTestId("mc-total").textContent();
  await page.clock.runFor(1000);
  await expect(experiment.getByTestId("mc-total")).toHaveText(paused!);
  await experiment
    .getByRole("button", { name: "リセット", exact: true })
    .click();
  await expect(experiment.getByTestId("mc-total")).toHaveText("0");
  await expect(experiment.getByTestId("mc-estimate")).toHaveText("—");
  await expect(experiment.getByTestId("mc-drawing-note")).toHaveText(
    "図には最初の20,000点までを表示します。",
  );
  expect(errors).toEqual([]);
});

test("shows perimeter calculations with only a polygon slider", async ({
  page,
}) => {
  for (const locale of ["ja", "en"]) {
    await page.goto(`/${locale}/pi-lab`);
    const experiment = page.getByTestId("polygon");
    const slider = experiment.getByRole("slider", {
      name: locale === "ja" ? "正多角形" : "Polygon",
      exact: true,
    });
    await expect(experiment.getByRole("button")).toHaveCount(0);
    await expect(
      experiment.locator('label[for="pi-polygon-shape"]'),
    ).toHaveCount(0);
    await expect(experiment.locator(".pi-lab__metrics")).toHaveCount(0);
    await expect(
      experiment.getByText(
        locale === "ja"
          ? "図の差が見えなくなっても、数値の範囲はさらに狭まります。"
          : "The numerical interval continues to narrow even after the shapes appear to overlap.",
      ),
    ).toHaveCount(0);
    const calculation = experiment.getByTestId("polygon-calculation");
    await expect(calculation).toBeVisible();
    await expect(calculation).toContainText(
      locale === "ja"
        ? "周長 ÷ 直径（直径 = 1）"
        : "Perimeter ÷ diameter (diameter = 1)",
    );
    await expect(experiment.getByTestId("polygon-sides")).toHaveText(
      locale === "ja" ? "正6角形" : "Regular 6-gon",
    );
    await expect(experiment.getByTestId("polygon-inner-perimeter")).toHaveText(
      "3.000000",
    );
    await expect(experiment.getByTestId("polygon-outer-perimeter")).toHaveText(
      "3.464102",
    );
    const diameter = experiment.getByTestId("polygon-diameter");
    await expect(diameter).toHaveText("1");
    const line = experiment.getByTestId("polygon-diameter-line");
    await expect(line).toHaveAttribute("x1", "48");
    await expect(line).toHaveAttribute("x2", "272");
    await expect(line).toHaveAttribute("y1", "160");
    await expect(line).toHaveAttribute("y2", "160");
    await slider.press("Home");
    await slider.press("ArrowRight");
    await slider.press("ArrowRight");
    await expect(experiment.getByTestId("polygon-sides")).toHaveText(
      locale === "ja" ? "正5角形" : "Regular 5-gon",
    );
    await expect(experiment.getByTestId("polygon-inner-perimeter")).toHaveText(
      "2.938926",
    );
    await expect(experiment.getByTestId("polygon-outer-perimeter")).toHaveText(
      "3.632713",
    );
    for (const key of ["Home", "End"]) {
      await slider.press(key);
      for (const [perimeter, bound] of [
        ["polygon-inner-perimeter", "polygon-lower"],
        ["polygon-outer-perimeter", "polygon-upper"],
      ]) {
        const source = Number(
          await experiment.getByTestId(perimeter!).textContent(),
        );
        const result = Number(
          await experiment.getByTestId(bound!).textContent(),
        );
        expect(source).toBeCloseTo(result, 5);
      }
      expect(
        Number(await experiment.getByTestId("polygon-lower").textContent()),
      ).toBeLessThan(Math.PI);
      expect(
        Number(await experiment.getByTestId("polygon-upper").textContent()),
      ).toBeGreaterThan(Math.PI);
    }
  }
});

test("selects every polygon size with a keyboard-accessible side slider in both languages", async ({
  page,
}) => {
  for (const locale of ["ja", "en"]) {
    await page.goto(`/${locale}/pi-lab`);
    const experiment = page.getByTestId("polygon");
    const slider = experiment.getByRole("slider", {
      name: locale === "ja" ? "正多角形" : "Polygon",
      exact: true,
    });
    await slider.press("Home");
    let previousGap = Infinity;
    for (let sides = 3; sides <= 12; sides++) {
      const shape = locale === "ja" ? `正${sides}角形` : `Regular ${sides}-gon`;
      await expect(experiment.getByTestId("polygon-sides")).toHaveText(shape);
      await expect(slider).toHaveAttribute("aria-valuetext", shape);
      const lower = Number(
        await experiment.getByTestId("polygon-lower").textContent(),
      );
      const upper = Number(
        await experiment.getByTestId("polygon-upper").textContent(),
      );
      expect(lower).toBeLessThan(Math.PI);
      expect(upper).toBeGreaterThan(Math.PI);
      expect(upper - lower).toBeLessThan(previousGap);
      previousGap = upper - lower;
      expect(
        (await experiment
          .locator("polygon")
          .first()
          .getAttribute("points"))!.split(" ").length,
      ).toBe(sides);
      const viewBox = (await experiment
        .locator("svg")
        .first()
        .getAttribute("viewBox"))!
        .split(" ", 4)
        .map(Number);
      const vertices = (await experiment
        .locator("polygon")
        .first()
        .getAttribute("points"))!
        .split(" ")
        .map((pair) => pair.split(",", 2).map(Number));
      for (const [x, y] of vertices) {
        expect(x!).toBeGreaterThanOrEqual(viewBox[0]!);
        expect(x!).toBeLessThanOrEqual(viewBox[0]! + viewBox[2]!);
        expect(y!).toBeGreaterThanOrEqual(viewBox[1]!);
        expect(y!).toBeLessThanOrEqual(viewBox[1]! + viewBox[3]!);
      }
      expect(
        await experiment
          .locator(".pi-lab__interval-track > span")
          .evaluate((element) => {
            const bar = element.getBoundingClientRect(),
              track = element.parentElement!.getBoundingClientRect();
            return (
              bar.left >= track.left - 0.5 && bar.right <= track.right + 0.5
            );
          }),
      ).toBe(true);
      if (sides < 12) await slider.press("ArrowRight");
    }
    await slider.press("End");
    await expect(experiment.getByTestId("polygon-sides")).toHaveText(
      locale === "ja" ? "正1,000,000角形" : "Regular 1,000,000-gon",
    );
    await slider.press("ArrowLeft");
    await expect(experiment.getByTestId("polygon-sides")).toHaveText(
      locale === "ja" ? "正999,999角形" : "Regular 999,999-gon",
    );
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      expect((await slider.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      const box = (await slider.boundingBox())!;
      await slider.click({
        position: { x: 8 + (box.width - 16) * 0.067, y: box.height / 2 },
      });
      await expect(experiment.getByTestId("polygon-sides")).toHaveText(
        locale === "ja" ? "正5角形" : "Regular 5-gon",
      );
    }
  }
});

test("reaches a million sides without generating a million vertices", async ({
  page,
}) => {
  for (const locale of ["ja", "en"]) {
    await page.goto(`/${locale}/pi-lab/`);
    const section = page.getByTestId("polygon");
    const slider = section.getByRole("slider");
    await expect(slider).toHaveAttribute("aria-valuemax", "1000000");
    await slider.fill("100");
    await expect(section.getByTestId("polygon-sides")).toHaveText(
      locale === "ja" ? "正1,000,000角形" : "Regular 1,000,000-gon",
    );
    await expect(section.getByTestId("polygon-lower")).toHaveText(
      "3.141592653584",
    );
    await expect(section.getByTestId("polygon-upper")).toHaveText(
      "3.141592653601",
    );
    await expect(section.locator("svg polygon")).toHaveCount(0);
    await expect(section.getByTestId("polygon-drawing-note")).toHaveCount(0);
    expect(await section.locator("svg *").count()).toBeLessThan(12);
    await slider.press("ArrowLeft");
    await expect(section.getByTestId("polygon-sides")).toHaveText(
      locale === "ja" ? "正999,999角形" : "Regular 999,999-gon",
    );
    await slider.press("Home");
    await slider.press("ArrowRight");
    await slider.press("ArrowRight");
    await expect(section.getByTestId("polygon-sides")).toHaveText(
      locale === "ja" ? "正5角形" : "Regular 5-gon",
    );
    await expect(section.locator("svg polygon")).toHaveCount(2);
    await expect(section.getByTestId("polygon-drawing-note")).toHaveCount(0);
  }
});

test("rolls a circle exactly one turn and can pause and scrub", async ({
  page,
}) => {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto("/ja/pi-lab");
  const experiment = page.getByTestId("wheel");
  await expect(experiment.getByRole("slider")).toHaveCount(2);
  await expect(experiment.getByTestId("wheel-diameter")).toHaveText("1");
  await experiment.getByRole("button", { name: "再生", exact: true }).click();
  await page.clock.runFor(1500);
  await experiment.getByRole("button", { name: "停止", exact: true }).click();
  const paused = await experiment.getByTestId("wheel-ratio").textContent();
  await page.clock.runFor(1000);
  await expect(experiment.getByTestId("wheel-ratio")).toHaveText(paused!);
  await experiment.getByRole("button", { name: "再生", exact: true }).click();
  await page.clock.runFor(6500);
  await expect(experiment.getByTestId("wheel-ratio")).toHaveText(
    "3.141592653590",
  );
  await expect(experiment.getByTestId("wheel-complete")).toBeVisible();
  const distance = Number(
    await experiment.getByTestId("wheel-distance").textContent(),
  );
  expect(distance).toBeCloseTo(Math.PI, 5);
  const rotation = experiment.getByRole("slider", {
    name: "回転位置",
    exact: true,
  });
  await rotation.fill("0.5");
  await expect(experiment.getByTestId("wheel-ratio")).toHaveText(
    "1.570796326795",
  );
  expect(
    Number(await experiment.getByTestId("wheel-distance").textContent()),
  ).toBeCloseTo(Math.PI / 2, 5);
  await expect(experiment.getByTestId("wheel-complete")).toHaveCount(0);
  await rotation.press("Home");
  await expect(experiment.getByTestId("wheel-ratio")).toHaveText(
    "0.000000000000",
  );
});

test("changes diameter on a fixed distance scale and shows both axes", async ({
  page,
}) => {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  for (const locale of ["ja", "en"]) {
    await page.goto(`/${locale}/pi-lab/`);
    const section = page.getByTestId("wheel");
    const diameter = section.getByRole("slider", {
      name: locale === "ja" ? "直径" : "Diameter",
      exact: true,
    });
    const rotation = section.getByRole("slider", {
      name: locale === "ja" ? "回転位置" : "Rotation",
      exact: true,
    });
    const distanceAxis = section.getByTestId("wheel-distance-axis");
    const ratioAxis = section.getByTestId("wheel-ratio-axis");
    await expect(distanceAxis.locator(".pi-lab__axis-title")).toHaveText(
      locale === "ja" ? "移動距離" : "Distance",
    );
    await expect(ratioAxis.locator(".pi-lab__axis-title")).toHaveText(
      locale === "ja" ? "移動距離 ÷ 直径" : "Distance ÷ diameter",
    );
    await expect(distanceAxis.locator(".pi-lab__axis-tick-label")).toHaveText([
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
    ]);
    await expect(ratioAxis.locator(".pi-lab__axis-tick-label")).toHaveText([
      "0",
      "1",
      "2",
      "3",
      "π",
    ]);
    const absoluteUnit =
      Number(await distanceAxis.locator("text").nth(2).getAttribute("x")) -
      Number(await distanceAxis.locator("text").nth(1).getAttribute("x"));
    const disc = section.locator(".pi-lab__wheel-disc");
    const diameterCaption = section.getByTestId("wheel-diameter-caption");
    await expect(diameterCaption).toHaveText(
      locale === "ja" ? "直径: 1" : "Diameter: 1",
    );
    await expect(diameterCaption).toBeVisible();
    await expect(section.getByTestId("wheel-disc-diameter")).toHaveCount(0);
    for (const value of [0.5, 1, 2]) {
      await diameter.fill(String(value));
      await expect(section.getByTestId("wheel-diameter")).toHaveText(
        String(value),
      );
      await expect(diameterCaption).toHaveText(
        `${locale === "ja" ? "直径" : "Diameter"}: ${value}`,
      );
      await expect(diameterCaption).toBeVisible();
      await rotation.press("Home");
      const start = Number(await disc.getAttribute("cx"));
      const radius = Number(await disc.getAttribute("r"));
      expect((2 * radius) / absoluteUnit).toBeCloseTo(value, 12);
      await rotation.press("End");
      const end = Number(await disc.getAttribute("cx"));
      const dimension = await section
        .getByTestId("wheel-diameter-line")
        .evaluate((element) => {
          const box = (element as SVGPathElement).getBBox();
          return {
            x: box.x + box.width / 2,
            y: box.y + box.height / 2,
            width: box.width,
          };
        });
      expect(dimension.x).toBeCloseTo(end, 4);
      expect(dimension.y).toBeCloseTo(Number(await disc.getAttribute("cy")), 4);
      expect(dimension.width / radius).toBeCloseTo(2, 4);
      expect(Number(await diameterCaption.getAttribute("x"))).toBeCloseTo(
        end,
        12,
      );
      const discBox = (await disc.boundingBox())!;
      const captionBox = (await diameterCaption.boundingBox())!;
      const stageBox = (await section
        .locator(".pi-lab__wheel-stage svg")
        .boundingBox())!;
      expect(captionBox.x).toBeGreaterThanOrEqual(stageBox.x);
      expect(captionBox.x + captionBox.width).toBeLessThanOrEqual(
        stageBox.x + stageBox.width,
      );
      expect(captionBox.y).toBeGreaterThanOrEqual(stageBox.y);
      expect(captionBox.y + captionBox.height).toBeLessThanOrEqual(discBox.y);
      expect((end - start) / absoluteUnit).toBeCloseTo(Math.PI * value, 12);
      expect((end - start) / radius).toBeCloseTo(2 * Math.PI, 12);
      expect(
        Number(await section.getByTestId("wheel-distance").textContent()),
      ).toBeCloseTo(Math.PI * value, 5);
      await expect(section.getByTestId("wheel-ratio")).toHaveText(
        "3.141592653590",
      );
      const normalizedUnit =
        Number(await ratioAxis.locator("text").nth(2).getAttribute("x")) -
        Number(await ratioAxis.locator("text").nth(1).getAttribute("x"));
      expect(normalizedUnit / absoluteUnit).toBeCloseTo(value, 12);
      expect(
        Number(await ratioAxis.locator("text").last().getAttribute("x")),
      ).toBeCloseTo(end, 12);
      expect(
        Number(await distanceAxis.locator("text").nth(2).getAttribute("x")) -
          Number(await distanceAxis.locator("text").nth(1).getAttribute("x")),
      ).toBe(absoluteUnit);
    }
    await rotation.fill("0.5");
    await diameter.fill("1");
    await expect(diameterCaption).toHaveText(
      locale === "ja" ? "直径: 1" : "Diameter: 1",
    );
    expect(
      await diameterCaption.evaluate((element) => {
        const matrix = (element as SVGTextElement).getScreenCTM()!;
        return Math.atan2(matrix.b, matrix.a);
      }),
    ).toBe(0);
    await expect(section.getByTestId("wheel-ratio")).toHaveText(
      "1.570796326795",
    );
    expect(
      Number(await section.getByTestId("wheel-distance").textContent()),
    ).toBeCloseTo(Math.PI / 2, 5);
  }
});

test("fits the rolling experiment and its numeric inputs in one touch screen", async ({
  browser,
  baseURL,
}) => {
  for (const locale of ["ja", "en"]) {
    for (const viewport of [
      { width: 320, height: 740 },
      { width: 390, height: 844 },
      { width: 430, height: 932 },
    ]) {
      const context = await browser.newContext({
        baseURL,
        viewport,
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();
      await page.goto(`/${locale}/pi-lab/`);
      const section = page.getByTestId("wheel");
      const rotation = section.getByRole("slider", {
        name: locale === "ja" ? "回転位置" : "Rotation",
        exact: true,
      });
      await expect(section.getByRole("button")).toHaveCount(1);
      await expect(section.getByRole("slider")).toHaveCount(2);
      await expect(section.getByTestId("wheel-diameter")).toHaveText("1");
      await expect(section.locator("details, select")).toHaveCount(0);
      expect((await rotation.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      const diameter = section.getByRole("slider", {
        name: locale === "ja" ? "直径" : "Diameter",
        exact: true,
      });
      expect((await diameter.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await diameter.press("End");
      await rotation.press("Home");
      const disc = section.locator(".pi-lab__wheel-disc");
      await expect(disc).toHaveAttribute("r", "40");
      const start = (await disc.boundingBox())!;
      const renderedRadius = await disc.evaluate((element) => {
        const circle = element as SVGCircleElement;
        const transform = circle.getScreenCTM()!;
        // Bounding rectangles include the outline; the rolling radius does not.
        return circle.r.baseVal.value * Math.hypot(transform.a, transform.b);
      });
      await rotation.press("End");
      const finish = (await disc.boundingBox())!;
      // The center advances by a circumference while the wheel turns once.
      expect((finish.x - start.x) / renderedRadius).toBeCloseTo(2 * Math.PI, 4);
      await expect(section.getByTestId("wheel-ratio")).toHaveText(
        "3.141592653590",
      );
      const stage = (await section
        .locator(".pi-lab__wheel-stage svg")
        .boundingBox())!;
      const caption = section.getByTestId("wheel-diameter-caption");
      await expect(caption).toHaveText(
        locale === "ja" ? "直径: 2" : "Diameter: 2",
      );
      await expect(caption).toBeVisible();
      const captionBox = (await caption.boundingBox())!;
      expect(captionBox.x).toBeGreaterThanOrEqual(stage.x);
      expect(captionBox.x + captionBox.width).toBeLessThanOrEqual(
        stage.x + stage.width,
      );
      expect(captionBox.y).toBeGreaterThanOrEqual(stage.y);
      expect(captionBox.y + captionBox.height).toBeLessThanOrEqual(finish.y);
      expect(finish.x + finish.width).toBeLessThanOrEqual(
        stage.x + stage.width,
      );
      const result = section.getByTestId("wheel-ratio");
      expect(
        await result.evaluate((element) => element.scrollWidth),
      ).toBeLessThanOrEqual((await result.boundingBox())!.width + 1);
      await section.evaluate((element) =>
        element.scrollIntoView({ block: "start" }),
      );
      const box = (await section.boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(viewport.width);
      await context.close();
    }
  }
});

test("fits the polygon visual, result and slider in one phone screen", async ({
  page,
}) => {
  for (const locale of ["ja", "en"]) {
    await page.goto(`/${locale}/pi-lab`);
    const experiment = page.getByTestId("polygon");
    const slider = experiment.getByRole("slider");
    await slider.press("Home");
    for (const { width, height } of [
      { width: 390, height: 844 },
      { width: 320, height: 740 },
    ]) {
      await page.setViewportSize({ width, height });
      expect((await experiment.boundingBox())!.height).toBeLessThanOrEqual(
        height - 64,
      );
      expect((await slider.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  }
});

test("keeps the polygon large and its controls within reach on touch screens", async ({
  browser,
  baseURL,
}) => {
  for (const locale of ["ja", "en"]) {
    for (const viewport of [
      { width: 320, height: 740 },
      { width: 390, height: 844 },
      { width: 430, height: 932 },
    ]) {
      const context = await browser.newContext({
        baseURL,
        viewport,
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();
      await page.goto(`/${locale}/pi-lab/`);
      const section = page.getByTestId("polygon");
      const slider = section.getByRole("slider");
      const visual = section.locator("svg").first();
      await expect(section).toHaveCSS("width", `${viewport.width - 32}px`);
      const diagram = (await visual.boundingBox())!;
      expect(diagram.width).toBeGreaterThanOrEqual(180);
      expect(diagram.height).toBeGreaterThanOrEqual(180);
      const sectionBox = (await section.boundingBox())!;
      expect(diagram.x + diagram.width / 2).toBeCloseTo(
        sectionBox.x + sectionBox.width / 2,
        0,
      );
      const range = (await slider.boundingBox())!;
      expect(range.y).toBeGreaterThanOrEqual(diagram.y + diagram.height);
      expect(range.height).toBeGreaterThanOrEqual(44);
      await slider.tap({
        position: { x: 8 + (range.width - 16) * 0.067, y: range.height / 2 },
      });
      await expect(section.getByTestId("polygon-sides")).toHaveText(
        locale === "ja" ? "正5角形" : "Regular 5-gon",
      );
      const interval = (await section
        .locator(".pi-lab__interval-track")
        .boundingBox())!;
      expect(interval.width).toBeGreaterThanOrEqual(range.width - 1);
      await expect(section.getByRole("button")).toHaveCount(0);
      const calculation = section.getByTestId("polygon-calculation");
      for (const key of ["Home", "End"]) {
        await slider.press(key);
        await expect(calculation).toBeVisible();
        for (const row of await calculation.locator("dl > div").all()) {
          expect(
            await row.evaluate((element) => element.scrollWidth),
          ).toBeLessThanOrEqual((await row.boundingBox())!.width + 1);
        }
        const bounds = section.locator(".pi-lab__bounds");
        expect(
          await bounds.evaluate((element) => element.scrollWidth),
        ).toBeLessThanOrEqual((await bounds.boundingBox())!.width + 1);
        await section.evaluate((element) =>
          element.scrollIntoView({ block: "start" }),
        );
        const finalBox = (await section.boundingBox())!;
        expect(finalBox.y + finalBox.height).toBeLessThanOrEqual(
          viewport.height,
        );
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(viewport.width);
      }
      await context.close();
    }
  }
});

test("offers manual experiments with reduced motion and stops when hidden", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/ja/pi-lab");
  await expect(
    page
      .getByTestId("monte-carlo")
      .getByRole("button", { name: "自動実行", exact: true }),
  ).toBeDisabled();
  await page.getByTestId("polygon").getByRole("slider").press("ArrowRight");
  await expect(
    page.getByTestId("polygon").getByTestId("polygon-sides"),
  ).toHaveText("正7角形");
  await page.getByRole("button", { name: "¼回転進める", exact: true }).click();
  await expect(page.getByTestId("wheel-ratio")).toHaveText("0.785398163397");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page
    .getByTestId("wheel")
    .getByRole("button", { name: "再生", exact: true })
    .click();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(
    page
      .getByTestId("wheel")
      .getByRole("button", { name: "再生", exact: true }),
  ).toBeVisible();
});

test("rearranges equal sectors to explain circle area in both languages", async ({
  page,
  request,
}) => {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  for (const locale of ["ja", "en"]) {
    await page.goto(`/${locale}/pi-lab/`);
    const section = page.getByTestId("circle-area");
    const slider = section.getByRole("slider");
    const button = section.getByRole("button");
    const formulaWords =
      locale === "ja" ? "半径 × 半径 × π" : "Radius × radius × π";
    await expect(section.getByTestId("area-formula-words")).toHaveText(
      formulaWords,
    );
    await expect(section.getByTestId("area-formula-words")).toBeVisible();
    const radiusLabel = locale === "ja" ? "半径（r）" : "Radius (r)";
    await expect(section.getByTestId("area-radius-label")).toHaveText(
      radiusLabel,
    );
    await expect(section.locator(".pi-lab__badge")).toHaveText("04");
    await expect(
      section.getByTestId("area-sectors").locator("path"),
    ).toHaveCount(8);
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await button.click();
    await page.clock.runFor(1500);
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(section.getByTestId("area-limit-rectangle")).toBeVisible();
    await expect(section.getByTestId("area-radius-label")).toHaveText(
      radiusLabel,
    );
    const arcLabel = section.getByTestId("area-half-circumference-label");
    await expect(arcLabel.locator("tspan").nth(0)).toHaveText(
      locale === "ja" ? "円周の半分" : "Half the circumference",
    );
    await expect(arcLabel.locator("tspan").nth(1)).toHaveText(
      locale === "ja" ? "= 半径 × 円周率（πr）" : "= radius × pi (πr)",
    );
    await expect(section.getByTestId("area-formula")).toHaveText(
      "πr × r = πr²",
    );
    const rectangle = section.getByTestId("area-limit-rectangle");
    const width = Number(await rectangle.getAttribute("width"));
    const height = Number(await rectangle.getAttribute("height"));
    expect(width / height).toBeCloseTo(Math.PI, 12);
    await slider.press("End");
    await expect(
      section.getByTestId("area-sectors").locator("path"),
    ).toHaveCount(256);
    await expect(section.getByTestId("area-formula")).toHaveText(
      "πr × r = πr²",
    );
    await slider.press("Home");
    await expect(
      section.getByTestId("area-sectors").locator("path"),
    ).toHaveCount(4);
    await button.click();
    await page.clock.runFor(1500);
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await expect(rectangle).toHaveCount(0);
    const html = await (await request.get(`/${locale}/pi-lab/`)).text();
    expect(html).toContain('id="pi-area"');
    expect(html).toContain(locale === "ja" ? "円の面積" : "Circle area");
    expect(html).toContain(formulaWords);
    expect(html).not.toContain(
      locale === "ja" ? "3つの実験" : "Three experiments",
    );
  }
});

test("keeps the area experiment usable on phones and with reduced motion", async ({
  browser,
  baseURL,
}) => {
  for (const locale of ["ja", "en"]) {
    for (const viewport of [
      { width: 320, height: 740 },
      { width: 390, height: 844 },
    ]) {
      const context = await browser.newContext({
        baseURL,
        viewport,
        isMobile: true,
        hasTouch: true,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      await page.goto(`/${locale}/pi-lab/`);
      const section = page.getByTestId("circle-area");
      const button = section.getByRole("button");
      const slider = section.getByRole("slider");
      await expect(section.getByTestId("area-formula-words")).toHaveText(
        locale === "ja" ? "半径 × 半径 × π" : "Radius × radius × π",
      );
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect((await slider.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await button.tap();
      await expect(section.getByTestId("area-limit-rectangle")).toBeVisible();
      for (const key of ["Home", "End"]) {
        await slider.press(key);
        const visual = section.locator(".pi-lab__area-stage svg");
        const stage = (await visual.boundingBox())!;
        for (const label of await visual.locator("text").all()) {
          const box = (await label.boundingBox())!;
          expect(box.x).toBeGreaterThanOrEqual(stage.x);
          expect(box.x + box.width).toBeLessThanOrEqual(stage.x + stage.width);
          expect(box.y).toBeGreaterThanOrEqual(stage.y);
          expect(box.y + box.height).toBeLessThanOrEqual(
            stage.y + stage.height,
          );
        }
        for (const piece of await section
          .getByTestId("area-sectors")
          .locator("path")
          .all()) {
          const box = (await piece.boundingBox())!;
          expect(box.x).toBeGreaterThanOrEqual(stage.x);
          expect(box.x + box.width).toBeLessThanOrEqual(stage.x + stage.width);
          expect(box.y).toBeGreaterThanOrEqual(stage.y);
          expect(box.y + box.height).toBeLessThanOrEqual(
            stage.y + stage.height,
          );
        }
        await section.evaluate((e) => e.scrollIntoView({ block: "start" }));
        const box = (await section.boundingBox())!;
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(viewport.width);
      }
      await context.close();
    }
  }
});

for (const locale of ["ja", "en"]) {
  test(`${locale}: navigation, static SEO and responsive visuals`, async ({
    page,
    request,
    browser,
    baseURL,
  }) => {
    const title = locale === "ja" ? "円周率の実験" : "Pi Experiments";
    await page.goto(`/${locale}/`);
    await page
      .getByRole("main")
      .getByRole("link", { name: new RegExp(title) })
      .click();
    await expect(page.locator("h1")).toHaveText(title);
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
      "href",
      `https://tools.mcre.info/${locale}/pi-lab`,
    );
    const response = await request.get(`/${locale}/pi-lab/`);
    const html = await response.text();
    expect(html).toContain(title);
    expect(html).toContain("WebApplication");
    const sitemap = await request.get("/sitemap.xml");
    expect(await sitemap.text()).toContain(`/${locale}/pi-lab`);
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      for (const id of ["monte-carlo", "polygon", "wheel", "circle-area"]) {
        const section = page.getByTestId(id);
        await section.scrollIntoViewIfNeeded();
        await expect(section).toBeVisible();
        expect(
          await section
            .getByRole(id === "polygon" ? "slider" : "button")
            .first()
            .evaluate((element) => element.getBoundingClientRect().height),
        ).toBeGreaterThanOrEqual(44);
      }
    }
    const icon = await request.get("/img/pi-lab/180.png");
    expect(icon.headers()["content-type"]).toContain("image/png");
    const noJs = await browser.newContext({
      baseURL,
      javaScriptEnabled: false,
    });
    const staticPage = await noJs.newPage();
    await staticPage.goto(`/${locale}/pi-lab/`);
    await expect(staticPage.locator("h1")).toHaveText(title);
    await expect(
      staticPage.getByTestId("polygon").locator("svg").first(),
    ).toBeVisible();
    await expect(
      staticPage.getByTestId("circle-area").getByRole("img"),
    ).toBeVisible();
    await noJs.close();
    await page.locator("#language-switcher-button").click();
    await page
      .locator(`#language-option-${locale === "ja" ? "en" : "ja"}`)
      .click();
    await expect(page.locator("h1")).toHaveText(
      locale === "ja" ? "Pi Experiments" : "円周率の実験",
    );
  });
}
