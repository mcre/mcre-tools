<template>
  <v-container v-if="dayjs().isBefore('2024-12-31')">
    <v-row>
      <v-col cols="12">
        <v-alert color="primary" density="comfortable" variant="tonal">
          <span v-html="$t(`tools.${tool}.transitionNotice`)" />
        </v-alert>
      </v-col>
    </v-row>
  </v-container>

  <v-container>
    <v-row class="align-center">
      <v-col cols="auto">
        <v-avatar size="32">
          <img alt="" height="32" :src="`/img/${tool}/32.png`" width="32" />
        </v-avatar>
      </v-col>

      <v-col>
        <h1>{{ $t(`tools.${tool}.title`) }}</h1>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <p>
          {{ $t(`tools.${tool}.description`) }}
        </p>

        <p class="text-caption" v-html="$t(`tools.${tool}.arrowDescription`)" />
      </v-col>
    </v-row>
  </v-container>

  <v-container>
    <v-row justify="center">
      <v-col cols="auto">
        <table>
          <tbody>
            <tr>
              <td></td>
              <td></td>

              <td>
                <jukugo-character-field
                  id="input-top"
                  v-model="inputs.top"
                  @input="fetchData"
                  @update:typing="typing = $event"
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
                  id="arrow-top"
                  v-model="arrows.top"
                  forward="down"
                  reverse="up"
                  @update:model-value="fetchData"
                />
              </td>

              <td></td>
              <td></td>
            </tr>

            <tr>
              <td>
                <jukugo-character-field
                  id="input-left"
                  v-model="inputs.left"
                  @input="fetchData"
                  @update:typing="typing = $event"
                />
              </td>

              <td>
                <jukugo-arrow-button
                  id="arrow-left"
                  v-model="arrows.left"
                  forward="right"
                  reverse="left"
                  @update:model-value="fetchData"
                />
              </td>

              <td>
                <v-text-field
                  v-show="!hideAnswer"
                  id="answer"
                  class="centered-input"
                  hide-details
                  :loading="loading"
                  maxlength="1"
                  readonly
                  tabindex="-1"
                  :value="loading ? '' : selectedAnswer"
                  variant="solo"
                />

                <v-text-field
                  v-show="hideAnswer"
                  id="answer-hide"
                  class="centered-input"
                  hide-details
                  maxlength="1"
                  readonly
                  tabindex="-1"
                  value="？"
                  variant="solo-filled"
                />
              </td>

              <td>
                <jukugo-arrow-button
                  id="arrow-right"
                  v-model="arrows.right"
                  forward="left"
                  reverse="right"
                  @update:model-value="fetchData"
                />
              </td>

              <td>
                <jukugo-character-field
                  id="input-right"
                  v-model="inputs.right"
                  @input="fetchData"
                  @update:typing="typing = $event"
                />
              </td>
            </tr>

            <tr>
              <td></td>
              <td></td>

              <td>
                <jukugo-arrow-button
                  id="arrow-bottom"
                  v-model="arrows.bottom"
                  forward="up"
                  reverse="down"
                  @update:model-value="fetchData"
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
                  id="input-bottom"
                  v-model="inputs.bottom"
                  @input="fetchData"
                  @update:typing="typing = $event"
                />
              </td>

              <td></td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </v-col>
    </v-row>
  </v-container>

  <v-container>
    <v-row justify="center">
      <v-col cols="auto">
        <x-share-button />
      </v-col>
    </v-row>
  </v-container>

  <v-container v-if="isModified && !hideAnswer" id="list-answers">
    <v-row justify="center">
      <v-col class="text-end ma-0" cols="12" md="6" sm="8">
        <v-chip id="num-of-answers">
          {{ $t(`tools.${tool}.numOfCandidates`) }}:&nbsp;
          {{ !isModified || loading ? "-" : answers.length }}
        </v-chip>
      </v-col>
    </v-row>

    <v-row justify="center">
      <v-col cols="12" md="6" sm="8">
        <v-list-item>
          <template #prepend>
            <v-avatar size="40">
              <v-icon>{{ mdiHelpBoxOutline }}</v-icon>
            </v-avatar>
          </template>

          <v-row>
            <v-col class="text-center" cols="3">
              <v-icon>{{ mdiGamepadCircleUp }}</v-icon>
            </v-col>

            <v-col class="text-center" cols="3">
              <v-icon>{{ mdiGamepadCircleRight }}</v-icon>
            </v-col>

            <v-col class="text-center" cols="3">
              <v-icon>{{ mdiGamepadCircleDown }}</v-icon>
            </v-col>

            <v-col class="text-center" cols="3">
              <v-icon>{{ mdiGamepadCircleLeft }}</v-icon>
            </v-col>
          </v-row>
        </v-list-item>

        <v-virtual-scroll :height="300" item-height="50" :items="answers">
          <template #default="{ item, index }">
            <v-list-item
              v-if="!loading"
              :active="selectedAnswerId === index"
              @click="
                selectedAnswerId = index;
                updateSelectedAnswer();
              "
            >
              <template #prepend>
                <v-avatar size="40">
                  {{ item.character }}
                </v-avatar>
              </template>

              <v-row>
                <v-col class="text-center" cols="3">
                  <span v-if="inputs.top && jukugoUtil.isKanji(inputs.top)">
                    {{
                      arrows.top
                        ? `${inputs.top}${item.character}`
                        : `${item.character}${inputs.top}`
                    }}
                  </span>
                </v-col>

                <v-col class="text-center" cols="3">
                  <span v-if="inputs.right && jukugoUtil.isKanji(inputs.right)">
                    {{
                      arrows.right
                        ? `${inputs.right}${item.character}`
                        : `${item.character}${inputs.right}`
                    }}
                  </span>
                </v-col>

                <v-col class="text-center" cols="3">
                  <span
                    v-if="inputs.bottom && jukugoUtil.isKanji(inputs.bottom)"
                  >
                    {{
                      arrows.bottom
                        ? `${inputs.bottom}${item.character}`
                        : `${item.character}${inputs.bottom}`
                    }}
                  </span>
                </v-col>

                <v-col class="text-center" cols="3">
                  <span v-if="inputs.left && jukugoUtil.isKanji(inputs.left)">
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
    id="button-hide"
    active
    app
    :icon="hideAnswer ? mdiEye : mdiEyeOff"
    location="bottom end"
    size="small"
    @click="toggleHideAnswer"
  />

  <v-fab
    id="button-reset"
    :active="isModified"
    app
    class="mb-12"
    :icon="mdiEraser"
    location="bottom end"
    size="small"
    @click="resetInputs"
  />
