<template>
  <div class="group-roulette-shell">
    <v-container>
      <v-row class="align-center">
        <v-col cols="auto">
          <v-avatar size="32">
            <img
              alt=""
              height="32"
              :src="`/img/${tool}/32.png`"
              :srcset="`/img/${tool}/32.png 1x, /img/${tool}/64.png 2x`"
              width="32"
            />
          </v-avatar>
        </v-col>

        <v-col>
          <h1 class="group-roulette-title">
            {{ $t(`tools.${tool}.title`) }}
          </h1>
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12">
          <p>
            {{ $t(`tools.${tool}.description`) }}
          </p>

          <p class="text-caption">
            {{ $t(`tools.${tool}.privacyNotice`) }}
          </p>
        </v-col>
      </v-row>
    </v-container>

    <v-container>
      <v-row class="align-stretch">
        <v-col cols="12" md="7">
          <group-roulette-stage
            :active-options="roulette.activeOptions.value"
            :can-start="canStartSpin"
            :can-stop="canStopSpin"
            :current-spin="roulette.currentSpin.value"
            :guest-add-enabled="roulette.guestAddEnabled.value"
            :is-host="roulette.isHost.value"
            :member="roulette.member.value"
            :server-now="roulette.serverNow"
            :status="roulette.status.value"
            :winner-option="roulette.winnerOption.value"
            @start="roulette.startSpin"
            @stop="roulette.stopSpin"
          />
        </v-col>

        <v-col cols="12" md="5">
          <aside aria-label="ルーム操作" class="group-roulette-rail">
            <template v-if="!roulette.roomId.value">
              <v-sheet border class="rail-section pa-4" rounded="lg">
                <h2>{{ $t(`tools.${tool}.idle`) }}</h2>
                <p>{{ $t(`tools.${tool}.idleActionHelp`) }}</p>

                <v-btn
                  block
                  color="primary"
                  :loading="creating"
                  :prepend-icon="mdiPlusCircleOutline"
                  size="large"
                  @click="createRoom"
                >
                  {{ $t(`tools.${tool}.createRoom`) }}
                </v-btn>
              </v-sheet>
            </template>

            <template v-else-if="!roulette.member.value">
              <v-sheet border class="rail-section pa-4" rounded="lg">
                <h2>{{ $t(`tools.${tool}.joinTitle`) }}</h2>
                <p>{{ $t(`tools.${tool}.joinHelp`) }}</p>

                <v-text-field
                  v-model="displayName"
                  density="comfortable"
                  :label="$t(`tools.${tool}.displayName`)"
                  maxlength="40"
                  variant="outlined"
                  @keyup.enter="roulette.joinRoom(displayName)"
                />

                <v-btn
                  block
                  color="primary"
                  :prepend-icon="mdiLoginVariant"
                  size="large"
                  @click="roulette.joinRoom(displayName)"
                >
                  {{ $t(`tools.${tool}.enterRoom`) }}
                </v-btn>
              </v-sheet>

              <group-roulette-share-bar
                :member="roulette.member.value"
                :share-url="roulette.shareUrl.value"
              />
            </template>

            <template v-else>
              <group-roulette-status-alert
                :error-message="roulette.errorMessage.value"
                :member="roulette.member.value"
                :status="roulette.status.value"
              />

              <v-sheet
                v-if="roulette.isHost.value"
                border
                class="rail-section pa-4"
                rounded="lg"
              >
                <h2>{{ $t(`tools.${tool}.hostPanelTitle`) }}</h2>

                <v-switch
                  color="primary"
                  density="comfortable"
                  hide-details
                  :label="$t(`tools.${tool}.guestAddEnabled`)"
                  :model-value="roulette.guestAddEnabled.value"
                  @update:model-value="
                    roulette.setGuestAddEnabled(Boolean($event))
                  "
                />
              </v-sheet>

              <group-roulette-option-editor
                :adding-option="addingOption"
                :can-add-option="roulette.canAddOption.value"
                :guest-add-enabled="roulette.guestAddEnabled.value"
                :member="roulette.member.value"
                :status="roulette.status.value"
                @add="addOption"
              />

              <group-roulette-option-list
                :can-edit-options="roulette.canEditOptions.value"
                :is-host="roulette.isHost.value"
                :options="roulette.activeOptions.value"
                @remove="roulette.removeOption"
              />

              <group-roulette-share-bar
                :member="roulette.member.value"
                :share-url="roulette.shareUrl.value"
              />
            </template>
          </aside>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script lang="ts" setup>
import { mdiLoginVariant, mdiPlusCircleOutline } from "@mdi/js";
import { useHead } from "@unhead/vue";

const tool = GROUP_ROULETTE_TOOL;
const headerUtil = useHeaderUtil();
const roulette = useGroupRoulette();
const displayName = ref("");
const creating = ref(false);
const addingOption = ref(false);

const canStartSpin = computed(
  () =>
    roulette.isHost.value &&
    roulette.activeOptions.value.length > 0 &&
    (roulette.status.value === "waiting" || roulette.status.value === "result"),
);

const canStopSpin = computed(
  () => roulette.isHost.value && roulette.status.value === "spinning",
);

useHead(headerUtil.getHead(tool));
useHead({
  meta: [
    {
      name: "robots",
      content: roulette.robotsContent,
    },
  ],
});

const createRoom = async () => {
  creating.value = true;
  try {
    await roulette.createRoom();
  } finally {
    creating.value = false;
  }
};

const addOption = async (label: string) => {
  if (addingOption.value) return;

  addingOption.value = true;
  try {
    await roulette.addOption(label);
  } finally {
    addingOption.value = false;
  }
};

onMounted(() => {
  if (roulette.roomId.value) {
    void roulette.startPolling();
  }
});
</script>

<style scoped>
.group-roulette-shell {
  width: 100%;
}

.group-roulette-title {
  margin: 0;
  font-size: clamp(1.65rem, 7vw, 2.5rem);
  line-height: 1.2;
  overflow-wrap: normal;
  word-break: keep-all;
}

.group-roulette-rail {
  display: grid;
  gap: 16px;
  height: 100%;
}

.rail-section {
  display: grid;
  gap: 12px;
}

.rail-section h2 {
  margin: 0;
  font-size: 1.08rem;
}

.rail-section p {
  margin: 0;
  color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 70%, transparent);
  font-size: 0.9rem;
}
</style>
