import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const expectInsideViewport = async (
  locator: Locator,
  viewportWidth: number,
) => {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth);
};

const expectLoadedImage = async (locator: Locator) => {
  await expect(locator).toBeVisible();
  const loaded = await locator.evaluate((element) => {
    const image = element as HTMLImageElement;
    return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
  });
  expect(loaded).toBe(true);
};

const expectWheelLabelsInsideWheel = async (page: Page) => {
  const wheelBox = await page.locator(".roulette-wheel").boundingBox();
  expect(wheelBox).not.toBeNull();

  const labels = page.locator(".roulette-wheel__label-character");
  const count = await labels.count();
  expect(count).toBeGreaterThan(0);

  for (let index = 0; index < count; index += 1) {
    const labelBox = await labels.nth(index).boundingBox();
    expect(labelBox).not.toBeNull();
    expect(labelBox!.x).toBeGreaterThanOrEqual(wheelBox!.x - 1);
    expect(labelBox!.y).toBeGreaterThanOrEqual(wheelBox!.y - 1);
    expect(labelBox!.x + labelBox!.width).toBeLessThanOrEqual(
      wheelBox!.x + wheelBox!.width + 1,
    );
    expect(labelBox!.y + labelBox!.height).toBeLessThanOrEqual(
      wheelBox!.y + wheelBox!.height + 1,
    );
  }
};

type GroupRouletteMemberFixture = {
  id: string;
  displayName: string;
  role: "host" | "guest";
};

const mockGroupRouletteRoom = async (
  page: Page,
  {
    addOptionDelayMs = 0,
    createMember = {
      id: "member_host",
      displayName: "ホスト",
      role: "host",
    },
    joinMember = createMember,
  }: {
    addOptionDelayMs?: number;
    createMember?: GroupRouletteMemberFixture;
    joinMember?: GroupRouletteMemberFixture;
  } = {},
) => {
  let activeOptions: Array<{ id: string; label: string; order: number }> = [];
  let status = "waiting";
  let currentSpin: Record<string, unknown> | null = null;
  let revision = 1;
  const envelope = (payload: Record<string, unknown> = {}) => ({
    protocolVersion: 1,
    tool: "group-roulette",
    type: "roomState",
    roomId: "room_abc",
    revision: revision++,
    serverTime: "2026-05-08T09:30:00.000Z",
    payload: {
      status,
      expiresAt: "2026-05-09T09:30:00Z",
      guestAddEnabled: true,
      activeOptions,
      currentSpin,
      ...payload,
    },
  });

  await page.route("**/v1/group-roulette/rooms", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      status: 201,
      body: JSON.stringify({
        ...envelope({ member: createMember }),
        hostToken: "host_secret",
      }),
    });
  });
  await page.route(
    "**/v1/group-roulette/rooms/room_abc/join",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: JSON.stringify(envelope({ member: joinMember })),
      });
    },
  );
  await page.route(
    "**/v1/group-roulette/rooms/room_abc/state**",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: JSON.stringify(envelope()),
      });
    },
  );
  await page.route(
    "**/v1/group-roulette/rooms/room_abc/options",
    async (route) => {
      const request = route.request().postDataJSON() as { label: string };
      activeOptions = [
        ...activeOptions,
        {
          id: `option_${activeOptions.length + 1}`,
          label: request.label,
          order: activeOptions.length + 1,
        },
      ];
      if (addOptionDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, addOptionDelayMs));
      }
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: JSON.stringify(envelope()),
      });
    },
  );
  await page.route(
    "**/v1/group-roulette/rooms/room_abc/spins/start",
    async (route) => {
      status = "spinning";
      currentSpin = {
        id: "spin_1",
        startedAt: "2026-05-08T09:30:00Z",
        durationMs: 5000,
        options: activeOptions,
      };
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: JSON.stringify(envelope()),
      });
    },
  );
  await page.route(
    "**/v1/group-roulette/rooms/room_abc/spins/stop",
    async (route) => {
      status = "stopping";
      currentSpin = {
        id: "spin_1",
        startedAt: "2026-05-08T09:30:00Z",
        durationMs: 5000,
        options: activeOptions,
        winnerOptionId: activeOptions[1]?.id ?? activeOptions[0]?.id,
        stopAt: "2026-05-08T09:30:03Z",
      };
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: JSON.stringify(envelope()),
      });
    },
  );
};

