<template>
  <section
    ref="stage"
    :aria-label="$t(`${messages}.title`)"
    :aria-modal="isExpanded ? true : undefined"
    class="ants"
    :class="{ 'ants--expanded': isExpanded }"
    :role="isExpanded ? 'dialog' : undefined"
    tabindex="-1"
    @keydown.esc="dismissMapMenu"
  >
    <header
      v-show="!isExpanded"
      class="ants__heading"
      data-testid="tool-heading"
    >
      <div class="ants__title">
        <img
          alt=""
          height="32"
          src="/img/ants/32.png"
          srcset="/img/ants/32.png 1x, /img/ants/64.png 2x"
          width="32"
        />

        <h1>{{ $t(`${messages}.title`) }}</h1>
      </div>

      <p>{{ $t(`${messages}.description`) }}</p>
    </header>

    <div class="ants__playback" data-testid="ants-playback">
      <v-btn
        class="ants__play"
        color="primary"
        :disabled="!ready"
        height="40"
        :prepend-icon="isRunning ? mdiPause : mdiPlay"
        variant="tonal"
        @click="isRunning ? pause() : resume()"
        >{{ $t(`${messages}.${isRunning ? "pause" : "resume"}`) }}</v-btn
      >

      <div class="ants__slider ants__speed">
        <label for="ants-speed">{{ $t(`${messages}.speedShort`) }}</label>

        <input
          id="ants-speed"
          v-model.number="speed"
          :aria-label="$t(`${messages}.speed`)"
          :aria-valuetext="`${speed}×`"
          :disabled="!ready"
          max="32"
          min="0.5"
          step="0.25"
          type="range"
        />

        <output data-testid="ants-speed-value" for="ants-speed"
          >{{ speed }}×</output
        >
      </div>

      <div :aria-label="$t(`${messages}.pheromoneLegend`)" class="ants__trails">
        <span
          ><i class="ants__key ants__key--food-trail" />{{
            $t(`${messages}.foodPheromone`)
          }}</span
        >

        <span
          ><i class="ants__key ants__key--home-trail" />{{
            $t(`${messages}.homePheromone`)
          }}</span
        >
      </div>

      <v-btn
        :aria-label="
          $t(`${messages}.${isExpanded ? 'closeExpanded' : 'expand'}`)
        "
        class="ants__expand"
        :disabled="!ready"
        :icon="isExpanded ? mdiFullscreenExit : mdiFullscreen"
        size="40"
        :title="$t(`${messages}.${isExpanded ? 'closeExpanded' : 'expand'}`)"
        variant="text"
        @click="isExpanded ? exit() : enter()"
      />
    </div>

    <div class="ants__box">
      <canvas
        ref="canvas"
        :aria-label="$t(`${messages}.canvasLabel`)"
        data-testid="ants-canvas"
        :data-tick="stats.tick"
        @lostpointercapture="pointerEnd"
        @pointercancel="pointerEnd"
        @pointerdown="pointerDown"
        @pointerleave="pointerLeave"
        @pointermove="pointerMove"
        @pointerup="pointerEnd"
        >{{ $t(`${messages}.canvasFallback`) }}</canvas
      >

      <div
        v-if="brushStyle"
        aria-hidden="true"
        class="ants__brush"
        data-testid="ants-brush-preview"
        :style="brushStyle"
      />

      <span v-if="!ready" class="ants__loading">{{
        $t(`${messages}.loading`)
      }}</span>
    </div>

    <dl class="ants__readout" data-testid="ants-readout">
      <div>
        <dt>{{ $t(`${messages}.elapsed`) }}</dt>

        <dd>
          <time
            data-testid="ants-elapsed"
            :datetime="`PT${Math.floor(stats.tick / 30)}S`"
            >{{ elapsedTime }}</time
          >
        </dd>
      </div>

      <div>
        <dt>{{ $t(`${messages}.ground`) }}</dt>

        <dd>
          <strong data-testid="ants-ground">{{ $n(stats.ground) }}</strong>

          <span class="ants__unit">{{
            $t(`${messages}.foodUnit`, stats.ground)
          }}</span>
        </dd>
      </div>

      <div>
        <dt>{{ $t(`${messages}.carrying`) }}</dt>

        <dd>
          <strong data-testid="ants-carrying">{{ $n(stats.carrying) }}</strong>

          <span class="ants__unit">{{
            $t(`${messages}.antUnit`, stats.carrying)
          }}</span>
        </dd>
      </div>

      <div>
        <dt>{{ $t(`${messages}.delivered`) }}</dt>

        <dd>
          <strong data-testid="ants-delivered">{{
            $n(stats.delivered)
          }}</strong>

          <span class="ants__unit">{{
            $t(`${messages}.foodUnit`, stats.delivered)
          }}</span>
        </dd>
      </div>
    </dl>

    <p v-if="isHidden" class="ants__notice" role="status">
      {{ $t(`${messages}.hidden`) }}
    </p>

    <div class="ants__editing" data-testid="ants-editing">
      <div
        :aria-label="$t(`${messages}.editTools`)"
        class="ants__tools"
        role="group"
      >
        <v-btn
          v-for="item in editTools"
          :key="item.value"
          :aria-pressed="tool === item.value"
          :color="tool === item.value ? 'primary' : undefined"
          :disabled="!ready"
          height="40"
          :prepend-icon="item.icon"
          :variant="tool === item.value ? 'flat' : 'tonal'"
          @click="tool = item.value"
          >{{ $t(`${messages}.${item.value}`) }}</v-btn
        >
      </div>

      <div
        class="ants__slider ants__size"
        :style="{ '--brush-diameter': `${brushDiameter}px` }"
      >
        <label for="ants-size">{{ $t(`${messages}.size`) }}</label>

        <input
          id="ants-size"
          v-model.number="brushSize"
          :aria-label="$t(`${messages}.brushSize`)"
          :disabled="!ready"
          max="31"
          min="3"
          step="2"
          type="range"
        />

        <span aria-hidden="true" class="ants__size-preview">
          <i v-if="ready" />
        </span>

        <output for="ants-size">{{ brushSize }}</output>
      </div>

      <div class="ants__reset-group">
        <v-btn
          class="ants__reset"
          :disabled="!ready"
          height="40"
          :prepend-icon="mdiRestart"
          :title="`${$t(`${messages}.reset`)}: ${selectedMapName}`"
          variant="text"
          @click="reset"
          >{{ $t(`${messages}.reset`) }}</v-btn
        >

        <v-menu
          v-model="mapMenu"
          :attach="stage"
          :close-on-content-click="false"
          location="top end"
          :max-height="320"
          :max-width="320"
          :min-width="260"
          :open-on-click="false"
          :transition="false"
          :z-index="2600"
        >
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              :aria-label="$t(`${messages}.chooseMap`)"
              :disabled="!ready"
              :icon="mdiChevronDown"
              rounded="sm"
              size="28"
              :title="$t(`${messages}.chooseMap`)"
              variant="text"
              @click.stop="mapMenu = !mapMenu"
            />
          </template>

          <v-list density="compact" role="menu">
            <v-list-subheader>{{
              $t(`${messages}.initialMap`)
            }}</v-list-subheader>

            <v-list-item
              v-for="item in ANT_MAPS"
              :key="item.id"
              :active="item.id === mapId"
              :aria-checked="item.id === mapId"
              color="primary"
              role="menuitemradio"
              :title="mapName(item)"
              @click="
                selectMap(item.id);
                mapMenu = false;
              "
            />
          </v-list>
        </v-menu>

        <span class="ants__map-name" :title="selectedMapName">{{
          selectedMapName
        }}</span>
      </div>
    </div>

    <p v-if="notice" class="ants__notice" role="status">
      {{ $t(`${messages}.notices.${notice}`) }}
    </p>

    <details
      v-show="!isExpanded"
      class="ants__explanation"
      data-testid="ants-explanation"
    >
      <summary>{{ $t(`${messages}.explanation`) }}</summary>
      <p class="ants__hint">{{ $t(`${messages}.hint`) }}</p>

      <div :aria-label="$t(`${messages}.legend`)" class="ants__legend">
        <span
          ><i class="ants__key ants__key--nest" />{{
            $t(`${messages}.nest`)
          }}</span
        >

        <span
          ><i class="ants__key ants__key--wall" />{{
            $t(`${messages}.wall`)
          }}</span
        >

        <span
          ><i class="ants__key ants__key--food" />{{
            $t(`${messages}.food`)
          }}</span
        >

        <span
          ><i class="ants__key ants__key--ant" />{{
            $t(`${messages}.ant`)
          }}</span
        >

        <span
          ><i class="ants__key ants__key--carrying" />{{
            $t(`${messages}.carryingAnt`)
          }}</span
        >
      </div>

      <p class="ants__about">{{ $t(`${messages}.about`) }}</p>

      <div class="ants__algorithm" data-testid="ants-algorithm">
        <p>{{ $t(`${messages}.algorithm.world`) }}</p>
        <h2>{{ $t(`${messages}.algorithm.movementTitle`) }}</h2>

        <ol>
          <li
            v-for="key in ['exchange', 'sensors', 'turn', 'food', 'move']"
            :key="key"
          >
            {{ $t(`${messages}.algorithm.${key}`) }}
          </li>
        </ol>

        <p>{{ $t(`${messages}.algorithm.individuality`) }}</p>

        <p class="ants__formula">
          <code
            >k = 0.9 / q<br />Δθ = (R^k - L^k) / (L^k + 2F^k + R^k) × (4.5 /
            30)</code
          >
        </p>

        <h2>{{ $t(`${messages}.algorithm.pheromoneTitle`) }}</h2>
        <p>{{ $t(`${messages}.algorithm.deposit`) }}</p>

        <p class="ants__formula">
          <code
            >{{ $t(`${messages}.algorithm.depositLabel`) }} = 2.5 × exp(-d /
            35)</code
          >
        </p>

        <p>{{ $t(`${messages}.algorithm.diffusion`) }}</p>
        <h2>{{ $t(`${messages}.algorithm.randomnessTitle`) }}</h2>
        <p>{{ $t(`${messages}.algorithm.randomness`) }}</p>
        <p>{{ $t(`${messages}.algorithm.routes`) }}</p>
        <h2>{{ $t(`${messages}.algorithm.editingTitle`) }}</h2>
        <p>{{ $t(`${messages}.algorithm.editing`) }}</p>
        <p>{{ $t(`${messages}.algorithm.time`) }}</p>
      </div>
    </details>
  </section>