</template>

<script lang="ts" setup>
import type {
  JukugoAnswer,
  JukugoArrows,
  JukugoInputs,
} from "@/composables/useJukugoSolver";
import {
  mdiEraser,
  mdiEye,
  mdiEyeOff,
  mdiGamepadCircleDown,
  mdiGamepadCircleLeft,
  mdiGamepadCircleRight,
  mdiGamepadCircleUp,
  mdiHelpBoxOutline,
} from "@mdi/js";
import { useHead } from "@unhead/vue";
import dayjs from "dayjs";

const route = useRoute();
const router = useRouter();
const tool = "jukugo";
const headerUtil = useHeaderUtil();
useHead(headerUtil.getHead(tool));
useHead(headerUtil.getOgpHead());

const jukugoUtil = useJukugoUtil();
const apiClient = useApi();
const solver = createJukugoSolver(async (input, arrow) => {
  const direction = arrow ? "right_search" : "left_search";
  try {
    return await apiClient.v1.jukugo._character(input)[direction].$get();
  } catch (error) {
    console.error("jukugo fetch fails", error);
    return [];
  }
}, jukugoUtil.isKanji);

let initializing = true;
const updating = ref(false);
const fetching = ref(false);
const loading = computed(() => fetching.value || updating.value);
const typing = ref(false);
const positions = jukugoPositions;
const createEmptyInputs = () =>
  Object.fromEntries(positions.map((pos) => [pos, ""])) as JukugoInputs;
const createDefaultArrows = () =>
  Object.fromEntries(positions.map((pos) => [pos, true])) as JukugoArrows;
const inputs = ref<JukugoInputs>(createEmptyInputs());
const arrows = ref<JukugoArrows>(createDefaultArrows());
const hideAnswer = ref(false);
const selectedAnswerId = ref(0);
const selectedAnswer = ref("");
const answers = ref<JukugoAnswer[]>([]);

const isModified = computed(() => {
  const hasInput = Object.values(inputs.value).some((input) => input !== "");
  const arrowsChanged = Object.values(arrows.value).some((arrow) => !arrow);
  return hasInput || arrowsChanged;
});

const resetInputs = () => {
  inputs.value = createEmptyInputs();
  arrows.value = createDefaultArrows();
  answers.value = [];
  selectedAnswerId.value = 0;
  router.replace({ query: {} });
  updateSelectedAnswer();
};

const fetchData = async () => {
  if (!initializing) selectedAnswerId.value = 0;
  updateQueryString();
  fetching.value = true;
  updating.value = true;
  const result = await solver.solve({
    arrows: arrows.value,
    inputs: inputs.value,
  });
  answers.value = result.answers;
  updateSelectedAnswer();
  updating.value = false;
  fetching.value = false;
  updateQueryString();
};

const toggleHideAnswer = () => {
  hideAnswer.value = !hideAnswer.value;
  updateSelectedAnswer();
};

const updateSelectedAnswer = () => {
  updateQueryString();
  let result = "";
  if (answers.value.length <= 0) {
    result = isModified.value ? "×" : "";
  } else if (isModified.value && answers.value.length <= 0) {
    result = "";
  } else {
    result = answers.value[selectedAnswerId.value].character;
  }
  selectedAnswer.value = result;
};

const updateQueryString = () => {
  const query = solver.toQuery({
    answers: answers.value,
    arrows: arrows.value,
    hideAnswer: hideAnswer.value,
    inputs: inputs.value,
    loading: loading.value,
    selectedAnswerId: selectedAnswerId.value,
  });

  if (initializing && route.query.id) {
    query.id = route.query.id.toString();
  }

  router.replace({ query });
};

const initializeFromQueryString = async () => {
  inputs.value.top = jukugoUtil.isKanji(route.query.t)
    ? route.query.t?.toString() || ""
    : "";
  inputs.value.right = jukugoUtil.isKanji(route.query.r)
    ? route.query.r?.toString() || ""
    : "";
  inputs.value.bottom = jukugoUtil.isKanji(route.query.b)
    ? route.query.b?.toString() || ""
    : "";
  inputs.value.left = jukugoUtil.isKanji(route.query.l)
    ? route.query.l?.toString() || ""
    : "";

  arrows.value.top = route.query.at === "0" ? false : true;
  arrows.value.right = route.query.ar === "0" ? false : true;
  arrows.value.bottom = route.query.ab === "0" ? false : true;
  arrows.value.left = route.query.al === "0" ? false : true;

  hideAnswer.value = route.query.h === "1" ? true : false;

  await fetchData();
  initializing = false;
  const id = Number(route.query.id);
  selectedAnswerId.value =
    !Number.isNaN(id) && id < answers.value.length ? id : 0;
  updateSelectedAnswer();
};

onMounted(() => {
  void initializeFromQueryString();
});
</script>

<style scoped>
table td {
  text-align: center;
  vertical-align: middle;
}
</style>
