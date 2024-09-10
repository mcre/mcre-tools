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
                v-model="selectedAnswer"
                placeholder="？"
                maxlength="1"
                variant="solo"
                hide-details
                readonly
                tabindex="-1"
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
import { ref } from "vue";
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

const baseURL = `https://${import.meta.env.VITE_API_DOMAIN_NAME}`;
const apiClient = api(aspida(fetch, { baseURL }));
const apiResults = ref<JukugoSearchResponse[]>([]);

const positions = ["top", "bottom", "left", "right"] as const;
const inputs = ref(Object.fromEntries(positions.map((pos) => [pos, ""])));
const arrows = ref(Object.fromEntries(positions.map((pos) => [pos, true])));
const answers = ref([]);
const selectedAnswer = ref("");
const loading = ref(false);

const fetchData = async () => {
  try {
    loading.value = true;
    if (inputs.value.left) {
      if (arrows.value.left) {
        const result = await apiClient.v1.jukugo
          ._character(inputs.value.left)
          .right_search.$get();
        console.log(result);
      } else {
        const result = await apiClient.v1.jukugo
          ._character(inputs.value.left)
          .left_search.$get();
        console.log(result);
      }
    }
  } catch (err) {
    console.error("fetchに失敗");
  } finally {
    loading.value = false;
  }

  /*
  const response = await fetch("/api/solve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      top: inputs.value.top,
      bottom: inputs.value.bottom,
      left: inputs.value.left,
      right: inputs.value.right,
      arrows: arrows.value,
    }),
  });

  const result = await response.json();
  answers.value = result.answers;
  selectedAnswer.value = result.answers[0]?.char || "？";
  */
};

const toggleArrow = (position: (typeof positions)[number]) => {
  arrows.value[position] = !arrows.value[position];
  fetchData();
};

const resetInputs = () => {
  inputs.value = Object.fromEntries(positions.map((pos) => [pos, ""]));
  arrows.value = Object.fromEntries(positions.map((pos) => [pos, true]));
  answers.value = [];
};
</script>