</template>

<script lang="ts" setup>
import type { EditTool } from "@/lib/ants/types";
import {
  mdiChevronDown,
  mdiEraser,
  mdiFoodApple,
  mdiFullscreen,
  mdiFullscreenExit,
  mdiPause,
  mdiPlay,
  mdiRestart,
  mdiWall,
} from "@mdi/js";
import { useHead } from "@unhead/vue";
import { useI18n } from "vue-i18n";
import { ANT_MAPS } from "@/lib/ants/maps";

const messages = "tools.ants";
useHead(useHeaderUtil().getHead("ants"));
const stage = ref<HTMLElement>();
const mapMenu = ref(false);
const dismissMapMenu = (event: KeyboardEvent) => {
  if (!mapMenu.value) return;
  event.preventDefault();
  event.stopPropagation();
  mapMenu.value = false;
};
const { isExpanded, enter, exit } = useAntExpandedView(stage, mapMenu);
watch(isExpanded, () => {
  mapMenu.value = false;
});
const { locale } = useI18n();
const mapName = (item: (typeof ANT_MAPS)[number]) =>
  item.name[locale.value === "ja" ? "ja" : "en"];
const canvas = ref<HTMLCanvasElement>();
const {
  ready,
  isRunning,
  isHidden,
  speed,
  mapId,
  tool,
  stats,
  brushSize,
  brushDiameter,
  brushStyle,
  notice,
  pause,
  resume,
  reset,
  selectMap,
  pointerDown,
  pointerMove,
  pointerEnd,
  pointerLeave,
} = useAntSimulation(canvas);
const selectedMapName = computed(() =>
  mapName(ANT_MAPS.find((item) => item.id === mapId.value)!),
);
const elapsedTime = computed(() => {
  const seconds = Math.floor(stats.value.tick / 30);
  return [Math.floor(seconds / 60), seconds % 60]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
});
const editTools: { value: EditTool; icon: string }[] = [
  { value: "food", icon: mdiFoodApple },
  { value: "wall", icon: mdiWall },
  { value: "erase", icon: mdiEraser },
];
</script>

