<template>
  <v-container v-if="dayjs().isBefore('2024-12-31')">
    <v-row>
      <v-col cols="12">
        <v-alert variant="tonal" color="primary" density="comfortable">
          こちらは「熟語パズル」の新しいサイトです。<br />
          旧サイトから転送されてきた場合は、ブックマークの変更をお願いします。
        </v-alert>
      </v-col>
    </v-row>
  </v-container>
  <v-container>
    <v-row class="align-center">
      <v-col cols="auto">
        <v-avatar image="/img/jukugo_32.png" size="32" />
      </v-col>
      <v-col>
        <h1>熟語パズル</h1>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12">
        <p>
          上下左右4つの漢字から真ん中の漢字を当てるパズル、いわゆる「和同開珎」を自動で解くツールです。
        </p>
        <p class="text-caption">
          <span class="text-decoration-underline">矢印</span>
          はタップすると逆向きに変更できます。
        </p>
      </v-col>
    </v-row>
  </v-container>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" sm="8" md="6" class="text-end ma-0">
        <v-chip>
          {{ !isModified || loading ? "-" : answers.length }} 候補
        </v-chip>
      </v-col>
    </v-row>
  </v-container>
  <v-container>
    <v-row justify="center">
      <v-col cols="auto">
        <table>
          <tr>
            <td></td>
            <td></td>
            <td>
              <jukugo-character-field
                v-model="inputs.top"
                @compositionend="fetchData"
              />
            </td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td></td>
            <td></td>
            <td>
              <jukugo-arrow-button
                v-model="arrows.top"
                forward="down"
                reverse="up"
                @update:modelValue="fetchData"
              />
            </td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td>
              <jukugo-character-field
                v-model="inputs.left"
                @compositionend="fetchData"
              />
            </td>
            <td>
              <jukugo-arrow-button
                v-model="arrows.left"
                forward="right"
                reverse="left"
                @update:modelValue="fetchData"
              />
            </td>
            <td>
              <v-text-field
                :value="selectedAnswer"
                class="centered-input"
                placeholder="？"
                maxlength="1"
                variant="solo"
                hide-details
                readonly
                tabindex="-1"
                :loading="loading"
              />
            </td>
            <td>
              <jukugo-arrow-button
                v-model="arrows.right"
                forward="left"
                reverse="right"
                @update:modelValue="fetchData"
              />
            </td>
            <td>
              <jukugo-character-field
                v-model="inputs.right"
                @compositionend="fetchData"
              />
            </td>
          </tr>
          <tr>
            <td></td>
            <td></td>
            <td>
              <jukugo-arrow-button
                v-model="arrows.bottom"
                forward="up"
                reverse="down"
                @update:modelValue="fetchData"
              />
            </td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td></td>
            <td></td>
            <td>
              <jukugo-character-field
                v-model="inputs.bottom"
                @compositionend="fetchData"
              />
            </td>
            <td></td>
            <td></td>
          </tr>
        </table>
      </v-col>
    </v-row>
  </v-container>
  <v-container v-if="isModified">
    <v-row justify="center">
      <v-col cols="12" sm="8" md="6">
        <v-list-item>
          <template v-slot:prepend>
            <v-avatar size="40">
              <v-icon>mdi-help-box-outline</v-icon>
            </v-avatar>
          </template>
          <v-row>
            <v-col cols="3" class="text-center">
              <v-icon>mdi-gamepad-circle-up</v-icon>
            </v-col>
            <v-col cols="3" class="text-center">
              <v-icon>mdi-gamepad-circle-right</v-icon>
            </v-col>
            <v-col cols="3" class="text-center">
              <v-icon>mdi-gamepad-circle-down</v-icon>
            </v-col>
            <v-col cols="3" class="text-center">
              <v-icon>mdi-gamepad-circle-left</v-icon>
            </v-col>
          </v-row>
        </v-list-item>
        <v-virtual-scroll :height="300" item-height="50" :items="answers">
          <template v-slot:default="{ item, index }">
            <v-list-item
              @click="
                selectedAnswerId = index;
                updateQueryString();
              "
              :active="selectedAnswerId === index"
              v-if="!loading"
            >
              <template v-slot:prepend>
                <v-avatar size="40">
                  {{ item.character }}
                </v-avatar>
              </template>
              <v-row>
                <v-col cols="3" class="text-center">
                  <span v-if="inputs.top && util.isKanji(inputs.top)">
                    {{
                      arrows.top
                        ? `${inputs.top}${item.character}`
                        : `${item.character}${inputs.top}`
                    }}
                  </span>
                </v-col>
                <v-col cols="3" class="text-center">
                  <span v-if="inputs.right && util.isKanji(inputs.right)">
                    {{
                      arrows.right
                        ? `${inputs.right}${item.character}`
                        : `${item.character}${inputs.right}`
                    }}
                  </span>
                </v-col>
                <v-col cols="3" class="text-center">
                  <span v-if="inputs.bottom && util.isKanji(inputs.bottom)">
                    {{
                      arrows.bottom
                        ? `${inputs.bottom}${item.character}`
                        : `${item.character}${inputs.bottom}`
                    }}
                  </span>
                </v-col>
                <v-col cols="3" class="text-center">
                  <span v-if="inputs.left && util.isKanji(inputs.left)">
                    {{
                      arrows.left
                        ? `${inputs.left}${item.character}`
                        : `${item.character}${inputs.left}`
                    }}
                  </span>
                </v-col>
              </v-row>
            </v-list-item>
          </template>
        </v-virtual-scroll>
      </v-col>
    </v-row>
  </v-container>
  <v-fab
    :active="isModified"
    icon="mdi-eraser"
    @click="resetInputs"
    app
    location="bottom end"
  />