const expectShareButtonIconContained = async (button: Locator) => {
  await expect(button).toBeVisible();

  const icon = button.locator("img.share-button__icon--x");
  await expectLoadedImage(icon);

  const buttonBox = await button.boundingBox();
  const iconBox = await icon.boundingBox();
  expect(buttonBox).not.toBeNull();
  expect(iconBox).not.toBeNull();

  expect(iconBox!.x).toBeGreaterThanOrEqual(buttonBox!.x);
  expect(iconBox!.y).toBeGreaterThanOrEqual(buttonBox!.y);
  expect(iconBox!.x + iconBox!.width).toBeLessThanOrEqual(
    buttonBox!.x + buttonBox!.width,
  );
  expect(iconBox!.y + iconBox!.height).toBeLessThanOrEqual(
    buttonBox!.y + buttonBox!.height,
  );
  expect(iconBox!.width).toBeGreaterThanOrEqual(18);
  expect(iconBox!.width).toBeLessThanOrEqual(22);
  expect(iconBox!.height).toBeGreaterThanOrEqual(18);
  expect(iconBox!.height).toBeLessThanOrEqual(22);

  await expect(icon).toHaveCSS("display", "block");
  await expect(icon).toHaveCSS("object-fit", "contain");
};

const expectHeadMetadata = async (
  page: Page,
  path: string,
  canonicalUrl: string,
  schemaTypes: string[],
) => {
  await page.goto(path);

  await expect(page.locator(`head link[rel="canonical"]`)).toHaveAttribute(
    "href",
    canonicalUrl,
  );
  await expect(page.locator(`head meta[name="description"]`)).toHaveAttribute(
    "content",
    /.+/,
  );
  await expect(page.locator(`head meta[property="og:url"]`)).toHaveAttribute(
    "content",
    canonicalUrl,
  );
  await expect(
    page.locator(`head meta[name="twitter:description"]`),
  ).toHaveAttribute("content", /.+/);

  const structuredData = await page
    .locator(`head script[type="application/ld+json"]`)
    .textContent();
  expect(structuredData).not.toBeNull();
  const jsonLd = JSON.parse(structuredData!) as {
    "@graph": Array<{ "@type": string }>;
  };
  const graph = jsonLd["@graph"];
  expect(graph.map((entry: { "@type": string }) => entry["@type"])).toEqual(
    expect.arrayContaining(schemaTypes),
  );
};

const referenceLinkLabels = [
  "作者について",
  "ソースコード",
  "ライセンスに関して",
] as const;

const getReferenceLinkGaps = async (page: Page) =>
  page.evaluate((labels) => {
    const readTextRect = (container: Element, label: string) => {
      const labelElement = [
        ...container.querySelectorAll<HTMLElement>(".reference-link__label"),
      ].find((element) => element.textContent?.trim() === label);
      if (labelElement) return labelElement.getBoundingClientRect();

      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const start = node.textContent?.indexOf(label) ?? -1;
        if (start < 0) continue;

        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + label.length);
        return range.getBoundingClientRect();
      }

      throw new Error(`Reference link label was not found: ${label}`);
    };

    return Object.fromEntries(
      labels.map((label) => {
        const button = [
          ...document.querySelectorAll<HTMLElement>("a[aria-label]"),
        ].find((element) => element.getAttribute("aria-label") === label);
        const container = button?.parentElement;
        if (!button || !container) {
          throw new Error(`Reference link button was not found: ${label}`);
        }

        const buttonBox = button.getBoundingClientRect();
        const textBox = readTextRect(container, label);
        return [label, textBox.left - buttonBox.right];
      }),
    );
  }, referenceLinkLabels);

