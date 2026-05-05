import type { JukugoSearchResponse } from "@/apis/@types";

export const jukugoPositions = ["top", "bottom", "left", "right"] as const;

export type JukugoPosition = (typeof jukugoPositions)[number];
export type JukugoInputs = Record<JukugoPosition, string>;
export type JukugoArrows = Record<JukugoPosition, boolean>;

export type JukugoAnswer = {
  character: string;
  cost: number;
  costs: Partial<Record<JukugoPosition, number>>;
};

export type JukugoSolveState = {
  inputs: JukugoInputs;
  arrows: JukugoArrows;
};

export type JukugoQueryState = JukugoSolveState & {
  answers: JukugoAnswer[];
  hideAnswer: boolean;
  loading: boolean;
  selectedAnswerId: number;
};

export type JukugoSearch = (
  character: string,
  rightSearch: boolean,
) => Promise<JukugoSearchResponse>;

const queryKeys: Record<JukugoPosition, string> = {
  bottom: "b",
  left: "l",
  right: "r",
  top: "t",
};

const arrowQueryKeys: Record<JukugoPosition, string> = {
  bottom: "ab",
  left: "al",
  right: "ar",
  top: "at",
};

const isSingleKanji = (value: unknown) => {
  return typeof value === "string" && /^[\u4E00-\u9FAF]$/.test(value);
};

const isModified = (state: JukugoSolveState) => {
  return (
    Object.values(state.inputs).some((input) => input !== "") ||
    Object.values(state.arrows).some((arrow) => !arrow)
  );
};

export const createJukugoSolver = (
  search: JukugoSearch,
  isKanji: (value: unknown) => boolean = isSingleKanji,
) => {
  const cache: Record<string, JukugoSearchResponse> = {};
  const inProgress = new Set<string>();

  const getResult = async (character: string, rightSearch: boolean) => {
    const key = `${character}-${rightSearch}`;
    if (!cache[key] && !inProgress.has(key)) {
      inProgress.add(key);
      try {
        cache[key] = await search(character, rightSearch);
      } finally {
        inProgress.delete(key);
      }
    }
    return cache[key] ?? [];
  };

  const solve = async (state: JukugoSolveState) => {
    const resultSets = (
      await Promise.all(
        jukugoPositions.map(async (position) => {
          const input = state.inputs[position];
          const arrow = state.arrows[position];
          const results = isKanji(input) ? await getResult(input, arrow) : [];
          return { position, results };
        }),
      )
    ).filter(({ results }) => results.length > 0);

    if (resultSets.length === 0) {
      return { answers: [] as JukugoAnswer[] };
    }

    const commonResults = resultSets.reduce((common, { results }) => {
      const currentCharacters = new Set(results.map((res) => res.character));
      return common.filter((item) => currentCharacters.has(item.character));
    }, resultSets[0].results);

    const answers = commonResults
      .map((item) => {
        const costs = resultSets.reduce(
          (obj, { position, results }) => {
            obj[position] =
              results.find((res) => res.character === item.character)?.cost ??
              0;
            return obj;
          },
          {} as Partial<Record<JukugoPosition, number>>,
        );

        return {
          character: item.character,
          cost: Object.values(costs).reduce((sum, cost) => sum + cost, 0),
          costs,
        };
      })
      .toSorted((a, b) => a.cost - b.cost);

    return { answers };
  };

  const toQuery = (state: JukugoQueryState) => {
    const query: Record<string, string> = {};

    for (const position of jukugoPositions) {
      const input = state.inputs[position];
      if (isKanji(input)) {
        query[queryKeys[position]] = input;
      }
      if (!state.arrows[position]) {
        query[arrowQueryKeys[position]] = "0";
      }
    }

    if (state.selectedAnswerId > 0) {
      query.id = state.selectedAnswerId.toString();
    }

    if (state.hideAnswer) {
      query.h = "1";
    }

    if (isModified(state) && !state.loading && !state.hideAnswer) {
      query.a = state.answers[state.selectedAnswerId]?.character ?? "×";
    }

    return query;
  };

  return {
    solve,
    toQuery,
  };
};
