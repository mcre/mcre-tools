<template>
  <v-sheet
    aria-labelledby="group-roulette-stage-title"
    border
    class="group-roulette-stage pa-4 pa-sm-6"
    :class="`group-roulette-stage--${status}`"
    rounded="lg"
    tag="section"
  >
    <div class="stage-toolbar">
      <v-chip :color="statusColor" density="comfortable" size="small">
        {{ $t(`tools.${tool}.${status}`) }}
      </v-chip>

      <span class="stage-toolbar__count">
        {{
          $t(`tools.${tool}.candidateCount`, {
            count: displayOptions.length,
          })
        }}
      </span>
    </div>

    <div class="stage-main">
      <div
        v-if="winnerOption"
        aria-live="polite"
        class="stage-outcome"
        role="status"
      >
        <span>{{ $t(`tools.${tool}.winner`) }}</span>
        <strong>{{ winnerOption.label }}</strong>
      </div>

      <div v-else aria-live="polite" class="stage-heading" role="status">
        <p>{{ $t(guidanceText) }}</p>
      </div>

      <div aria-hidden="true" class="roulette-frame">
        <div class="roulette-pointer" />

        <div
          class="roulette-wheel"
          :class="{
            'roulette-wheel--spinning': status === 'spinning',
            'roulette-wheel--stopping': status === 'stopping',
            'roulette-wheel--empty': displayOptions.length === 0,
          }"
          :style="wheelStyle"
        >
          <div v-if="wheelLabels.length > 0" class="roulette-wheel__labels">
            <span
              v-for="label in wheelLabels"
              :key="label.option.id"
              class="roulette-wheel__label"
              :style="label.style"
              :title="label.option.label"
            >
              <span class="roulette-wheel__label-text">
                <span
                  v-for="(line, lineIndex) in label.lines"
                  :key="`${label.option.id}-${lineIndex}`"
                  class="roulette-wheel__label-line"
                  :style="line.style"
                >
                  <span
                    v-for="(character, characterIndex) in line.characters"
                    :key="`${label.option.id}-${lineIndex}-${characterIndex}`"
                    class="roulette-wheel__label-character"
                    :style="character.style"
                  >
                    {{ character.value }}
                  </span>
                </span>
              </span>
            </span>
          </div>

          <div
            v-if="wheelSeparators.length > 0"
            class="roulette-wheel__separators"
          >
            <span
              v-for="separator in wheelSeparators"
              :key="separator.key"
              class="roulette-wheel__separator"
              :style="separator.style"
            />
          </div>

          <div class="roulette-wheel__center" />
        </div>
      </div>

      <h2 id="group-roulette-stage-title" class="stage-title">
        {{ $t(`tools.${tool}.${status}`) }}
      </h2>
    </div>

    <div class="stage-actions">
      <template v-if="isHost && member">
        <v-btn
          v-if="status === 'spinning' || status === 'stopping'"
          block
          color="warning"
          :disabled="!canStop"
          :prepend-icon="mdiStopCircleOutline"
          size="large"
          @click="$emit('stop')"
        >
          {{ $t(`tools.${tool}.stopSpinPrimary`) }}
        </v-btn>

        <v-btn
          v-else
          block
          color="primary"
          :disabled="!canStart"
          :prepend-icon="mdiPlayCircleOutline"
          size="large"
          @click="$emit('start')"
        >
          {{ $t(`tools.${tool}.startSpinPrimary`) }}
        </v-btn>
      </template>

      <v-alert
        v-else-if="member"
        border="start"
        class="stage-actions__guest"
        density="comfortable"
        type="info"
        variant="tonal"
      >
        {{ $t(guestGuidanceText) }}
      </v-alert>
    </div>
  </v-sheet>
</template>

<script lang="ts" setup>
import type {
  GroupRouletteMember,
  GroupRouletteOption,
  GroupRouletteSpin,
} from "@/apis/@types";
import type { GroupRouletteStatus } from "@/composables/useGroupRoulette";
import { mdiPlayCircleOutline, mdiStopCircleOutline } from "@mdi/js";

const tool = GROUP_ROULETTE_TOOL;

type DisplaySpin = Omit<GroupRouletteSpin, "options"> & {
  readonly options: readonly GroupRouletteOption[];
};

const props = defineProps<{
  activeOptions: readonly GroupRouletteOption[];
  canStart: boolean;
  canStop: boolean;
  currentSpin: DisplaySpin | null;
  guestAddEnabled: boolean;
  isHost: boolean;
  member: GroupRouletteMember | null;
  serverNow: () => number;
  status: GroupRouletteStatus;
  winnerOption: GroupRouletteOption | null;
}>();

