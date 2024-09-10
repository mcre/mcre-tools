<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <v-alert type="info" title="開発中" variant="outlined" />
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
        <p><b>矢印</b>をタップすると逆向きになります。</p>
      </v-col>
    </v-row>
  </v-container>
  <v-container>
    <v-row justify="center">
      <v-col cols="12">
        <table>
          <tr>
            <td></td>
            <td></td>
            <td>
              <v-text-field
                v-model="inputs.top"
                placeholder="漢"
                maxlength="1"
                variant="outlined"
                hide-details
                @input="fetchData"
              />
            </td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td></td>
            <td></td>
            <td>
              <v-btn
                :icon="
                  arrows.top ? 'mdi-arrow-down-thick' : 'mdi-arrow-up-thick'
                "
                @click="toggleArrow('top')"
                variant="text"
                tabindex="-1"
              />
            </td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td>
              <v-text-field
                v-model="inputs.left"
                placeholder="力"
                maxlength="1"
                variant="outlined"
                hide-details
                @input="fetchData"
              />
            </td>
            <td>
              <v-btn
                :icon="
                  arrows.left ? 'mdi-arrow-right-thick' : 'mdi-arrow-left-thick'
                "
                @click="toggleArrow('left')"
                variant="text"
                tabindex="-1"
              />
            </td>
            <td>
              <v-text-field
                :value="loading ? '' : answers[0] || ''"
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
              <v-btn
                :icon="
                  arrows.right
                    ? 'mdi-arrow-left-thick'
                    : 'mdi-arrow-right-thick'
                "
                @click="toggleArrow('right')"
                variant="text"
                tabindex="-1"
              />
            </td>
            <td>
              <v-text-field
                v-model="inputs.right"
                placeholder="字"
                maxlength="1"
                variant="outlined"
                hide-details
                @input="fetchData"
              />
            </td>
          </tr>
          <tr>
            <td></td>
            <td></td>
            <td>
              <v-btn
                :icon="
                  arrows.bottom ? 'mdi-arrow-up-thick' : 'mdi-arrow-down-thick'
                "
                @click="toggleArrow('bottom')"
                variant="text"
                tabindex="-1"
              />
            </td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td></td>
            <td></td>
            <td>
              <v-text-field
                v-model="inputs.bottom"
                placeholder="入"
                maxlength="1"
                variant="outlined"
                hide-details
                @input="fetchData"
              />
            </td>
            <td></td>
            <td></td>
          </tr>
        </table>
      </v-col>
    </v-row>
  </v-container>
  <v-container>
    <v-row justify="center">
      <v-col cols="12">
        <v-btn @click="resetInputs">リセット</v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts" setup>
import { ref, computed } from "vue";
import { useUtil } from "@/composables/util";

import aspida from "@aspida/fetch";
import api from "@/apis/$api";
import { JukugoSearchResponse } from "@/apis/@types/index";

const util = useUtil();
util.setTitle(
  "熟語パズル",
  "jukugo",
  "上下左右4つの漢字から真ん中の漢字を当てるパズル、いわゆる「和同開珎」を自動で解くツールです。"
);

const loading = computed(() => inProgress.value.size > 0);
const positions = ["top", "bottom", "left", "right"] as const;
const inputs = ref(Object.fromEntries(positions.map((pos) => [pos, ""])));
const arrows = ref(Object.fromEntries(positions.map((pos) => [pos, true])));
const answers = ref<string[]>([]);

const resetInputs = () => {
  inputs.value = Object.fromEntries(positions.map((pos) => [pos, ""]));
  arrows.value = Object.fromEntries(positions.map((pos) => [pos, true]));
  answers.value = [];
};

const toggleArrow = (position: (typeof positions)[number]) => {
  arrows.value[position] = !arrows.value[position];
  fetchData();
};

const baseURL = `https://${import.meta.env.VITE_API_DOMAIN_NAME}`;
const apiClient = api(aspida(fetch, { baseURL }));
const apiResults: Record<string, JukugoSearchResponse> = {};
const inProgress = ref(new Set<string>());

const fetchData = () => {
  positions.forEach(async (pos) => {
    const input = inputs.value[pos];
    const arrow = arrows.value[pos];

    if (input && /^[\u4E00-\u9FFF]$/.test(input)) {
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
    .map((pos) => {
      const input = inputs.value[pos];
      const arrow = arrows.value[pos];
      const key = `${input}-${arrow}`;
      return apiResults[key] || [];
    })
    .filter((set) => set.length > 0);

  if (resultSets.length === 0) {
    answers.value = [];
    return;
  }

  let commonResults = resultSets[0];

  for (let i = 1; i < resultSets.length; i++) {
    commonResults = commonResults.filter((item) =>
      resultSets[i].some((res) => res.character === item.character)
    );
  }

  answers.value = commonResults
    .map((item) => ({
      character: item.character,
      cost: resultSets.reduce(
        (sum, set) =>
          sum +
          (set.find((res) => res.character === item.character)?.cost || 0),
        0
      ),
    }))
    .sort((a, b) => a.cost - b.cost)
    .map((item) => item.character);

  if (answers.value.length === 0) {
    answers.value = [];
  }
};
</script>