<style scoped>
.ants {
  width: min(100%, max(480px, calc((100dvh - 320px) * 1.5)));
  max-width: 1000px;
  margin: 8px auto 0;
  outline: none;
}
.ants__heading {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 16px;
}
.ants__title {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.ants__title h1 {
  margin: 0;
  font-size: 1.5rem;
  line-height: 1.4;
}
.ants__heading p {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.6;
  color: rgba(var(--v-theme-on-surface), 0.72);
}
.ants__playback {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-bottom: 10px;
}
.ants__play {
  min-width: 112px;
}
.ants__slider {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 0.8rem;
}
.ants__slider label {
  white-space: nowrap;
}
.ants__slider input {
  flex: 1;
  min-width: 0;
  width: 100%;
  height: 32px;
  accent-color: rgb(var(--v-theme-primary));
  cursor: pointer;
}
.ants__slider input:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
  border-radius: 4px;
}
.ants__slider output {
  min-width: 3.5ch;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.ants__speed {
  flex: 1;
  max-width: 210px;
}
.ants__trails,
.ants__legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 14px;
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), 0.8);
}
.ants__trails {
  margin-left: auto;
}
.ants__trails span,
.ants__legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.ants__box {
  position: relative;
  flex-shrink: 0;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #c6beaa;
  background: #f4eedb;
}
.ants__box canvas {
  display: block;
  width: 100%;
  aspect-ratio: 3 / 2;
  touch-action: none;
  user-select: none;
  cursor: crosshair;
}
.ants__brush {
  position: absolute;
  transform: translate(-50%, -50%);
  border: 1px solid #333b30;
  outline: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  pointer-events: none;
}
.ants__loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #494d42;
}
.ants__readout {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin: 12px 0 0;
  font-variant-numeric: tabular-nums;
}
.ants__readout dt {
  font-size: 0.75rem;
  line-height: 1.5;
  color: rgba(var(--v-theme-on-surface), 0.72);
}
.ants__readout dd {
  display: flex;
  align-items: baseline;
  gap: 5px;
  margin: 4px 0 0;
  font-size: 1.125rem;
  line-height: 1.4;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
}
.ants__readout strong {
  font-weight: inherit;
}
.ants__unit {
  font-size: 0.75rem;
  font-weight: 400;
  color: rgba(var(--v-theme-on-surface), 0.72);
}
.ants__editing {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
  padding: 12px 0;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}