defineEmits<{
  start: [];
  stop: [];
}>();

const segmentColors = [
  "#2f8f83",
  "#e9bd50",
  "#df6a4f",
  "#447d9b",
  "#86a96f",
  "#8b6fb4",
  "#c06f8a",
  "#4f8fbd",
];

const displayOptions = computed(() => {
  if (
    props.currentSpin &&
    (props.status === "spinning" ||
      props.status === "stopping" ||
      props.status === "result")
  ) {
    return props.currentSpin.options;
  }
  return [...props.activeOptions];
});

const formatAngle = (angle: number) => Number(angle.toFixed(3)).toString();

const normalizeAngle = (angle: number) => ((angle % 360) + 360) % 360;

const getLabelLayout = (optionCount: number) => {
  if (optionCount <= 4) {
    return {
      baseFontSize: 1.08,
      minFontSize: 0.86,
      characterStep: 1.18,
      labelEdgeMargin: "16px",
      maxCharactersPerLine: 8,
      trackWidth: "3.4em",
      lineOffset: "0.64em",
    };
  }
  if (optionCount <= 8) {
    return {
      baseFontSize: 0.98,
      minFontSize: 0.76,
      characterStep: 1.18,
      labelEdgeMargin: "16px",
      maxCharactersPerLine: 6,
      trackWidth: "3.2em",
      lineOffset: "0.62em",
    };
  }
  if (optionCount <= 16) {
    return {
      baseFontSize: 0.86,
      minFontSize: 0.62,
      characterStep: 1.18,
      labelEdgeMargin: "16px",
      maxCharactersPerLine: 5,
      trackWidth: "3.1em",
      lineOffset: "0.58em",
    };
  }
  if (optionCount <= 32) {
    return {
      baseFontSize: 0.66,
      minFontSize: 0.5,
      characterStep: 1.18,
      labelEdgeMargin: "16px",
      maxCharactersPerLine: 4,
      trackWidth: "2.8em",
      lineOffset: "0.54em",
    };
  }
  return {
    baseFontSize: 0.48,
    minFontSize: 0.4,
    characterStep: 1.18,
    labelEdgeMargin: "16px",
    maxCharactersPerLine: 3,
    trackWidth: "2.6em",
    lineOffset: "0.48em",
  };
};

const formatCssNumber = (value: number) => {
  if (value === 0) return "0";
  return Number(value.toFixed(2)).toString();
};

const buildLabelLines = (
  label: string,
  maxCharactersPerLine: number,
  characterStep: number,
) => {
  const characters = Array.from(label.trim());
  const maxCharacters = maxCharactersPerLine * 2;
  const isTruncated = characters.length > maxCharacters;
  const visibleCharacters = isTruncated
    ? [...characters.slice(0, Math.max(1, maxCharacters - 3)), ".", ".", "."]
    : characters;
  const lineTexts = [
    visibleCharacters.slice(0, maxCharactersPerLine),
    visibleCharacters.slice(maxCharactersPerLine),
  ].filter((lineCharacters) => lineCharacters.length > 0);

  const lines = lineTexts.map((lineCharacters, lineIndex) => {
    const lineOffset =
      lineTexts.length === 1 ? "0em" : lineIndex === 0 ? "-1" : "1";

    return {
      characters: lineCharacters.map((value, characterIndex) => ({
        style: {
          "--label-character-offset": `calc(100% - var(--label-edge-margin) - ${formatCssNumber(
            characterIndex * characterStep,
          )}em)`,
          "--label-character-rotation": "180deg",
        },
        value,
      })),
      style: {
        "--label-line-x":
          lineOffset === "0em"
            ? lineOffset
            : `calc(var(--label-line-offset) * ${lineOffset})`,
      },
    };
  });

  return { isTruncated, lines };
};

const wheelLabels = computed(() => {
  const options = displayOptions.value;
  if (options.length === 0) return [];

  const segment = 360 / options.length;
  const labelLayout = getLabelLayout(options.length);

  return options.map((option, index) => {
    const angle = index * segment + segment / 2;
    const { lines, isTruncated } = buildLabelLines(
      option.label,
      labelLayout.maxCharactersPerLine,
      labelLayout.characterStep,
    );
    const fontSize = isTruncated
      ? labelLayout.minFontSize
      : labelLayout.baseFontSize;

    return {
      lines,
      option,
      style: {
        "--label-angle": `${formatAngle(angle)}deg`,
        "--label-font-size": `${fontSize}rem`,
        "--label-edge-margin": labelLayout.labelEdgeMargin,
        "--label-line-offset": labelLayout.lineOffset,
        "--label-rotation": `${formatAngle(normalizeAngle(angle + 180))}deg`,
        "--label-text-color": "#ffffff",
        "--label-text-shadow": [
          "1px 0 0 #111827",
          "-1px 0 0 #111827",
          "0 1px 0 #111827",
          "0 -1px 0 #111827",
          "1px 1px 0 #111827",
          "-1px 1px 0 #111827",
          "1px -1px 0 #111827",
          "-1px -1px 0 #111827",
          "0 2px 3px rgb(0 0 0 / 45%)",
        ].join(", "),
        "--label-track-width": labelLayout.trackWidth,
      },
    };
  });
});

