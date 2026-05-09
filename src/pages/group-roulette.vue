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
          <h1>{{ $t(`tools.${tool}.title`) }}</h1>
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12">
          <p>{{ $t(`tools.${tool}.description`) }}</p>
          <p class="text-caption">{{ $t(`tools.${tool}.privacyNotice`) }}</p>
        </v-col>
      </v-row>
    </v-container>

    <v-container>
      <v-row class="align-stretch">
        <v-col cols="12" md="5">
          <section class="control-panel">
            <template v-if="!roulette.roomId.value">
              <h2>{{ $t(`tools.${tool}.idle`) }}</h2>

              <v-btn
                block
                color="primary"
                :loading="creating"
                :prepend-icon="mdiPlusCircleOutline"
                @click="createRoom"
              >
                {{ $t(`tools.${tool}.createRoom`) }}
              </v-btn>
            </template>

            <template v-else>
              <div class="room-summary">
                <div>
                  <span class="text-caption">
                    {{ $t(`tools.${tool}.shareUrl`) }}
                  </span>

                  <p class="share-url">{{ roulette.shareUrl.value }}</p>
                </div>

                <v-btn
                  :aria-label="$t(`tools.${tool}.copyShareUrl`)"
                  :icon="mdiContentCopy"
                  size="small"
                  variant="text"
                  @click="copyShareUrl"
                />
              </div>

              <template v-if="!roulette.member.value">
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
                  :prepend-icon="mdiLoginVariant"
                  variant="tonal"
                  @click="roulette.joinRoom(displayName)"
                >
                  {{ $t(`tools.${tool}.enterRoom`) }}
                </v-btn>
              </template>

              <v-divider class="my-5" />

              <h2>{{ $t(`tools.${tool}.${roulette.status.value}`) }}</h2>

              <div v-if="roulette.member.value" class="member-line">
                <v-icon :icon="mdiAccountCircleOutline" />
                <span>{{ roulette.member.value.displayName }}</span>

                <v-chip density="comfortable" size="small">
                  {{
                    $t(
                      `tools.${tool}.${
                        roulette.member.value.role === "host"
                          ? "memberRoleHost"
                          : "memberRoleGuest"
                      }`,
                    )
                  }}
                </v-chip>
              </div>

              <v-switch
                v-if="roulette.isHost.value"
                class="mt-4"
                color="primary"
                density="comfortable"
                :label="$t(`tools.${tool}.guestAddEnabled`)"
                :model-value="roulette.guestAddEnabled.value"
                @update:model-value="
                  roulette.setGuestAddEnabled(Boolean($event))
                "
              />

              <v-text-field
                v-model="optionLabel"
                class="mt-4"
                density="comfortable"
                :disabled="!roulette.canAddOption.value"
                :label="$t(`tools.${tool}.optionLabel`)"
                maxlength="80"
                variant="outlined"
                @keyup.enter="addOption"
              />

              <v-btn
                block
                :disabled="!optionLabel.trim() || !roulette.canAddOption.value"
                :prepend-icon="mdiPlus"
                @click="addOption"
              >
                {{ $t(`tools.${tool}.addOption`) }}
              </v-btn>

              <div class="spin-actions">
                <v-btn
                  :disabled="
                    !roulette.isHost.value ||
                    roulette.activeOptions.value.length === 0 ||
                    roulette.status.value === 'spinning'
                  "
                  :prepend-icon="mdiPlayCircleOutline"
                  @click="roulette.startSpin"
                >
                  {{ $t(`tools.${tool}.startSpin`) }}
                </v-btn>

                <v-btn
                  :disabled="
                    !roulette.isHost.value ||
                    roulette.status.value !== 'spinning'
                  "
                  :prepend-icon="mdiStopCircleOutline"
                  @click="roulette.stopSpin"
                >
                  {{ $t(`tools.${tool}.stopSpin`) }}
                </v-btn>
              </div>

              <v-alert
                v-if="roulette.errorMessage.value"
                class="mt-4"
                density="comfortable"
                type="error"
                variant="tonal"
              >
                {{ roulette.errorMessage.value }}
              </v-alert>
            </template>
          </section>
        </v-col>

        <v-col cols="12" md="7">
          <section class="roulette-stage">
            <div
              class="roulette-wheel"
              :class="{
                'roulette-wheel--spinning':
                  roulette.status.value === 'spinning',
              }"
            >
              <div class="roulette-wheel__center">
                <template v-if="roulette.winnerOption.value">
                  <span class="text-caption">{{
                    $t(`tools.${tool}.winner`)
                  }}</span>

                  <strong>{{ roulette.winnerOption.value.label }}</strong>
                </template>

                <template v-else>
                  <span>{{
                    $t(`tools.${tool}.${roulette.status.value}`)
                  }}</span>
                </template>
              </div>
            </div>

            <v-list class="option-list" lines="one">
              <v-list-item
                v-for="option in roulette.activeOptions.value"
                :key="option.id"
                :title="option.label"
              >
                <template #prepend>
                  <v-avatar color="primary" size="28">
                    {{ option.order }}
                  </v-avatar>
                </template>

                <template v-if="roulette.isHost.value" #append>
                  <v-btn
                    :aria-label="$t(`tools.${tool}.removeOption`)"
                    :disabled="!roulette.canEditOptions.value"
                    :icon="mdiDeleteOutline"
                    size="small"
                    variant="text"
                    @click="roulette.removeOption(option.id)"
                  />
                </template>
              </v-list-item>

              <v-list-item
                v-if="roulette.activeOptions.value.length === 0"
                :title="$t(`tools.${tool}.noOptions`)"
              />
            </v-list>
          </section>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script lang="ts" setup>
