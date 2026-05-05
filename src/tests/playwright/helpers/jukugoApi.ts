import type { Page } from "@playwright/test";

const generateCharacters = (count: number, start: number) =>
  Array.from({ length: count }, (_, index) =>
    String.fromCodePoint(start + index),
  );

const makeResults = (characters: string[]) =>
  characters.map((character, index) => ({
    character,
    cost: index + 1,
  }));

const list3 = ["老", "本", "林"];
const list22 = [...list3, ...generateCharacters(19, 0x53_00)];
const list150 = ["野", ...list22, ...generateCharacters(127, 0x54_00)];
const list489 = ["崎", ...list150, ...generateCharacters(338, 0x55_00)];

const jukugoFixtures: Record<string, { character: string; cost: number }[]> = {
  "化-left": makeResults(list22),
  "海-right": makeResults(list150),
  "舗-left": makeResults(list3),
  "長-right": makeResults(list489),
  "近-right": makeResults(["海", "洋"]),
  "近-left": makeResults(["国", "海", "洋"]),
  "禁-left": makeResults(["国", "海", "洋"]),
  "原-left": makeResults(["国", "海", "洋"]),
  "運-left": makeResults(["国", "海", "洋"]),
  "禁-right": makeResults(["甲"]),
  "原-right": makeResults(["乙"]),
  "運-right": makeResults(["丙"]),
};

export const mockJukugoApi = async (page: Page) => {
  await page.route("**/v1/jukugo/*/*-search", async (route) => {
    const url = new URL(route.request().url());
    const match = url.pathname.match(
      /\/v1\/jukugo\/([^/]+)\/(left|right)-search$/,
    );
    const character = decodeURIComponent(match?.[1] ?? "");
    const direction = match?.[2] ?? "";
    const body = jukugoFixtures[`${character}-${direction}`] ?? [];
    await route.fulfill({ json: body });
  });
};