const wheelSeparators = computed(() => {
  const options = displayOptions.value;
  if (options.length <= 1) return [];

  const segment = 360 / options.length;

  return options.map((option, index) => ({
    key: option.id,
    style: {
      "--separator-angle": `${formatAngle(index * segment)}deg`,
    },
  }));
});

const statusColor = computed(() => {
  switch (props.status) {
    case "result": {
      return "success";
    }
    case "spinning":
    case "stopping": {
      return "warning";
    }
    case "expired": {
      return "error";
    }
    default: {
      return "primary";
    }
  }
});

const guidanceText = computed(() => {
  if (props.status === "idle") return `tools.${tool}.idleStageGuidance`;
  if (props.status === "expired") return `tools.${tool}.expiredStageGuidance`;
  if (displayOptions.value.length === 0) {
    return `tools.${tool}.emptyStageGuidance`;
  }
  if (props.status === "spinning") return `tools.${tool}.spinningGuidance`;
  if (props.status === "stopping") return `tools.${tool}.stoppingGuidance`;
  if (props.status === "result") return `tools.${tool}.resultGuidance`;
  return props.isHost
    ? `tools.${tool}.hostReadyGuidance`
    : `tools.${tool}.guestReadyGuidance`;
});

const guestGuidanceText = computed(() => {
  if (props.status === "spinning" || props.status === "stopping") {
    return `tools.${tool}.guestSpinWaiting`;
  }
  if (props.guestAddEnabled) return `tools.${tool}.guestCanAdd`;
  return `tools.${tool}.hostWaiting`;
});

const stableUnitInterval = (seed: string) => {
  let hash = 2_166_136_261;
  for (const character of seed) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0) / 4_294_967_295;
};

const wheelRotationDeg = computed(() => {
  const options = displayOptions.value;
  if (options.length === 0) return 0;

  const winnerOptionId = props.currentSpin?.winnerOptionId;
  if (winnerOptionId) {
    const winnerIndex = options.findIndex(
      (option) => option.id === winnerOptionId,
    );
    if (winnerIndex !== -1) {
      const segment = 360 / options.length;
      const offsetRatio =
        0.28 +
        stableUnitInterval(`${props.currentSpin?.id ?? ""}:${winnerOptionId}`) *
          0.44;
      return -(winnerIndex * segment + segment * offsetRatio);
    }
  }

  const startedAt = Date.parse(props.currentSpin?.startedAt ?? "");
  const durationMs = props.currentSpin?.durationMs ?? 5000;
  if (!Number.isFinite(startedAt) || durationMs <= 0) return 0;

  const elapsed = Math.max(0, props.serverNow() - startedAt);
  return ((elapsed / durationMs) * 1440) % 360;
});

const wheelBackground = computed(() => {
  const options = displayOptions.value;
  if (options.length === 0) {
    return "conic-gradient(from 0deg, #d7dee8 0deg 120deg, #eef2f6 120deg 240deg, #c9d4df 240deg 360deg)";
  }

  const segments = options.map((_, index) => {
    const color = segmentColors[index % segmentColors.length];
    const segment = 360 / options.length;
    const start = index * segment;
    const end = (index + 1) * segment;

    return `${color} ${start}deg ${end}deg`;
  });

  return `conic-gradient(from 0deg, ${segments.join(", ")})`;
});

const wheelStyle = computed(() => ({
  "--roulette-phase": `${wheelRotationDeg.value}deg`,
  background: wheelBackground.value,
  transform:
    props.status === "stopping" || props.status === "result"
      ? `rotate(${wheelRotationDeg.value}deg)`
      : undefined,
}));
</script>

<style scoped>
.group-roulette-stage {
  display: grid;
  gap: 18px;
  min-height: 100%;
}

.stage-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}

.stage-toolbar__count {
  color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 68%, transparent);
  font-size: 0.875rem;
}

.stage-main {
  display: grid;
  gap: 14px;
  justify-items: center;
  text-align: center;
}

