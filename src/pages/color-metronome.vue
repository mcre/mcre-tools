<template>
  <tool-heading :tool="tool" />

  <v-container>
    <div class="metronome">
      <section
        ref="stage"
        :aria-label="$t(`${messages}.title`)"
        class="metronome__stage"
        :class="{ 'metronome__stage--expanded': isExpanded }"
        :data-expanded="isExpanded"
        data-testid="metronome-stage"
        @pointerdown="activity"
        @pointermove="activity"
      >
        <div
          aria-hidden="true"
          class="metronome__display"
          data-testid="color-display"
          :style="{ backgroundColor: currentColor.hex }"
        >
          <div
            class="metronome__shade"
            data-testid="color-shade"
            :style="{
              backgroundColor: shadeColor,
              opacity: shadeOpacity,
            }"
          />
        </div>

        <div
          v-show="controlsVisible"
          ref="controls"
          class="metronome__controls"
          @focusin="onControlsFocus"
          @focusout="onControlsBlur"
          @pointerdown="setControlsFocused(false)"
        >
          <v-btn
            class="metronome__play"
            color="primary"
            height="48"
            :prepend-icon="isRunning ? mdiStop : mdiPlay"
            variant="flat"
            @click="isRunning ? stop() : start()"
            >{{ $t(`${messages}.${isRunning ? "stop" : "start"}`) }}</v-btn
          >

          <v-btn
            height="48"
            :prepend-icon="isExpanded ? mdiFullscreenExit : mdiFullscreen"
            variant="tonal"
            @click="isExpanded ? exit() : enter()"
            >{{
              $t(`${messages}.${isExpanded ? "exitFullscreen" : "fullscreen"}`)
            }}</v-btn
          >
        </div>
      </section>

      <div class="metronome__settings">
        <div class="metronome__setting">
          <label class="metronome__label" for="metronome-bpm">BPM</label>

          <div class="metronome__tempo">
            <v-btn
              :aria-label="$t(`${messages}.decreaseBpm`)"
              :disabled="settings.bpm <= 30"
              :icon="mdiMinus"
              rounded="sm"
              size="48"
              variant="tonal"
              @click="setBpm(settings.bpm - 1)"
            />

            <input
              id="metronome-bpm"
              v-model="bpmDraft"
              class="metronome__input metronome__bpm"
              inputmode="numeric"
              max="250"
              min="30"
              step="1"
              type="number"
              @blur="commitBpm"
              @keydown.enter="commitBpm"
            />

            <v-btn
              :aria-label="$t(`${messages}.increaseBpm`)"
              :disabled="settings.bpm >= 250"
              :icon="mdiPlus"
              rounded="sm"
              size="48"
              variant="tonal"
              @click="setBpm(settings.bpm + 1)"
            />

            <v-btn height="48" variant="outlined" @click="tapTempo()">{{
              $t(`${messages}.tap`)
            }}</v-btn>
          </div>

          <div
            :aria-label="$t(`${messages}.bpmPresets`)"
            class="metronome__presets"
            role="group"
          >
            <v-btn
              v-for="bpm in bpmPresets"
              :key="bpm"
              :aria-label="`${bpm} BPM`"
              :aria-pressed="settings.bpm === bpm"
              :color="settings.bpm === bpm ? 'primary' : undefined"
              height="40"
              :variant="settings.bpm === bpm ? 'flat' : 'tonal'"
              @click="setBpm(bpm)"
              >{{ bpm }}</v-btn
            >
          </div>
        </div>

        <div class="metronome__setting">
          <label class="metronome__label" for="metronome-beats">{{
            $t(`${messages}.beats`)
          }}</label>

          <select
            id="metronome-beats"
            class="metronome__input"
            :value="settings.beats"
            @change="setBeats(inputValue($event))"
          >
            <option v-for="beat in 9" :key="beat" :value="beat">
              {{ beat }}
            </option>
          </select>
        </div>

        <div class="metronome__setting">
          <label class="metronome__label" for="metronome-subdivision">{{
            $t(`${messages}.subdivision`)
          }}</label>

          <select
            id="metronome-subdivision"
            class="metronome__input"
            :value="settings.subdivision"
            @change="setSubdivision(inputValue($event))"
          >
            <option v-for="division in 4" :key="division" :value="division">
              {{ $t(`${messages}.subdivisions.${division}`) }}
            </option>
          </select>
        </div>
      </div>

      <fieldset class="metronome__colors">
        <legend class="metronome__label">
          {{ $t(`${messages}.beatColors`) }}
        </legend>

        <div class="metronome__palette">
          <label
            v-for="beat in settings.beats"
            :key="beat"
            class="metronome__color"
            :class="{
              'metronome__color--current':
                isRunning && currentIndex === beat - 1,
            }"
          >
            <span aria-hidden="true">{{ beat }}</span>

            <input
              :aria-label="$t(`${messages}.beatColor`, { beat })"
              type="color"
              :value="settings.colors[beat - 1]"
              @input="setColor(beat - 1, inputValue($event))"
            />
          </label>
        </div>
      </fieldset>

      <v-btn
        class="mt-4"
        :prepend-icon="mdiRestore"
        variant="text"
        @click="resetSettings"
        >{{ $t(`${messages}.resetSettings`) }}</v-btn
      >
    </div>
  </v-container>
</template>

<script lang="ts" setup>
import {
  mdiFullscreen,
  mdiFullscreenExit,
  mdiMinus,
  mdiPlay,
  mdiPlus,
  mdiRestore,
  mdiStop,
} from "@mdi/js";
import { useHead } from "@unhead/vue";