const getHeadingIconGap = async (page: Page, label: string) =>
  page.evaluate((label) => {
    const heading = [...document.querySelectorAll("h2")].find((element) =>
      element.textContent?.includes(label),
    );
    if (!heading) throw new Error(`Heading was not found: ${label}`);

    const icon = heading.querySelector(".v-icon");
    if (!icon) throw new Error(`Heading icon was not found: ${label}`);

    const labelElement = [
      ...heading.querySelectorAll<HTMLElement>(".section-heading__label"),
    ].find((element) => element.textContent?.trim() === label);
    let textBox: DOMRect;

    if (labelElement) {
      textBox = labelElement.getBoundingClientRect();
    } else {
      const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const start = node.textContent?.indexOf(label) ?? -1;
        if (start < 0) continue;

        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + label.length);
        textBox = range.getBoundingClientRect();
        const iconBox = icon.getBoundingClientRect();
        return textBox.left - iconBox.right;
      }

      throw new Error(`Heading label was not found: ${label}`);
    }

    const iconBox = icon.getBoundingClientRect();
    return textBox.left - iconBox.right;
  }, label);

const getHideAnswerButtonBox = async (page: Page) => {
  const box = await page.locator("#button-hide button").boundingBox();
  expect(box).not.toBeNull();
  return box!;
};