</template>

<script lang="ts" setup>
import { useUtil } from "@/composables/util";
import JukugoCharacterField from "@/components/JukugoCharacterField.vue";
import JukugoArrowButton from "@/components/JukugoArrowButton.vue";

import aspida from "@aspida/fetch";
import api from "@/apis/$api";
import { JukugoSearchResponse } from "@/apis/@types/index";

import dayjs from "dayjs";

const route = useRoute();
const router = useRouter();

const util = useUtil();
util.setTitle(
  "熟語パズル",
  "jukugo",
  "上下左右4つの漢字から真ん中の漢字を当てるパズル、いわゆる「和同開珎」を自動で解くツールです。"
);

let initializing = true;
const loading = computed(() => inProgress.value.size > 0);
const positions = ["top", "bottom", "left", "right"] as const;
const inputs = ref(Object.fromEntries(positions.map((pos) => [pos, ""])));
const arrows = ref(Object.fromEntries(positions.map((pos) => [pos, true])));
const selectedAnswerId = ref(0);
const answers = ref<
  {
    character: string;
    cost: number;
    costs: {
      [key in (typeof positions)[number]]?: number;
    };
  }[]
>([]);

const selectedAnswer = computed(() => {
  if (loading.value) return "";
  if (answers.value.length <= 0) {
    if (isModified.value) return "×";
    else return "";
  }
  if (isModified.value && answers.value.length <= 0) return "×";
  return answers.value[selectedAnswerId.value].character;
});

const isModified = computed(() => {
  const hasInput = Object.values(inputs.value).some((input) => input !== "");
  const arrowsChanged = Object.values(arrows.value).some((arrow) => !arrow);
  return hasInput || arrowsChanged;
});

const resetInputs = () => {
  inputs.value = Object.fromEntries(positions.map((pos) => [pos, ""]));
  arrows.value = Object.fromEntries(positions.map((pos) => [pos, true]));
  answers.value = [];
  selectedAnswerId.value = 0;
  router.push({ query: {} });
};

const baseURL = `https://${import.meta.env.VITE_API_DOMAIN_NAME}`;
const apiClient = api(aspida(fetch, { baseURL }));
const apiResults: Record<string, JukugoSearchResponse> = {};
const inProgress = ref(new Set<string>());