const tool = "color-metronome";
const messages = `tools.${tool}`;
const bpmPresets = [60, 80, 90, 100, 120, 140, 160, 180];
const headerUtil = useHeaderUtil();
useHead(headerUtil.getHead(tool));

const preferences = useColorMetronomeSettings();
const {
  settings,
  restore,
  setBpm,
  setBeats,
  setSubdivision,
  setColor,
  tapTempo,
} = preferences;
const {
  currentIndex,
  currentColor,
  isRunning,
  shadeOpacity,
  shadeColor,
  start,
  stop,
  reset: resetPlayback,
} = useColorMetronome(settings);
const stage = ref<HTMLElement | null>(null);
const controls = ref<HTMLElement | null>(null);
const {
  isExpanded,
  controlsVisible,
  enter,
  exit,
  activity,
  setControlsFocused,
} = useMetronomeFullscreen(stage, isRunning);
const route = useRoute();
const bpmDraft = ref<string | number>(settings.value.bpm);
watch(
  () => settings.value.bpm,
  (bpm) => {
    bpmDraft.value = bpm;
  },
);
const commitBpm = () => {
  setBpm(bpmDraft.value);
  bpmDraft.value = settings.value.bpm;
};
const resetSettings = () => {
  resetPlayback();
  preferences.reset();
  bpmDraft.value = settings.value.bpm;
};
const inputValue = (event: Event) =>
  (event.target as HTMLInputElement | HTMLSelectElement).value;
const onControlsFocus = (event: FocusEvent) => {
  setControlsFocused(
    event.target instanceof HTMLElement &&
      event.target.matches(":focus-visible"),
  );
};
const onControlsBlur = (event: FocusEvent) => {
  if (
    !(event.relatedTarget instanceof Node) ||
    !controls.value?.contains(event.relatedTarget)
  )
    setControlsFocused(false);
};
const onVisibilityChange = () => {
  if (document.hidden) stop();
};
const onPageHide = () => {
  stop();
  void exit();
};
watch(() => route.path, onPageHide);
onMounted(() => {
  const firstVisit = restore();
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", onPageHide);
  if (firstVisit && !document.hidden) start();
});
onUnmounted(() => {
  document.removeEventListener("visibilitychange", onVisibilityChange);
  window.removeEventListener("pagehide", onPageHide);
});
</script>

<style scoped>
.metronome__stage {
  position: relative;
}
.metronome__display,
.metronome__shade {
  transition: none;
  animation: none;
}
.metronome__display {
  position: relative;
  height: clamp(240px, 36vh, 360px);
  overflow: hidden;
  border-radius: 8px;
}
.metronome__shade {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.metronome__controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  padding: 20px 0;
}
.metronome__play {
  min-width: 160px;
}
.metronome__settings {
  display: grid;
  grid-template-columns: minmax(300px, 1.5fr) repeat(2, minmax(0, 1fr));
  gap: 24px;
  margin-top: 12px;
}
.metronome__label {
  display: block;
  margin-bottom: 10px;
  font-size: 0.875rem;
  font-weight: 500;
}
.metronome__tempo {
  display: flex;
  align-items: center;
  gap: 8px;
}
.metronome__presets {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
  font-variant-numeric: tabular-nums;
}
.metronome__presets .v-btn {
  min-width: 0;
  padding: 0 8px;
}
.metronome__input {
  width: 100%;
  height: 48px;
  min-width: 0;
  padding: 0 14px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.4);
  border-radius: 4px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  font: inherit;
  color-scheme: light dark;
}
.metronome__input:focus-visible,
.metronome__color input:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 3px;
}
select.metronome__input {
  appearance: auto;
  cursor: pointer;
}
.metronome__bpm {
  text-align: center;
  font-size: 1.25rem;
  font-variant-numeric: tabular-nums;
  appearance: textfield;
  padding: 0 4px;
}
.metronome__bpm::-webkit-inner-spin-button,
.metronome__bpm::-webkit-outer-spin-button {
  appearance: none;
  margin: 0;
}
.metronome__colors {
  min-width: 0;
  margin-top: 28px;
  padding: 0;
  border: 0;
}
.metronome__palette {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.metronome__color {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}
.metronome__color--current {
  border-color: rgba(var(--v-theme-on-surface), 0.5);
}
.metronome__color input {
  display: block;
  width: 48px;
  height: 40px;
  padding: 0;
  overflow: hidden;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.2);
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
}
.metronome__color input::-webkit-color-swatch-wrapper {
  padding: 0;
}
.metronome__color input::-webkit-color-swatch,
.metronome__color input::-moz-color-swatch {
  border: 0;
}
.metronome__stage--expanded {
  position: fixed;
  inset: 0;
  z-index: 3000;
  width: 100%;
  height: 100dvh;
  background: rgb(var(--v-theme-surface));
}
.metronome__stage--expanded .metronome__display {
  width: 100%;
  height: 100%;
  border-radius: 0;
}
.metronome__stage--expanded .metronome__controls {
  position: absolute;
  right: max(16px, env(safe-area-inset-right));
  bottom: max(16px, env(safe-area-inset-bottom));
  left: max(16px, env(safe-area-inset-left));
  width: fit-content;
  max-width: calc(100% - 32px);
  margin: 0 auto;
  padding: 12px;
  border-radius: 8px;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 2px 12px #0003;
}
@media (max-width: 700px) {
  .metronome__settings {
    grid-template-columns: 1fr;
    gap: 20px;
  }
  .metronome__play {
    min-width: 128px;
  }
  .metronome__stage--expanded .metronome__play {
    min-width: 100px;
  }
  .metronome__stage--expanded .metronome__controls {
    gap: 8px;
  }
}
</style>