.ants__tools {
  display: flex;
  gap: 4px;
}
.ants__tools .v-btn {
  min-width: 0;
  padding-inline: 12px;
}
.ants__size {
  flex: 1;
  min-width: calc(max(32px, var(--brush-diameter)) + 160px);
  max-width: max(270px, calc(var(--brush-diameter) + 160px));
}
.ants__size-preview {
  display: grid;
  place-items: center;
  min-width: 32px;
  min-height: 32px;
  flex-shrink: 0;
}
.ants__size-preview i {
  width: var(--brush-diameter);
  height: var(--brush-diameter);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.65);
  border-radius: 50%;
}
.ants__reset-group {
  display: grid;
  grid-template-columns: auto 28px;
  align-items: center;
  flex-shrink: 0;
  margin-left: auto;
}
.ants__map-name {
  grid-column: 1 / -1;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
  font-size: 0.6875rem;
  line-height: 1.5;
  color: rgba(var(--v-theme-on-surface), 0.65);
}
.ants__key {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}
.ants__key--nest {
  background: #b57842;
}
.ants__key--wall {
  background: #4f5752;
  border-radius: 2px;
}
.ants__key--food {
  background: #5e9e3e;
}
.ants__key--ant {
  background: #252b24;
}
.ants__key--carrying {
  position: relative;
  background: #3b382b;
}
.ants__key--carrying::after {
  content: "";
  position: absolute;
  right: -2px;
  top: -1px;
  width: 4px;
  height: 4px;
  background: #77824e;
  border-radius: 50%;
}
.ants__key--food-trail {
  background: #4ab7f4;
}
.ants__key--home-trail {
  background: #f39c3f;
}
.ants__explanation {
  margin-top: 4px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  font-size: 0.8rem;
  line-height: 1.7;
  color: rgba(var(--v-theme-on-surface), 0.72);
}
.ants__explanation summary {
  width: fit-content;
  padding: 12px 0;
  cursor: pointer;
}
.ants__hint {
  margin-bottom: 12px;
}
.ants__about,
.ants__notice {
  margin-top: 12px;
}
.ants__algorithm h2 {
  margin: 24px 0 10px;
  color: rgb(var(--v-theme-on-surface));
  font-size: 0.95rem;
}
.ants__algorithm p {
  margin: 10px 0;
}
.ants__algorithm ol {
  padding-left: 22px;
}
.ants__algorithm li {
  margin-top: 8px;
}
.ants__formula {
  padding: 12px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  border-radius: 6px;
  overflow-wrap: anywhere;
}
.ants--expanded {
  /* Reserve the largest brush (31 cells) without resizing the canvas on input. */
  --expanded-width: min(100%, calc((100dvh - 188px) * 240 / (160 + 31)));
  position: fixed;
  inset: 0;
  z-index: 2500;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: auto;
  max-width: none;
  margin: 0;
  padding: 16px max(16px, env(safe-area-inset-right)) 16px
    max(16px, env(safe-area-inset-left));
  background: rgb(var(--v-theme-surface));
  overflow-y: auto;
}
.ants--expanded .ants__box {
  width: var(--expanded-width);
  margin: auto;
}
.ants--expanded .ants__readout,
.ants--expanded .ants__editing {
  width: var(--expanded-width);
  margin-inline: auto;
}
@media (max-width: 800px) {
  .ants__editing {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 6px 8px;
  }
  .ants__size {
    grid-column: 1 / -1;
    grid-row: 2;
    width: 100%;
    max-width: none;
  }
  .ants__reset-group {
    grid-column: 2;
    grid-row: 1;
    margin-left: 0;
  }
}
@media (max-width: 600px) {
  .ants {
    width: 100%;
    margin-top: 4px;
    padding-bottom: calc(140px + env(safe-area-inset-bottom));
  }
  .ants__heading {
    display: block;
    margin-bottom: 12px;
  }
  .ants__heading p {
    margin-top: 8px;
  }
  .ants__playback {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) 40px;
    gap: 8px 10px;
  }
  .ants__play {
    min-width: 96px;
    padding-inline: 12px;
  }
  .ants__speed {
    max-width: none;
  }
  .ants__trails {
    grid-column: 1 / -1;
    grid-row: 2;
    margin-left: 0;
  }
  .ants__expand {
    grid-column: 3;
    grid-row: 1;
  }
  .ants__readout {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px 20px;
  }
  .ants__editing {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 30;
    margin: 0;
    padding: 10px max(16px, env(safe-area-inset-right))
      calc(10px + env(safe-area-inset-bottom))
      max(16px, env(safe-area-inset-left));
    background: rgb(var(--v-theme-surface));
    box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.04);
  }
  .ants__tools .v-btn {
    padding-inline: 8px;
    font-size: 0.75rem;
  }
  .ants__reset {
    padding-inline: 8px;
  }
  .ants__reset :deep(.v-btn__prepend) {
    display: none;
  }
  .ants__map-name {
    max-width: 92px;
  }
  .ants__explanation {
    margin-top: 16px;
  }
  .ants--expanded {
    margin: 0;
    padding: 12px 12px calc(130px + env(safe-area-inset-bottom));
  }
  .ants--expanded .ants__editing {
    width: 100%;
  }
  .ants--expanded .ants__box,
  .ants--expanded .ants__readout {
    width: min(100%, calc((100dvh - 330px) * 1.5));
  }
}
</style>