const fetchData = () => {
  if (!initializing) selectedAnswerId.value = 0;
  updateQueryString();
  positions.forEach(async (pos) => {
    const input = inputs.value[pos];
    const arrow = arrows.value[pos];

    if (input && util.isKanji(input)) {
      const key = `${input}-${arrow}`;

      if (!apiResults[key] && !inProgress.value.has(key)) {
        inProgress.value.add(key);
        const direction = arrow ? "right_search" : "left_search";

        try {
          const result: JukugoSearchResponse = await apiClient.v1.jukugo
            ._character(input)
            [direction].$get();
          apiResults[key] = result;
          updateAnswers();
        } catch (error) {
          console.error(`${pos}のfetchに失敗`);
        } finally {
          inProgress.value.delete(key);
        }
      } else {
        updateAnswers();
      }
    }
  });
};

const updateAnswers = () => {
  const resultSets = positions
    .map((position) => {
      const input = inputs.value[position];
      const arrow = arrows.value[position];
      const key = `${input}-${arrow}`;
      return { position, results: apiResults[key] || [] };
    })
    .filter(({ results }) => results.length > 0);

  if (resultSets.length === 0) {
    answers.value = [];
    return;
  }

  const commonResults = resultSets.reduce((common, { results }) => {
    const currentCharacters = new Set(results.map((res) => res.character));
    return common.filter((item) => currentCharacters.has(item.character));
  }, resultSets[0].results);

  answers.value = commonResults
    .map((item) => {
      const costs = resultSets.reduce((obj, { position, results }) => {
        const cost =
          results.find((res) => res.character === item.character)?.cost || 0;
        obj[position] = cost;
        return obj;
      }, {} as { [key in (typeof positions)[number]]?: number });

      const totalCost = Object.values(costs).reduce(
        (sum, cost) => sum + (cost || 0),
        0
      );

      return {
        character: item.character,
        costs,
        cost: totalCost,
      };
    })
    .sort((a, b) => a.cost - b.cost);

  if (answers.value.length === 0) {
    answers.value = [];
  }
};

const updateQueryString = () => {
  const query: Record<string, string> = {};

  if (util.isKanji(inputs.value.top)) query.t = inputs.value.top;
  if (util.isKanji(inputs.value.right)) query.r = inputs.value.right;
  if (util.isKanji(inputs.value.bottom)) query.b = inputs.value.bottom;
  if (util.isKanji(inputs.value.left)) query.l = inputs.value.left;

  if (!arrows.value.top) query.at = "0";
  if (!arrows.value.right) query.ar = "0";
  if (!arrows.value.bottom) query.ab = "0";
  if (!arrows.value.left) query.al = "0";

  if (initializing && route.query.id) {
    query.id = route.query.id.toString();
  } else {
    if (selectedAnswerId.value && selectedAnswerId.value != 0)
      query.id = selectedAnswerId.value.toString();
  }

  router.push({ query });
};

const initializeFromQueryString = () => {
  inputs.value.top = util.isKanji(route.query.t)
    ? route.query.t?.toString() || ""
    : "";
  inputs.value.right = util.isKanji(route.query.r)
    ? route.query.r?.toString() || ""
    : "";
  inputs.value.bottom = util.isKanji(route.query.b)
    ? route.query.b?.toString() || ""
    : "";
  inputs.value.left = util.isKanji(route.query.l)
    ? route.query.l?.toString() || ""
    : "";

  arrows.value.top = route.query.at === "0" ? false : true;
  arrows.value.right = route.query.ar === "0" ? false : true;
  arrows.value.bottom = route.query.ab === "0" ? false : true;
  arrows.value.left = route.query.al === "0" ? false : true;

  fetchData();

  const unwatch = watch(loading, (newVal) => {
    if (!newVal) {
      initializing = false;
      const id = Number(route.query.id);
      if (!isNaN(id) && id < answers.value.length) {
        selectedAnswerId.value = id;
      } else {
        selectedAnswerId.value = 0;
      }
      updateQueryString();
      unwatch();
    }
  });
};

onMounted(() => {
  initializeFromQueryString();
});
</script>

<style scoped>
table td {
  text-align: center;
  vertical-align: middle;
}
</style>