.stage-heading,
.stage-outcome {
  display: grid;
  gap: 4px;
  min-height: 76px;
  align-content: center;
}

.stage-heading p {
  max-width: 28rem;
  margin: 0;
  color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 68%, transparent);
}

.stage-outcome {
  width: min(100%, 520px);
  padding: 14px 18px;
  border: 1px solid rgb(var(--v-theme-success));
  border-radius: 8px;
  background: color-mix(in srgb, rgb(var(--v-theme-success)) 12%, transparent);
}

.stage-outcome span {
  color: rgb(var(--v-theme-success));
  font-size: 0.8rem;
  font-weight: 700;
}

.stage-outcome strong {
  overflow-wrap: anywhere;
  font-size: clamp(1.8rem, 5vw, 3.25rem);
  line-height: 1.1;
}

.roulette-frame {
  position: relative;
  display: grid;
  width: min(100%, 520px);
  place-items: center;
  padding-top: 18px;
}

.roulette-pointer {
  position: absolute;
  top: 0;
  z-index: 3;
  width: 0;
  height: 0;
  border-right: 15px solid transparent;
  border-left: 15px solid transparent;
  border-top: 24px solid rgb(var(--v-theme-on-surface));
}

.roulette-wheel {
  position: relative;
  display: grid;
  width: min(100%, 440px);
  aspect-ratio: 1;
  place-items: center;
  border: 4px solid rgb(var(--v-theme-surface));
  border-radius: 50%;
  box-shadow:
    0 0 0 1px rgb(var(--v-theme-outline-variant)),
    0 18px 50px rgb(0 0 0 / 16%);
  overflow: hidden;
  transition: transform 1400ms cubic-bezier(0.14, 0.74, 0.24, 1);
}

.roulette-wheel--empty {
  box-shadow: inset 0 0 0 1px rgb(var(--v-theme-outline-variant));
}

.roulette-wheel--spinning {
  animation: roulette-spin 900ms linear infinite;
}

.roulette-wheel__labels {
  position: absolute;
  inset: 0;
  z-index: 2;
  border-radius: 50%;
  pointer-events: none;
}

.roulette-wheel__separators {
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: 50%;
  pointer-events: none;
}

.roulette-wheel__separator {
  position: absolute;
  bottom: 50%;
  left: calc(50% - 1.5px);
  width: 3px;
  height: 50%;
  background: rgb(var(--v-theme-surface));
  transform: rotate(var(--separator-angle));
  transform-origin: bottom center;
}

.roulette-wheel__label {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  color: var(--label-text-color);
  font-size: var(--label-font-size);
  font-weight: 800;
  line-height: 1.12;
  text-align: center;
  text-shadow: var(--label-text-shadow);
  transform: rotate(var(--label-rotation));
  transform-origin: center;
}

.roulette-wheel__label-text {
  position: absolute;
  top: 50%;
  left: 50%;
  box-sizing: border-box;
  width: var(--label-track-width);
  height: 50%;
  overflow: hidden;
  transform: translateX(-50%);
}

.roulette-wheel__label-line {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1em;
  transform: translateX(calc(-50% + var(--label-line-x)));
}

.roulette-wheel__label-character {
  position: absolute;
  top: var(--label-character-offset);
  left: 50%;
  display: block;
  line-height: 1;
  text-align: center;
  transform: translate(-50%, -50%) rotate(var(--label-character-rotation));
  white-space: nowrap;
}

.roulette-wheel__center {
  z-index: 3;
  display: grid;
  width: 12%;
  aspect-ratio: 1;
  place-items: center;
  border-radius: 50%;
  background: rgb(var(--v-theme-surface));
  box-shadow:
    0 0 0 1px rgb(var(--v-theme-outline-variant)),
    0 4px 12px rgb(0 0 0 / 10%);
}

.stage-title {
  margin: 0;
  font-size: clamp(1.3rem, 3vw, 2rem);
  line-height: 1.2;
}

.stage-actions {
  display: grid;
  gap: 10px;
}

.stage-actions__guest {
  text-align: start;
}

@keyframes roulette-spin {
  from {
    transform: rotate(var(--roulette-phase, 0deg));
  }

  to {
    transform: rotate(calc(var(--roulette-phase, 0deg) + 360deg));
  }
}

@media (prefers-reduced-motion: reduce) {
  .roulette-wheel,
  .roulette-wheel--spinning {
    transition: none;
    animation-duration: 2400ms;
  }
}

@media (max-width: 600px) {
  .roulette-wheel {
    width: min(100%, 330px);
    border-width: 3px;
  }
}
</style>