import {
  mdiAccountCircleOutline,
  mdiContentCopy,
  mdiDeleteOutline,
  mdiLoginVariant,
  mdiPlayCircleOutline,
  mdiPlus,
  mdiPlusCircleOutline,
  mdiStopCircleOutline,
} from "@mdi/js";
import { useHead } from "@unhead/vue";

const tool = GROUP_ROULETTE_TOOL;
const headerUtil = useHeaderUtil();
const roulette = useGroupRoulette();
const displayName = ref("");
const optionLabel = ref("");
const creating = ref(false);

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

const addOption = () => {
  roulette.addOption(optionLabel.value);
  optionLabel.value = "";
};

const copyShareUrl = async () => {
  if (import.meta.env.SSR || !navigator.clipboard) return;
  await navigator.clipboard.writeText(roulette.shareUrl.value);
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

.control-panel,
.roulette-stage {
  min-height: 100%;
}

.room-summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
}

.share-url {
  overflow-wrap: anywhere;
  margin-bottom: 0;
}

.member-line {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.spin-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.roulette-stage {
  display: grid;
  gap: 16px;
}

.roulette-wheel {
  position: relative;
  display: grid;
  width: min(100%, 420px);
  aspect-ratio: 1;
  place-items: center;
  justify-self: center;
  border: 8px solid rgb(var(--v-theme-surface));
  border-radius: 50%;
  background:
    radial-gradient(circle, rgb(var(--v-theme-surface)) 0 30%, transparent 31%),
    conic-gradient(
      #2a9d8f 0deg 72deg,
      #e9c46a 72deg 144deg,
      #e76f51 144deg 216deg,
      #457b9d 216deg 288deg,
      #8ab17d 288deg 360deg
    );
  box-shadow: 0 8px 28px rgb(0 0 0 / 14%);
}

.roulette-wheel--spinning {
  animation: roulette-spin 1s linear infinite;
}

.roulette-wheel__center {
  z-index: 1;
  display: grid;
  width: 38%;
  aspect-ratio: 1;
  place-items: center;
  padding: 12px;
  border-radius: 50%;
  background: rgb(var(--v-theme-surface));
  text-align: center;
}

.roulette-wheel__center strong {
  max-width: 100%;
  overflow-wrap: anywhere;
  font-size: 1.2rem;
}

.option-list {
  max-height: 320px;
  overflow-y: auto;
}

@keyframes roulette-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 600px) {
  .spin-actions {
    grid-template-columns: 1fr;
  }
}
</style>