test.describe("SSG preview layout", () => {
  test("build output keeps home CSS, cards, and images on desktop", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/ja");

    await expect(
      page.locator('link[rel="stylesheet"][href*="/assets/"]'),
    ).toHaveCount(1);
    await expect(
      page.locator('script[type="module"][src*="/assets/app-"]'),
    ).toHaveCount(1);
    await expect(page.locator(".v-application")).toBeVisible();
    await expect(page.locator(".v-app-bar")).toBeVisible();
    await expect(page.locator("#termsOfUseTitle")).toHaveText("利用規約");

    const toolCard = page
      .getByRole("main")
      .getByRole("link", { name: /熟語パズル/ });
    await expect(toolCard).toBeVisible();
    await expectInsideViewport(toolCard, 1280);
    expect((await toolCard.boundingBox())!.width).toBeGreaterThan(600);
    const toolIcon = toolCard.locator('img[src="/img/jukugo/32.png"]');
    await expectLoadedImage(toolIcon);
    await expect(toolIcon).toHaveAttribute(
      "srcset",
      /\/img\/jukugo\/32\.png(?: 1x)?, \/img\/jukugo\/64\.png 2x/,
    );

    const creator = await page.getByText("作者について").boundingBox();
    const source = await page.getByText("ソースコード").boundingBox();
    const license = await page.getByText("ライセンスに関して").boundingBox();
    expect(creator).not.toBeNull();
    expect(source).not.toBeNull();
    expect(license).not.toBeNull();
    expect(Math.abs(creator!.y - source!.y)).toBeLessThan(12);
    expect(Math.abs(source!.y - license!.y)).toBeLessThan(12);
  });

  test("build output keeps mobile layout inside the viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ja");

    const toolCard = page.locator(".v-card").first();
    await expect(toolCard).toBeVisible();
    await expectInsideViewport(toolCard, 390);

    const creator = await page.getByText("作者について").boundingBox();
    const source = await page.getByText("ソースコード").boundingBox();
    const license = await page.getByText("ライセンスに関して").boundingBox();
    expect(creator).not.toBeNull();
    expect(source).not.toBeNull();
    expect(license).not.toBeNull();
    expect(source!.y).toBeGreaterThan(creator!.y);
    expect(license!.y).toBeGreaterThan(source!.y);
  });

  test("build output keeps jukugo board content and icon renderable", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/ja/jukugo");

    await expect(page.locator("h1")).toHaveText("熟語パズル");
    await expectLoadedImage(
      page.locator('img[src="/img/jukugo/32.png"]').first(),
    );
    await expect(page.locator("#input-top")).toBeVisible();
    await expect(page.locator("#input-left")).toBeVisible();
    await expect(page.locator("#answer")).toBeVisible();
    await expectInsideViewport(page.locator("table"), 1280);
  });

  test("build output exposes group roulette page and icon", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/ja");

    await expect(
      page.getByRole("main").getByRole("link", { name: /グループルーレット/ }),
    ).toBeVisible();

    await page.goto("/ja/group-roulette");
    await expect(page.locator("h1")).toHaveText("グループルーレット");
    await expectLoadedImage(
      page.locator('img[src="/img/group-roulette/32.png"]').first(),
    );
    await expect(
      page.getByRole("button", { name: "部屋を作る" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "部屋 URL を共有して、ルーレットに入れる項目から抽選結果まで全員の画面で同期できます。",
      ),
    ).toBeVisible();
    await expect(
      page.locator(".text-caption").filter({
        hasText:
          "追加した項目名、表示名、抽選履歴などの入力内容は、管理者確認用として一定期間保存されます。",
      }),
    ).toBeVisible();
    await expectInsideViewport(page.locator(".group-roulette-shell"), 1280);
  });

  test("group roulette creates a room and applies mocked polling option flow", async ({
    page,
  }) => {
    let activeOptions: Array<{ id: string; label: string; order: number }> = [];
    let joinRequests = 0;
    let status = "waiting";
    let currentSpin: Record<string, unknown> | null = null;
    const envelope = (payload: Record<string, unknown>, revision = 1) => ({
      protocolVersion: 1,
      tool: "group-roulette",
      type: "roomState",
      roomId: "room_abc",
      revision,
      serverTime: "2026-05-08T09:30:00.000Z",
      payload: {
        status,
        expiresAt: "2026-05-09T09:30:00Z",
        guestAddEnabled: true,
        activeOptions,
        currentSpin,
        ...payload,
      },
    });

    await page.route("**/v1/group-roulette/rooms", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        status: 201,
        body: JSON.stringify({
          ...envelope({
            member: {
              id: "member_1",
              displayName: "ホスト",
              role: "host",
            },
          }),
          hostToken: "host_secret",
        }),
      });
    });
    await page.route(
      "**/v1/group-roulette/rooms/room_abc/join",
      async (route) => {
        joinRequests += 1;
        await route.fulfill({
          contentType: "application/json",
          status: 200,
          body: JSON.stringify(
            envelope({
              member: {
                id: "member_1",
                displayName: "主催者",
                role: "host",
              },
            }),
          ),
        });
      },
    );
    await page.route(
      "**/v1/group-roulette/rooms/room_abc/state**",
      async (route) => {
        await route.fulfill({
          contentType: "application/json",
          status: 200,
          body: JSON.stringify(envelope({}, activeOptions.length + 1)),
        });
      },
    );
    await page.route(
      "**/v1/group-roulette/rooms/room_abc/options",
      async (route) => {
        const request = route.request().postDataJSON() as { label: string };
        activeOptions = [{ id: "option_1", label: request.label, order: 1 }];
        await route.fulfill({
          contentType: "application/json",
          status: 200,
          body: JSON.stringify(envelope({}, 2)),
        });
      },
    );
    await page.route(
      "**/v1/group-roulette/rooms/room_abc/spins/start",
      async (route) => {
        status = "spinning";
        currentSpin = {
          id: "spin_1",
          startedAt: "2026-05-08T09:30:00Z",
          durationMs: 5000,
          options: activeOptions,
        };
        await route.fulfill({
          contentType: "application/json",
          status: 200,
          body: JSON.stringify(envelope({}, 3)),
        });
      },
    );
    await page.route(
      "**/v1/group-roulette/rooms/room_abc/spins/stop",
      async (route) => {
        status = "stopping";
        currentSpin = {
          id: "spin_1",
          startedAt: "2026-05-08T09:30:00Z",
          durationMs: 5000,
          options: activeOptions,
          winnerOptionId: "option_1",
          stopAt: "2026-05-08T09:30:03Z",
        };
        await route.fulfill({
          contentType: "application/json",
          status: 200,
          body: JSON.stringify(envelope({}, 4)),
        });
      },
    );

    await page.goto("/ja/group-roulette");
    await page.getByRole("button", { name: "部屋を作る" }).click();
    await expect(page).toHaveURL(/roomId=room_abc/);
    await expect(
      page.getByRole("heading", { name: "準備中", level: 2 }),
    ).toBeVisible();
    expect(joinRequests).toBe(0);
    await expect(page.getByRole("button", { name: "入室する" })).toBeHidden();

    await page.getByLabel("項目名").fill("Pizza");
    await page.getByRole("button", { name: "項目を追加" }).click();

    await expect(
      page.getByLabel("ルーム操作").getByText("Pizza"),
    ).toBeVisible();
    await expect(
      page.locator(".roulette-wheel__label", { hasText: "Pizza" }),
    ).toBeVisible();
    await expect(page.getByText("ホスト").first()).toBeVisible();

    await page.getByRole("button", { name: "ルーレットを回す" }).click();
    await expect(
      page.getByRole("heading", { name: "ルーレット中", level: 2 }),
    ).toBeVisible();

    await page.getByRole("button", { name: "結果を出す" }).click();
    await expect(
      page.getByRole("heading", { name: "結果発表中", level: 2 }),
    ).toBeVisible();
    await expect(
      page.locator(".stage-outcome").getByText("結果", { exact: true }),
    ).toBeVisible();
  });

  test("group roulette redesign keeps the roulette stage as the desktop primary surface", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await mockGroupRouletteRoom(page);

    await page.goto("/ja/group-roulette");
    await page.getByRole("button", { name: "部屋を作る" }).click();
    await expect(
      page.getByText(
        "部屋 URL を共有して、ルーレットに入れる項目から抽選結果まで全員の画面で同期できます。",
      ),
    ).toBeVisible();
    await expect(
      page.getByText("項目を集めて、全員で同じルーレットを見ながら決めます。"),
    ).toBeHidden();

    const stage = page.locator(".group-roulette-stage");
    const rail = page.locator(".group-roulette-rail");
    await expect(stage).toBeVisible();
    await expect(rail).toBeVisible();
    await expect(stage.getByRole("heading", { name: "準備中" })).toBeVisible();
    await expect(
      stage.getByRole("button", { name: "ルーレットを回す" }),
    ).toBeVisible();

    const stageBox = await stage.boundingBox();
    const railBox = await rail.boundingBox();
    expect(stageBox).not.toBeNull();
    expect(railBox).not.toBeNull();
    expect(stageBox!.width).toBeGreaterThan(railBox!.width);
    await expect(page.getByText(/room_abc/)).toBeHidden();
    await expect(
      page.getByRole("button", { name: "共有 URL をコピー" }),
    ).toBeVisible();
  });

  test("group roulette guest room hides host-only spin controls", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockGroupRouletteRoom(page, {
      joinMember: {
        id: "member_guest",
        displayName: "ゲスト1",
        role: "guest",
      },
    });

    await page.goto("/ja/group-roulette?roomId=room_abc");
    await page.getByLabel("表示名（任意）").fill("ゲスト1");
    await page.getByRole("button", { name: "入室する" }).click();

    await expect(page.getByText("ホストの開始を待っています")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "ルーレットを回す" }),
    ).toBeHidden();
    await expect(page.getByRole("button", { name: "結果を出す" })).toBeHidden();
    await expectInsideViewport(page.locator(".group-roulette-shell"), 390);
  });

  test("group roulette result is announced as the central stage outcome", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await mockGroupRouletteRoom(page);

    await page.goto("/ja/group-roulette");
    await page.getByRole("button", { name: "部屋を作る" }).click();
    for (const label of ["Pizza", "寿司", "掃除当番", "旅行先", "ランチ"]) {
      await page.getByLabel("項目名").fill(label);
      await page.getByRole("button", { name: "項目を追加" }).click();
    }

    await expect(page.locator(".roulette-wheel__label")).toContainText([
      "Pizza",
      "寿司",
      "掃除当番",
      "旅行先",
      "ランチ",
    ]);
    await expect(
      page.locator(".roulette-wheel__label-character").first(),
    ).toBeVisible();
    await expect(
      page.locator(".roulette-wheel__label-character").first(),
    ).toHaveAttribute("style", /--label-character-rotation: 180deg/);
    await expect(
      page.locator(".roulette-wheel__label-character").first(),
    ).toHaveAttribute(
      "style",
      /--label-character-offset: calc\(100% - var\(--label-edge-margin\) - 0em\)/,
    );
    await expect(page.locator(".roulette-wheel__separator")).toHaveCount(5);
    await expectWheelLabelsInsideWheel(page);

    await page.getByRole("button", { name: "ルーレットを回す" }).click();
    await page.getByRole("button", { name: "結果を出す" }).click();

    const outcome = page.locator("[aria-live='polite']").filter({
      hasText: "結果",
    });
    await expect(outcome).toBeVisible();
    await expect(outcome).toContainText("寿司");
    await expect(page.locator(".roulette-wheel__center")).toHaveText("");
    const outcomeBox = await outcome.boundingBox();
    const wheelBox = await page.locator(".roulette-wheel").boundingBox();
    expect(outcomeBox).not.toBeNull();
    expect(wheelBox).not.toBeNull();
    expect(outcomeBox!.width).toBeGreaterThan(wheelBox!.width * 0.45);
  });

  test("group roulette wheel labels stay inside the wheel on mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockGroupRouletteRoom(page);

    await page.goto("/ja/group-roulette");
    await page.getByRole("button", { name: "部屋を作る" }).click();
    for (const label of [
      "Pizza",
      "寿司",
      "掃除当番",
      "旅行先",
      "ランチ",
      "とても長い項目名のサンプルですです",
      "会議室",
      "映画",
    ]) {
      await page.getByLabel("項目名").fill(label);
      await page.getByRole("button", { name: "項目を追加" }).click();
    }

    await expect(page.locator(".roulette-wheel__label")).toContainText([
      "Pizza",
      "寿司",
      "掃除当番",
      "旅行先",
      "ランチ",
    ]);
    await expect(
      page.locator(".roulette-wheel__label-character").first(),
    ).toBeVisible();
    await expect(
      page.locator(".roulette-wheel__label-character").first(),
    ).toHaveAttribute("style", /--label-character-rotation: 180deg/);
    await expect(
      page.locator(".roulette-wheel__label", { hasText: "..." }),
    ).toBeVisible();
    await expectInsideViewport(page.locator(".roulette-wheel"), 390);
    await expectWheelLabelsInsideWheel(page);
  });

  test("group roulette option add shows a loading state while the request is pending", async ({
    page,
  }) => {
    await mockGroupRouletteRoom(page, {
      addOptionDelayMs: 500,
    });

    await page.goto("/ja/group-roulette");
    await page.getByRole("button", { name: "部屋を作る" }).click();

    await page.getByLabel("項目名").fill("Pizza");
    const addButton = page.getByRole("button", { name: "項目を追加" });
    await addButton.click();

    await expect(page.getByLabel("項目名")).toBeDisabled();
    await expect(addButton).toHaveClass(/v-btn--loading/);
    await expect(
      page.locator(".group-roulette-option-editor .v-progress-circular"),
    ).toBeVisible();
    await expect(
      page.locator(".roulette-wheel__label", { hasText: "Pizza" }),
    ).toBeVisible();
  });

  test("build output keeps share button icons contained on desktop and mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/ja");
    await expectShareButtonIconContained(
      page.getByRole("button", { name: /share/i }).first(),
    );

    await page.goto("/ja/jukugo");
    await expectShareButtonIconContained(
      page.getByRole("button", { name: /share/i }).last(),
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ja");
    await expectShareButtonIconContained(
      page.getByRole("button", { name: /share/i }).first(),
    );

    await page.goto("/ja/jukugo");
    await expectShareButtonIconContained(
      page.getByRole("button", { name: /share/i }).last(),
    );
  });

  test("build output exposes AIO metadata and crawler hints", async ({
    page,
    request,
  }) => {
    await expectHeadMetadata(page, "/ja", "https://tools.mcre.info/ja/", [
      "WebSite",
    ]);
    await expectHeadMetadata(
      page,
      "/ja/jukugo",
      "https://tools.mcre.info/ja/jukugo",
      ["WebSite", "WebApplication", "BreadcrumbList"],
    );

    const llms = await request.get("/llms.txt");
    expect(llms.ok()).toBe(true);
    const llmsText = await llms.text();
    expect(llmsText).toContain("https://tools.mcre.info/ja/jukugo");

    const robots = await request.get("/robots.txt");
    expect(robots.ok()).toBe(true);
    const robotsText = await robots.text();
    expect(robotsText).toContain("User-agent: OAI-SearchBot");
    expect(robotsText).toContain("User-agent: ChatGPT-User");
    expect(robotsText).toContain("User-agent: GPTBot");
  });

  test("build output exposes accessible names for icon-only controls", async ({
    page,
  }) => {
    await page.goto("/ja");

    await expect(page.getByRole("link", { name: /MCRE TOOLS/ })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "表示言語を変更" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "作者について" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "ソースコード" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "ライセンスに関して" }),
    ).toBeVisible();

    await page.goto("/ja/jukugo");
    await expect(
      page.getByRole("button", { name: "矢印の向きを切り替える" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "答えを隠す" }),
    ).toBeVisible();
    await page.locator("#input-top").fill("長");
    await expect(
      page.getByRole("button", { name: "入力をリセット" }),
    ).toBeVisible();
  });

  test("reference link icon gaps match before and after hydration", async ({
    baseURL,
    browser,
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/ja/");
    const hydratedGaps = await getReferenceLinkGaps(page);

    const noScriptContext = await browser.newContext({
      baseURL,
      javaScriptEnabled: false,
      viewport: { width: 1280, height: 720 },
    });
    const noScriptPage = await noScriptContext.newPage();
    await noScriptPage.goto("/ja/");
    const ssgGaps = await getReferenceLinkGaps(noScriptPage);
    await noScriptContext.close();

    for (const label of referenceLinkLabels) {
      expect(hydratedGaps[label]).toBeGreaterThanOrEqual(7.5);
      expect(hydratedGaps[label]).toBeLessThanOrEqual(8.5);
      expect(
        Math.abs(hydratedGaps[label] - ssgGaps[label]),
      ).toBeLessThanOrEqual(0.5);
    }
  });

  test("reference heading icon gap matches before and after hydration", async ({
    baseURL,
    browser,
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/ja/");
    const hydratedGap = await getHeadingIconGap(page, "参考情報");

    const noScriptContext = await browser.newContext({
      baseURL,
      javaScriptEnabled: false,
      viewport: { width: 1280, height: 720 },
    });
    const noScriptPage = await noScriptContext.newPage();
    await noScriptPage.goto("/ja/");
    const ssgGap = await getHeadingIconGap(noScriptPage, "参考情報");
    await noScriptContext.close();

    expect(hydratedGap).toBeGreaterThanOrEqual(7.5);
    expect(hydratedGap).toBeLessThanOrEqual(8.5);
    expect(Math.abs(hydratedGap - ssgGap)).toBeLessThanOrEqual(0.5);
  });

  test("jukugo hide-answer button position matches before and after hydration", async ({
    baseURL,
    browser,
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ja/jukugo/");
    await expect(page.locator("#button-hide .v-fab")).toBeVisible();
    await expect(page.locator("#button-reset .v-fab")).toBeAttached();
    const hydratedBox = await getHideAnswerButtonBox(page);

    const noScriptContext = await browser.newContext({
      baseURL,
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
    const noScriptPage = await noScriptContext.newPage();
    await noScriptPage.goto("/ja/jukugo/");
    const ssgBox = await getHideAnswerButtonBox(noScriptPage);
    await noScriptContext.close();

    expect(Math.abs(hydratedBox.x - ssgBox.x)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(hydratedBox.y - ssgBox.y)).toBeLessThanOrEqual(0.5);
  });

  test("build preview exposes query-specific large OGP metadata after hydration", async ({
    page,
  }) => {
    await page.goto("/ja/jukugo?t=%E9%95%B7&a=%E8%80%81");

    await expect
      .poll(async () => {
        const currentPath = await page.evaluate(
          () => window.location.pathname + window.location.search,
        );
        const ogUrl = await page
          .locator(`head meta[property="og:url"]`)
          .getAttribute("content");
        const ogImage = await page
          .locator(`head meta[property="og:image"]`)
          .getAttribute("content");

        return (
          ogUrl === `https://tools.mcre.info${currentPath}` &&
          ogImage === `https://tools-ogp.mcre.info${currentPath}`
        );
      })
      .toBe(true);
    await expect(
      page.locator(`head meta[name="twitter:card"]`),
    ).toHaveAttribute("content", "summary_large_image");
  });
});
