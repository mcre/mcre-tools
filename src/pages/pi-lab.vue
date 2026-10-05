<template>
  <tool-heading :tool="tool" />

  <v-container class="pi-lab">
    <p v-if="reducedMotion" class="pi-lab__note">
      {{ $t(`${messages}.reducedMotion`) }}
    </p>

    <section
      id="pi-wheel"
      aria-labelledby="pi-wheel-title"
      class="pi-lab__experiment pi-lab__wheel"
      data-testid="wheel"
    >
      <header class="pi-lab__header">
        <span aria-hidden="true" class="pi-lab__badge">01</span>

        <div>
          <h2 id="pi-wheel-title">{{ $t(`${messages}.wheel.title`) }}</h2>
          <p>{{ $t(`${messages}.wheel.description`) }}</p>
        </div>
      </header>

      <div class="pi-lab__wheel-stage">
        <svg
          :aria-label="
            $t(`${messages}.wheel.visual`, {
              turns: rolling.turns.toFixed(3),
              diameter: rolling.diameter,
            })
          "
          class="pi-lab__wheel-svg"
          role="img"
          viewBox="0 -16 360 246"
        >
          <path class="pi-lab__axis" d="M12 90H348" />

          <circle
            class="pi-lab__ghost"
            :cx="wheelStart"
            :cy="90 - wheelRadius"
            :r="wheelRadius"
          />

          <path class="pi-lab__distance" :d="`M${wheelStart} 90H${wheelX}`" />

          <circle
            class="pi-lab__wheel-disc"
            :cx="wheelX"
            :cy="90 - wheelRadius"
            :r="wheelRadius"
          />

          <circle
            v-if="angle > 0"
            class="pi-lab__wheel-arc"
            :cx="wheelX"
            :cy="90 - wheelRadius"
            :r="wheelRadius"
            :stroke-dasharray="`${wheelRadius * angle} ${wheelRadius * fullTurn}`"
            :transform="`rotate(90 ${wheelX} ${90 - wheelRadius})`"
          />

          <path
            class="pi-lab__wheel-dimension"
            :d="wheelDiameterPath"
            data-testid="wheel-diameter-line"
          />

          <g
            :transform="`translate(${wheelX}, ${90 - wheelRadius}) rotate(${(angle * 180) / Math.PI})`"
          >
            <path class="pi-lab__wheel-spoke" :d="`M0 0V${wheelRadius}`" />
            <circle class="pi-lab__wheel-mark" :cy="wheelRadius" r="3" />
            <circle fill="currentColor" r="2" />
          </g>

          <text
            class="pi-lab__wheel-caption"
            data-testid="wheel-diameter-caption"
            text-anchor="middle"
            :x="wheelX"
            :y="90 - wheelDiameter - 8"
          >
            {{
              $t(`${messages}.wheel.diameterValue`, {
                diameter: rolling.diameter,
              })
            }}
          </text>

          <path
            class="pi-lab__wheel-guide"
            :d="`M${wheelX} 90V99M${wheelX} 117V128M${wheelX} 171V183`"
          />

          <g data-testid="wheel-distance-axis">
            <text class="pi-lab__axis-title" x="12" y="113">
              {{ $t(`${messages}.wheel.distance`) }}
            </text>

            <path class="pi-lab__axis" :d="`M${wheelStart} 122H348`" />

            <g v-for="tick in [0, 1, 2, 3, 4, 5, 6, 7]" :key="tick">
              <path
                class="pi-lab__axis"
                :d="`M${wheelStart + tick * wheelUnitLength} 122v6`"
              />

              <text
                class="pi-lab__axis-tick-label"
                text-anchor="middle"
                :x="wheelStart + tick * wheelUnitLength"
                y="145"
              >
                {{ tick }}
              </text>
            </g>
          </g>

          <g data-testid="wheel-ratio-axis">
            <text class="pi-lab__axis-title" x="12" y="166">
              {{ $t(`${messages}.wheel.ratio`) }}
            </text>

            <path class="pi-lab__axis" :d="`M${wheelStart} 176H${wheelEnd}`" />

            <g v-for="tick in [0, 1, 2, 3]" :key="tick">
              <path
                class="pi-lab__axis"
                :d="`M${wheelStart + tick * wheelDiameter} 176v6`"
              />

              <text
                class="pi-lab__axis-tick-label"
                text-anchor="middle"
                :x="wheelStart + tick * wheelDiameter"
                y="199"
              >
                {{ tick }}
              </text>
            </g>

            <path class="pi-lab__pi-line" :d="`M${wheelEnd} 176v7`" />

            <text
              class="pi-lab__axis-tick-label pi-lab__inner"
              text-anchor="middle"
              :x="wheelEnd"
              y="222"
            >
              π
            </text>
          </g>

          <circle
            v-for="y in [122, 176]"
            :key="y"
            class="pi-lab__wheel-axis-mark"
            :cx="wheelX"
            :cy="y"
            r="2.5"
          />
        </svg>
      </div>

      <div class="pi-lab__wheel-panel">
        <div class="pi-lab__result">
          <span>{{ $t(`${messages}.wheel.ratio`) }}</span>

          <div class="pi-lab__wheel-calculation">
            <dl>
              <dt>
                {{
                  $t(
                    `${messages}.wheel.${complete ? "circumference" : "distance"}`,
                  )
                }}
              </dt>

              <dd data-testid="wheel-distance">
                {{ rolling.distance.toFixed(6) }}
              </dd>
            </dl>

            <span aria-hidden="true">÷</span>

            <dl>
              <dt>{{ $t(`${messages}.wheel.diameter`) }}</dt>

              <dd data-testid="wheel-diameter">
                {{ rolling.diameter }}
              </dd>
            </dl>

            <span aria-hidden="true">≈</span>
          </div>

          <div class="pi-lab__wheel-answer">
            <output
              :aria-live="wheelPlayback.running.value ? 'off' : 'polite'"
              data-testid="wheel-ratio"
              >{{ rolling.distanceInDiameters.toFixed(12) }}</output
            >

            <span
              v-if="complete"
              :aria-label="$t(`${messages}.wheel.complete`)"
              class="pi-lab__inner"
              data-testid="wheel-complete"
              role="status"
              >≈ π</span
            >
          </div>
        </div>

        <div class="pi-lab__panel">
          <div class="pi-lab__speed pi-lab__wheel-size">
            <label for="pi-wheel-diameter">{{
              $t(`${messages}.wheel.diameter`)
            }}</label>

            <output for="pi-wheel-diameter">{{ rolling.diameter }}</output>

            <input
              id="pi-wheel-diameter"
              :aria-label="$t(`${messages}.wheel.diameter`)"
              max="2"
              min="0.5"
              step="0.1"
              type="range"
              :value="diameter"
              @input="setWheelDiameter"
            />
          </div>

          <div class="pi-lab__wheel-rotation">
            <v-btn
              color="primary"
              height="44"
              :prepend-icon="wheelPlayback.running.value ? mdiPause : mdiPlay"
              variant="flat"
              @click="playWheel"
              >{{
                $t(
                  `${messages}.${reducedMotion ? "wheel.step" : wheelPlayback.running.value ? "stop" : complete ? "wheel.replay" : "wheel.play"}`,
                )
              }}</v-btn
            >

            <label for="pi-wheel-progress">{{
              $t(`${messages}.wheel.turns`, { turns: rolling.turns.toFixed(3) })
            }}</label>

            <input
              id="pi-wheel-progress"
              :aria-label="$t(`${messages}.wheel.scrub`)"
              :aria-valuetext="
                $t(`${messages}.wheel.turns`, {
                  turns: rolling.turns.toFixed(3),
                })
              "
              max="1"
              min="0"
              step="0.001"
              type="range"
              :value="rolling.turns"
              @input="scrub"
            />
          </div>
        </div>
      </div>
    </section>

    <section
      id="pi-polygon"
      aria-labelledby="pi-polygon-title"
      class="pi-lab__experiment pi-lab__polygon"
      :class="{ 'pi-lab__polygon--precise': polygonDisplay.decimals > 6 }"
      data-testid="polygon"
    >
      <header class="pi-lab__header">
        <span aria-hidden="true" class="pi-lab__badge">02</span>

        <div>
          <h2 id="pi-polygon-title">{{ $t(`${messages}.polygon.title`) }}</h2>
          <p>{{ $t(`${messages}.polygon.description`) }}</p>
        </div>
      </header>

      <div class="pi-lab__grid pi-lab__polygon-grid">
        <div class="pi-lab__visual">
          <svg
            :aria-label="
              $t(
                `${messages}.polygon.${drawAsCircle ? 'visualCircle' : 'visual'}`,
                {
                  sides,
                  diameter: polygonDiameter,
                },
              )
            "
            class="pi-lab__geometry"
            role="img"
            :viewBox="polygonViewBox"
          >
            <polygon
              v-if="!drawAsCircle"
              class="pi-lab__outer-polygon"
              :points="outerPoints"
            />

            <circle
              v-else
              class="pi-lab__outer-polygon"
              cx="160"
              cy="160"
              r="112"
            />

            <circle class="pi-lab__circle" cx="160" cy="160" r="112" />

            <polygon
              v-if="!drawAsCircle"
              class="pi-lab__inner-polygon"
              :points="innerPoints"
            />

            <circle
              v-else
              class="pi-lab__inner-polygon"
              cx="160"
              cy="160"
              r="112"
            />

            <line
              class="pi-lab__diameter"
              data-testid="polygon-diameter-line"
              x1="48"
              x2="272"
              y1="160"
              y2="160"
            />

            <text
              aria-hidden="true"
              class="pi-lab__diameter-label"
              data-testid="polygon-diameter"
              text-anchor="middle"
              x="160"
              y="148"
            >
              {{ polygonDiameter }}
            </text>

            <circle cx="160" cy="160" fill="currentColor" r="3" />
          </svg>

          <div class="pi-lab__legend">
            <span class="pi-lab__inner"
              >― {{ $t(`${messages}.polygon.inner`) }}</span
            >

            <span>○ {{ $t(`${messages}.polygon.circle`) }}</span>

            <span class="pi-lab__outer"
              >┄ {{ $t(`${messages}.polygon.outer`) }}</span
            >
          </div>
        </div>

        <div class="pi-lab__panel">
          <div class="pi-lab__result">
            <span>{{ $t(`${messages}.polygon.range`) }}</span>

            <output aria-live="polite" class="pi-lab__bounds"
              ><strong class="pi-lab__inner" data-testid="polygon-lower">{{
                lowerDisplay
              }}</strong>

              <span>&lt; π &lt;</span>

              <strong class="pi-lab__outer" data-testid="polygon-upper">{{
                upperDisplay
              }}</strong></output
            >
          </div>

          <div
            :aria-label="$t(`${messages}.polygon.interval`, polygonRange)"
            class="pi-lab__interval"
            role="img"
          >
            <div class="pi-lab__interval-track">
              <span
                :style="{
                  left: `${intervalLeft}%`,
                  width: `${intervalWidth}%`,
                }"
              />

              <i :style="{ left: `${intervalPi}%` }" />
            </div>

            <div class="pi-lab__interval-labels">
              <span>{{ polygonRange.min }}</span>

              <span :style="{ left: `${intervalPi}%` }">π</span>

              <span>{{ polygonRange.max }}</span>
            </div>
          </div>

          <div class="pi-lab__calculation" data-testid="polygon-calculation">
            <span class="pi-lab__formula">{{
              $t(`${messages}.polygon.calculation`, {
                diameter: polygonDiameter,
              })
            }}</span>

            <dl>
              <div class="pi-lab__inner">
                <dt>{{ $t(`${messages}.polygon.inner`) }}</dt>

                <dd>
                  <span data-testid="polygon-inner-perimeter">{{
                    polygonDisplay.innerPerimeter
                  }}</span>
                  ÷ {{ polygonDiameter }}
                  <span class="pi-lab__calculation-result"
                    >≈ {{ lowerDisplay }}</span
                  >
                </dd>
              </div>

              <div class="pi-lab__outer">
                <dt>{{ $t(`${messages}.polygon.outer`) }}</dt>

                <dd>
                  <span data-testid="polygon-outer-perimeter">{{
                    polygonDisplay.outerPerimeter
                  }}</span>
                  ÷ {{ polygonDiameter }}
                  <span class="pi-lab__calculation-result"
                    >≈ {{ upperDisplay }}</span
                  >
                </dd>
              </div>
            </dl>
          </div>

          <div class="pi-lab__speed pi-lab__sides">
            <output
              class="pi-lab__shape"
              data-testid="polygon-sides"
              for="pi-polygon-shape"
              >{{ polygonShape }}</output
            >

            <input
              id="pi-polygon-shape"
              :aria-label="$t(`${messages}.polygon.shape`)"
              :aria-valuemax="maxSides"
              aria-valuemin="3"
              :aria-valuenow="sides"
              :aria-valuetext="polygonShape"
              max="100"
              min="0"
              step="any"
              type="range"
              :value="polygonSliderPosition(sides)"
              @input="setPolygonPosition"
              @keydown="onPolygonKey"
            />
          </div>
        </div>
      </div>

      <details class="pi-lab__details">
        <summary>{{ $t(`${messages}.why`) }}</summary>

        <p>{{ $t(`${messages}.polygon.explanation`) }}</p>
        <p class="pi-lab__formula">n × sin(π / n) &lt; π &lt; n × tan(π / n)</p>
      </details>
    </section>

    <section
      id="pi-monte"
      aria-labelledby="pi-monte-title"
      class="pi-lab__experiment pi-lab__monte"
      data-testid="monte-carlo"
    >
      <header class="pi-lab__header">
        <span aria-hidden="true" class="pi-lab__badge">03</span>

        <div>
          <h2 id="pi-monte-title">{{ $t(`${messages}.monte.title`) }}</h2>
          <p>{{ $t(`${messages}.monte.description`) }}</p>
        </div>
      </header>

      <div class="pi-lab__grid pi-lab__monte-grid">
        <div class="pi-lab__visual">
          <div class="pi-lab__square">
            <canvas
              ref="canvas"
              :aria-label="$t(`${messages}.monte.visual`)"
              height="640"
              role="img"
              width="640"
            />

            <svg
              aria-hidden="true"
              class="pi-lab__outline"
              viewBox="0 0 320 320"
            >
              <rect
                fill="none"
                height="312"
                stroke="currentColor"
                stroke-width="1.5"
                width="312"
                x="4"
                y="4"
              />

              <circle
                cx="160"
                cy="160"
                fill="none"
                r="156"
                stroke="currentColor"
                stroke-width="1.5"
              />
            </svg>
          </div>

          <div class="pi-lab__legend">
            <span class="pi-lab__inner"
              >● {{ $t(`${messages}.monte.inside`) }}</span
            >

            <span class="pi-lab__outer"
              >● {{ $t(`${messages}.monte.outside`) }}</span
            >
          </div>

          <p class="pi-lab__note" data-testid="mc-drawing-note">
            {{
              $t(`${messages}.monte.drawingLimit`, {
                count: MONTE_CARLO_DRAW_LIMIT.toLocaleString("en-US"),
              })
            }}
          </p>
        </div>

        <div class="pi-lab__panel">
          <div class="pi-lab__result">
            <span>{{ $t(`${messages}.monte.estimate`) }}</span>

            <output
              :aria-live="montePlayback.running.value ? 'off' : 'polite'"
              class="pi-lab__big pi-lab__estimate"
              data-testid="mc-estimate"
              >{{
                monte.estimate.value === null
                  ? "—"
                  : monte.estimate.value.toFixed(15)
              }}</output
            >

            <span class="pi-lab__formula">4 × M ÷ N</span>
          </div>

          <dl class="pi-lab__metrics">
            <div>
              <dt>{{ $t(`${messages}.monte.total`) }} (N)</dt>
              <dd data-testid="mc-total">{{ monte.total.value }}</dd>
            </div>

            <div>
              <dt>{{ $t(`${messages}.monte.inside`) }} (M)</dt>
              <dd data-testid="mc-inside">{{ monte.inside.value }}</dd>
            </div>
          </dl>
        </div>

        <div class="pi-lab__controls">
          <v-btn
            :disabled="monte.atLimit.value"
            height="44"
            variant="tonal"
            @click="addPoints(1)"
            >{{ $t(`${messages}.monte.addOne`) }}</v-btn
          >

          <v-btn
            :disabled="monte.atLimit.value"
            height="44"
            variant="tonal"
            @click="addPoints(100)"
            >{{ $t(`${messages}.monte.addBatch`) }}</v-btn
          >

          <v-btn
            color="primary"
            :disabled="reducedMotion || monte.atLimit.value"
            height="44"
            :prepend-icon="montePlayback.running.value ? mdiPause : mdiPlay"
            variant="flat"
            @click="toggle(montePlayback)"
            >{{
              $t(
                `${messages}.${montePlayback.running.value ? "stop" : "monte.auto"}`,
              )
            }}</v-btn
          >

          <v-btn
            height="44"
            :prepend-icon="mdiRestore"
            variant="text"
            @click="resetMonte"
            >{{ $t(`${messages}.reset`) }}</v-btn
          >
        </div>

        <div class="pi-lab__speed">
          <label for="pi-monte-speed">{{
            $t(`${messages}.monte.speed`)
          }}</label>

          <output data-testid="mc-speed-value" for="pi-monte-speed">{{
            monteSpeedText
          }}</output>

          <input
            id="pi-monte-speed"
            v-model.number="monteSpeed"
            :aria-label="$t(`${messages}.monte.speed`)"
            :aria-valuetext="monteSpeedText"
            max="4"
            min="0"
            step="0.1"
            type="range"
          />
        </div>

        <p v-if="monte.atLimit.value" class="pi-lab__note" role="status">
          {{ $t(`${messages}.monte.limit`) }}
        </p>

        <figure class="pi-lab__chart">
          <figcaption>{{ $t(`${messages}.monte.graph`) }}</figcaption>

          <svg
            ref="chart"
            :aria-label="$t(`${messages}.monte.graphAlt`)"
            role="img"
            :viewBox="`0 0 ${chartWidth} 130`"
          >
            <defs>
              <clipPath id="pi-monte-plot">
                <rect height="92" :width="plotWidth" x="72" y="10" />
              </clipPath>
            </defs>

            <text
              class="pi-lab__chart-label"
              data-testid="mc-y-max"
              text-anchor="end"
              x="62"
              y="16"
            >
              {{ graphRange.max.toFixed(graphRange.decimals) }}
            </text>

            <text
              class="pi-lab__chart-label"
              data-testid="mc-y-min"
              text-anchor="end"
              x="62"
              y="105"
            >
              {{ graphRange.min.toFixed(graphRange.decimals) }}
            </text>

            <path
              class="pi-lab__axis"
              :d="`M72 10V102H${plotEnd}`"
              fill="none"
            />

            <path
              class="pi-lab__pi-line"
              :d="`M72 ${graphY(Math.PI)}H${plotEnd}`"
              fill="none"
            />

            <text class="pi-lab__chart-label" x="78" :y="graphY(Math.PI) - 5">
              π
            </text>

            <path
              class="pi-lab__trace"
              clip-path="url(#pi-monte-plot)"
              :d="tracePath"
              data-testid="mc-trace"
              fill="none"
            />

            <circle
              v-if="monte.estimate.value !== null"
              class="pi-lab__trace-point"
              :cx="plotEnd"
              :cy="graphY(monte.estimate.value)"
              r="3"
            />

            <text class="pi-lab__chart-label" x="72" y="123">0</text>

            <text
              class="pi-lab__chart-label"
              text-anchor="end"
              :x="plotEnd"
              y="123"
            >
              {{ monte.total.value }} N
            </text>
          </svg>
        </figure>
      </div>
    </section>

    <section
      id="pi-area"
      aria-labelledby="pi-area-title"
      class="pi-lab__experiment pi-lab__area"
      data-testid="circle-area"
    >
      <header class="pi-lab__header">
        <span aria-hidden="true" class="pi-lab__badge">04</span>

        <div>
          <h2 id="pi-area-title">{{ $t(`${messages}.area.title`) }}</h2>
          <p>{{ $t(`${messages}.area.description`) }}</p>
        </div>
      </header>

      <div class="pi-lab__area-stage">
        <svg
          :aria-label="
            $t(`${messages}.area.visual`, { count: area.count.value })
          "
          role="img"
          viewBox="0 0 360 220"
        >
          <g transform="translate(180 104)">
            <rect
              v-if="area.layout.value === 1"
              class="pi-lab__area-limit"
              data-testid="area-limit-rectangle"
              :height="areaRadius"
              :width="Math.PI * areaRadius"
              :x="(-Math.PI * areaRadius) / 2"
              :y="-areaRadius / 2"
            />

            <g data-testid="area-sectors">
              <path
                v-for="(sector, index) in areaSectors"
                :key="index"
                :class="[
                  'pi-lab__area-piece',
                  { 'pi-lab__area-piece--top': index % 2 === 1 },
                ]"
                :d="areaSectorPath"
                :transform="`translate(${sector.x} ${sector.y}) rotate(${sector.rotation})`"
              />
            </g>

            <g v-if="area.layout.value === 0">
              <path class="pi-lab__area-radius" :d="`M0 0H${areaRadius}`" />

              <text
                class="pi-lab__area-label"
                data-testid="area-radius-label"
                text-anchor="middle"
                :x="areaRadius / 2"
                y="-10"
              >
                {{ $t(`${messages}.area.radius`) }}
              </text>
            </g>

            <g v-if="area.layout.value === 1">
              <path class="pi-lab__area-radius" :d="areaSidePath" />

              <text
                class="pi-lab__area-label"
                data-testid="area-radius-label"
                text-anchor="middle"
                :x="areaLeft - 10"
                :y="-areaGeometry.rowHeight / 2 - 14"
              >
                {{ $t(`${messages}.area.radius`) }}
              </text>

              <path class="pi-lab__area-half-arc" :d="areaHalfArc" />
            </g>
          </g>

          <text
            v-if="area.layout.value === 1"
            class="pi-lab__area-label pi-lab__area-label--arc"
            data-testid="area-half-circumference-label"
            text-anchor="middle"
            x="180"
            y="181"
          >
            <tspan x="180">
              {{ $t(`${messages}.area.halfCircumference`) }}
            </tspan>

            <tspan dy="22" x="180">
              {{ $t(`${messages}.area.halfCircumferenceFormula`) }}
            </tspan>
          </text>
        </svg>
      </div>

      <div class="pi-lab__area-panel">
        <div class="pi-lab__result">
          <span>{{ $t(`${messages}.area.calculation`) }}</span>

          <div
            class="pi-lab__area-formula-words"
            data-testid="area-formula-words"
          >
            {{ $t(`${messages}.area.formulaWords`) }}
          </div>

          <output
            :aria-label="$t(`${messages}.area.formulaAlt`)"
            class="pi-lab__area-formula"
            data-testid="area-formula"
            >πr × r = πr²</output
          >
        </div>

        <div class="pi-lab__panel">
          <v-btn
            :aria-pressed="area.target.value === 1"
            color="primary"
            height="44"
            variant="flat"
            @click="area.toggle"
            >{{
              $t(
                `${messages}.area.${area.target.value === 1 ? "restore" : "rearrange"}`,
              )
            }}</v-btn
          >

          <div class="pi-lab__speed pi-lab__area-count">
            <output class="pi-lab__shape" for="pi-area-count">{{
              $t(`${messages}.area.count`, { count: area.count.value })
            }}</output>

            <input
              id="pi-area-count"
              :aria-label="$t(`${messages}.area.sectors`)"
              :aria-valuetext="
                $t(`${messages}.area.count`, { count: area.count.value })
              "
              :max="AREA_MAX_SECTORS"
              min="4"
              step="2"
              type="range"
              :value="area.count.value"
              @input="
                area.setCount(Number(($event.target as HTMLInputElement).value))
              "
            />
          </div>
        </div>
      </div>
    </section>
  </v-container>
</template>

<script lang="ts" setup>
import { mdiPause, mdiPlay, mdiRestore } from "@mdi/js";
import { useHead } from "@unhead/vue";
import { useI18n } from "vue-i18n";

const tool = "pi-lab";
const messages = `tools.${tool}`;
const { t, n } = useI18n();
useHead(useHeaderUtil().getHead(tool));
const reducedMotion = ref(false);
const route = useRoute();
const canvas = ref<HTMLCanvasElement | null>(null);
const chart = ref<SVGSVGElement | null>(null);
const chartWidth = ref(360);
const plotEnd = computed(() => chartWidth.value - 10);
const plotWidth = computed(() => plotEnd.value - 72);
const monte = useMonteCarloExperiment();
const monteSpeed = ref(0);
const monteInterval = 20;
const monteRequestedRate = computed(
  () => 10 * monteCarloBatchSize(monteSpeed.value),
);
const monteSpeedText = computed(() =>
  t(`${messages}.monte.speedValue`, {
    count: monteRequestedRate.value.toLocaleString("en-US"),
  }),
);
const paintPoints = () => {
  const context = canvas.value?.getContext("2d");
  if (!context) return;
  for (const point of monte.batch.value) {
    const x = 320 + point.x * 312;
    const y = 320 + point.y * 312;
    context.fillStyle = point.inside ? "#2364c5" : "#c25a12";
    context.beginPath();
    context.arc(x, y, 2.4, 0, 2 * Math.PI);
    context.fill();
  }
};
const addPoints = (count: number, timeBudgetMs = Infinity) => {
  monte.add(count, timeBudgetMs);
  paintPoints();
  if (monte.atLimit.value) montePlayback.stop();
};
const montePlayback = usePiPlayback(() => {
  addPoints(Math.round((monteRequestedRate.value * monteInterval) / 1000), 8);
  return !monte.atLimit.value;
}, monteInterval);
const resetMonte = () => {
  montePlayback.stop();
  monte.reset();
  canvas.value?.getContext("2d")?.clearRect(0, 0, 640, 640);
};
const graphRange = computed(() => monteCarloGraphRange(monte.history.value));
const graphY = (value: number) => monteCarloGraphY(value, graphRange.value);
const tracePath = computed(() =>
  monte.history.value
    .map(
      (point, index) =>
        `${index ? "L" : "M"}${72 + (point.total / monte.total.value) * plotWidth.value},${graphY(point.estimate)}`,
    )
    .join(" "),
);

const maxSides = MAX_POLYGON_SIDES;
const sides = ref(6);
const polygonDiameter = 1;
const polygonShape = computed(() =>
  t(`${messages}.polygon.shapeValue`, { count: n(sides.value) }),
);
const bounds = computed(() => polygonBounds(sides.value, polygonDiameter / 2));
const polygonDisplay = computed(() =>
  polygonDisplayValues(sides.value, polygonDiameter / 2),
);
const drawAsCircle = computed(() => sides.value >= POLYGON_VERTEX_LIMIT);
const polygonViewBox = computed(() => {
  const extent = Math.max(160, 112 / Math.cos(Math.PI / sides.value) + 16);
  return `${160 - extent} ${160 - extent} ${extent * 2} ${extent * 2}`;
});
const lowerDisplay = computed(() => polygonDisplay.value.lower);
const upperDisplay = computed(() => polygonDisplay.value.upper);
const innerPoints = computed(() =>
  polygonVerticesForDisplay(sides.value, 112, false)
    .map(({ x, y }) => `${160 + x},${160 + y}`)
    .join(" "),
);
const outerPoints = computed(() =>
  polygonVerticesForDisplay(sides.value, 112, true)
    .map(({ x, y }) => `${160 + x},${160 + y}`)
    .join(" "),
);
const polygonRange = computed(() =>
  bounds.value.lower < 3 || bounds.value.upper > 3.5
    ? { min: 2.5, max: 5.5 }
    : { min: 3, max: 3.5 },
);
const intervalScale = computed(
  () => 100 / (polygonRange.value.max - polygonRange.value.min),
);
const intervalLeft = computed(
  () => (bounds.value.lower - polygonRange.value.min) * intervalScale.value,
);
const intervalWidth = computed(
  () => (bounds.value.upper - bounds.value.lower) * intervalScale.value,
);
const intervalPi = computed(
  () => (Math.PI - polygonRange.value.min) * intervalScale.value,
);
const selectPolygon = (count: number) => {
  sides.value = Math.max(3, Math.min(maxSides, count));
};
const setPolygonPosition = (event: Event) =>
  selectPolygon(
    polygonSidesForPosition(Number((event.target as HTMLInputElement).value)),
  );
const polygonKeySteps: Record<string, number> = {
  ArrowRight: 1,
  ArrowUp: 1,
  ArrowLeft: -1,
  ArrowDown: -1,
  PageUp: 10,
  PageDown: -10,
};
const onPolygonKey = (event: KeyboardEvent) => {
  const delta = polygonKeySteps[event.key];
  if (delta === undefined && event.key !== "Home" && event.key !== "End")
    return;
  event.preventDefault();
  selectPolygon(
    event.key === "Home"
      ? 3
      : event.key === "End"
        ? maxSides
        : sides.value + delta!,
  );
};
const angle = ref(0);
const diameter = ref(1);
const fullTurn = 2 * Math.PI;
const rolling = computed(() => rollingCircle(diameter.value / 2, angle.value));
const complete = computed(() => angle.value >= fullTurn);
const wheelUnitLength = 40;
const wheelRadius = computed(() => (diameter.value * wheelUnitLength) / 2);
const wheelDiameter = computed(() => diameter.value * wheelUnitLength);
const wheelStart = 52;
const wheelX = computed(
  () => wheelStart + rolling.value.distance * wheelUnitLength,
);
const wheelEnd = computed(
  () => wheelStart + rolling.value.circumference * wheelUnitLength,
);
const wheelDiameterPath = computed(() => {
  const left = wheelX.value - wheelRadius.value;
  const right = wheelX.value + wheelRadius.value;
  const centerY = 90 - wheelRadius.value;
  return `M${left} ${centerY}H${right}M${left} ${centerY - 3}v6M${right} ${centerY - 3}v6`;
});
const wheelPlayback = usePiPlayback((elapsed) => {
  angle.value = Math.min(
    fullTurn,
    angle.value + (Math.min(elapsed, 100) / 6000) * fullTurn,
  );
  return !complete.value;
}, 16);
const playWheel = () => {
  if (reducedMotion.value) {
    wheelPlayback.stop();
    angle.value = complete.value
      ? 0
      : Math.min(fullTurn, angle.value + Math.PI / 2);
  } else if (wheelPlayback.running.value) wheelPlayback.stop();
  else {
    if (complete.value) angle.value = 0;
    wheelPlayback.start();
  }
};
const scrub = (event: Event) => {
  wheelPlayback.stop();
  angle.value = Number((event.target as HTMLInputElement).value) * fullTurn;
};
const setWheelDiameter = (event: Event) => {
  wheelPlayback.stop();
  diameter.value = Number((event.target as HTMLInputElement).value);
};
const toggle = (playback: ReturnType<typeof usePiPlayback>) => {
  if (playback.running.value) playback.stop();
  else if (!reducedMotion.value) playback.start();
};
const area = usePiAreaExperiment(reducedMotion);
const areaRadius = 76;
const areaGeometry = computed(() =>
  circleAreaGeometry(area.count.value, areaRadius),
);
const areaSectorPath = computed(() =>
  circleAreaSectorPath(area.count.value, areaRadius),
);
const areaSectors = computed(() =>
  circleAreaSectors(area.count.value, areaRadius, area.layout.value),
);
const areaLeft = computed(
  () => (-(area.count.value - 1) / 2) * areaGeometry.value.halfChord,
);
const areaSidePath = computed(
  () =>
    `M${areaLeft.value - 10} ${-areaGeometry.value.rowHeight / 2}l${-areaGeometry.value.halfChord} ${areaGeometry.value.rowHeight}`,
);
const areaHalfArc = computed(() => {
  const { halfChord, rowHeight } = areaGeometry.value;
  return (
    `M${areaLeft.value - halfChord} ${rowHeight / 2}` +
    Array.from(
      { length: area.count.value / 2 },
      (_, i) =>
        `A${areaRadius} ${areaRadius} 0 0 0 ${areaLeft.value + (2 * i + 1) * halfChord} ${rowHeight / 2}`,
    ).join("")
  );
});
const stopAll = () => {
  montePlayback.stop();
  wheelPlayback.stop();
  area.stop();
};
const onVisibilityChange = () => {
  if (document.hidden) stopAll();
};
let motionPreference: MediaQueryList | undefined;
let chartObserver: ResizeObserver | undefined;
const updateMotion = () => {
  reducedMotion.value = motionPreference?.matches ?? false;
  if (reducedMotion.value) stopAll();
};
watch(() => route.path, stopAll);
onMounted(() => {
  chartObserver = new ResizeObserver(([entry]) => {
    if (entry) chartWidth.value = Math.max(200, entry.contentRect.width);
  });
  if (chart.value) chartObserver.observe(chart.value);
  motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  updateMotion();
  motionPreference.addEventListener("change", updateMotion);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", stopAll);
});
onUnmounted(() => {
  chartObserver?.disconnect();
  motionPreference?.removeEventListener("change", updateMotion);
  document.removeEventListener("visibilitychange", onVisibilityChange);
  window.removeEventListener("pagehide", stopAll);
});
</script>

<style scoped>
.pi-lab {
  --pi-inner: #2364c5;
  --pi-outer: #b94e08;
}
.v-theme--dark .pi-lab {
  --pi-inner: #8bbaff;
  --pi-outer: #ffb77c;
}
.pi-lab__controls,
.pi-lab__legend {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.pi-lab__experiment {
  padding: 28px;
  margin-bottom: 28px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.16);
  border-radius: 12px;
  background: rgb(var(--v-theme-surface));
  scroll-margin-top: 76px;
}
.pi-lab__header {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 24px;
}
.pi-lab__badge {
  display: grid;
  place-items: center;
  flex: 0 0 40px;
  height: 40px;
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
  border-radius: 8px;
  font-weight: 700;
}
.pi-lab__header h2 {
  margin: 0 0 6px;
  font-size: 1.25rem;
}
.pi-lab__header p {
  margin: 0;
  color: rgba(var(--v-theme-on-surface), 0.74);
  line-height: 1.7;
}
.pi-lab__grid {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1fr);
  align-items: start;
  gap: 36px;
}
.pi-lab__monte-grid {
  row-gap: 12px;
}
.pi-lab__monte-grid > .pi-lab__visual {
  grid-column: 1;
  grid-row: 1 / span 3;
}
.pi-lab__monte-grid > .pi-lab__panel,
.pi-lab__monte-grid > .pi-lab__controls,
.pi-lab__monte-grid > .pi-lab__speed,
.pi-lab__monte-grid > .pi-lab__note {
  grid-column: 2;
}
.pi-lab__visual {
  width: 100%;
  max-width: 360px;
  margin-inline: auto;
}
.pi-lab__square {
  position: relative;
  aspect-ratio: 1;
  background: #f7f9fc;
  border-radius: 8px;
  color: #64748b;
}
.pi-lab__square canvas,
.pi-lab__outline {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}
.pi-lab__outline {
  pointer-events: none;
}
.pi-lab__geometry {
  display: block;
  width: 100%;
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.025);
}
.pi-lab__legend {
  justify-content: center;
  margin-top: 12px;
  font-size: 0.875rem;
}
.pi-lab__inner {
  color: var(--pi-inner);
}
.pi-lab__outer {
  color: var(--pi-outer);
}
.pi-lab__panel {
  min-width: 0;
}
.pi-lab__result {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.875rem;
}
.pi-lab__big {
  font-size: clamp(2rem, 4.5vw, 3rem);
  font-weight: 600;
  line-height: 1.25;
  font-variant-numeric: tabular-nums;
}
.pi-lab__big.pi-lab__estimate {
  font-size: clamp(1.4rem, 3.3vw, 2.4rem);
}
.pi-lab__formula {
  font-variant-numeric: tabular-nums;
  color: rgba(var(--v-theme-on-surface), 0.66);
}
.pi-lab__metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 32px;
  margin-block: 20px;
}
.pi-lab__metrics dt {
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
}
.pi-lab__metrics dd {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.pi-lab__controls .v-btn,
.pi-lab__nav .v-btn {
  letter-spacing: 0;
}
.pi-lab__note {
  font-size: 0.8125rem;
  line-height: 1.7;
  color: rgba(var(--v-theme-on-surface), 0.68);
  margin-top: 12px;
}
.pi-lab__chart {
  grid-column: 1 / -1;
  margin: 0;
}
.pi-lab__chart figcaption {
  font-size: 0.8125rem;
  margin-bottom: 8px;
}
.pi-lab__chart svg {
  display: block;
  width: 100%;
  height: 130px;
}
.pi-lab__chart-label {
  fill: currentColor;
  font-size: 12px;
}
.pi-lab__axis {
  stroke: currentColor;
  opacity: 0.35;
  stroke-width: 1.5;
}
.pi-lab__pi-line {
  stroke: var(--pi-inner);
  stroke-width: 1.5;
  stroke-dasharray: 5 4;
}
.pi-lab__trace {
  stroke: var(--pi-outer);
  stroke-width: 2;
  stroke-linejoin: round;
}
.pi-lab__trace-point {
  fill: var(--pi-outer);
}
.pi-lab__details {
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  margin-top: 24px;
  font-size: 0.875rem;
}
.pi-lab__details summary {
  min-height: 44px;
  padding-block: 12px;
  cursor: pointer;
}
.pi-lab__details p {
  max-width: 760px;
  line-height: 1.9;
  padding-bottom: 12px;
}
.pi-lab__details summary:focus-visible,
.pi-lab select:focus-visible,
.pi-lab input:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 3px;
}
.pi-lab__circle {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
}
.pi-lab__inner-polygon {
  fill: none;
  stroke: var(--pi-inner);
  stroke-width: 2;
}
.pi-lab__outer-polygon {
  fill: rgba(var(--v-theme-on-surface), 0.03);
  stroke: var(--pi-outer);
  stroke-width: 2;
  stroke-dasharray: 6 4;
}
.pi-lab__diameter {
  stroke: currentColor;
  stroke-width: 1;
  opacity: 0.55;
  vector-effect: non-scaling-stroke;
}
.pi-lab__diameter-label {
  fill: currentColor;
  font-size: 24px;
}
.pi-lab__calculation {
  margin-top: 16px;
  font-size: 0.875rem;
  line-height: 1.5;
}
.pi-lab__calculation dl {
  display: grid;
  gap: 4px;
  margin-top: 6px;
}
.pi-lab__calculation dl > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.pi-lab__calculation dt {
  flex-shrink: 0;
}
.pi-lab__calculation dd {
  margin: 0;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.pi-lab__speed.pi-lab__sides {
  grid-template-columns: minmax(0, 1fr);
}
.pi-lab__sides .pi-lab__shape {
  justify-self: center;
}
.pi-lab__bounds {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: clamp(1.1rem, 2.5vw, 1.5rem);
  font-variant-numeric: tabular-nums;
  margin-block: 10px;
}
.pi-lab__polygon--precise .pi-lab__bounds {
  font-size: clamp(1rem, 2vw, 1.25rem);
  gap: 6px;
}
.pi-lab__interval {
  margin-top: 18px;
}
.pi-lab__interval-track {
  position: relative;
  height: 16px;
  border-radius: 4px;
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.pi-lab__interval-track span {
  position: absolute;
  height: 100%;
  background: var(--pi-inner);
  opacity: 0.45;
}
.pi-lab__interval-track i {
  position: absolute;
  width: 2px;
  top: -4px;
  height: 24px;
  background: currentColor;
}
.pi-lab__interval-labels {
  position: relative;
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  margin-top: 8px;
}
.pi-lab__interval-labels span:nth-child(2) {
  position: absolute;
  transform: translateX(-50%);
}
.pi-lab__wheel-stage {
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.025);
}
.pi-lab__wheel-svg {
  display: block;
  width: 100%;
  max-width: 640px;
  margin-inline: auto;
}
.pi-lab__ghost {
  fill: none;
  stroke: currentColor;
  opacity: 0.18;
  stroke-dasharray: 4 4;
}
.pi-lab__wheel-guide {
  stroke: var(--pi-inner);
  stroke-width: 1;
  stroke-dasharray: 3 3;
  opacity: 0.6;
}
.pi-lab__wheel-axis-mark {
  fill: var(--pi-inner);
}
.pi-lab__axis-title,
.pi-lab__axis-tick-label {
  fill: currentColor;
  font-size: 15px;
}
.pi-lab__axis-title {
  font-size: 14px;
}
.pi-lab__axis-tick-label.pi-lab__inner {
  fill: var(--pi-inner);
}
.pi-lab__distance {
  stroke: var(--pi-inner);
  stroke-width: 6;
  stroke-linecap: round;
}
.pi-lab__wheel-disc {
  fill: rgb(var(--v-theme-surface));
  stroke: rgba(var(--v-theme-on-surface), 0.45);
  stroke-width: 2;
}
.pi-lab__wheel-arc {
  fill: none;
  stroke: var(--pi-inner);
  stroke-width: 3;
}
.pi-lab__wheel-spoke {
  stroke: var(--pi-inner);
  stroke-width: 3;
}
.pi-lab__wheel-dimension {
  fill: none;
  stroke: rgba(var(--v-theme-on-surface), 0.65);
  stroke-width: 1.25;
}
.pi-lab__wheel-caption {
  fill: currentColor;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.pi-lab__wheel-mark {
  fill: var(--pi-outer);
  stroke: rgb(var(--v-theme-surface));
  stroke-width: 2;
}
.pi-lab__diameter {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
}
.pi-lab__svg-label {
  fill: currentColor;
  font-size: 17px;
}
.pi-lab__svg-label.pi-lab__inner {
  fill: var(--pi-inner);
}
.pi-lab__wheel-panel {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  gap: 32px;
  margin-top: 24px;
}
.pi-lab__wheel-calculation {
  display: grid;
  grid-template-columns: auto auto auto auto;
  align-items: end;
  justify-content: start;
  gap: 12px;
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
}
.pi-lab__wheel-calculation dt {
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), 0.68);
}
.pi-lab__wheel-calculation dl {
  margin: 0;
}
.pi-lab__wheel-calculation dd {
  margin: 2px 0 0;
  font-size: 1.25rem;
}
.pi-lab__wheel-answer {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-variant-numeric: tabular-nums;
}
.pi-lab__wheel-answer output {
  font-size: clamp(1.5rem, 3.4vw, 2.5rem);
  line-height: 1.4;
  letter-spacing: -0.02em;
}
.pi-lab__wheel-rotation {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 4px 12px;
  font-size: 0.875rem;
}
.pi-lab__wheel-size {
  margin-top: 0;
  margin-bottom: 8px;
}
.pi-lab__wheel-size output {
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.pi-lab__wheel-rotation label {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.pi-lab__wheel-rotation input {
  grid-column: 1 / -1;
  width: 100%;
  min-height: 44px;
  accent-color: var(--pi-inner);
  cursor: pointer;
}
.pi-lab__speed {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 4px 12px;
  margin-top: 12px;
  font-size: 0.8125rem;
}
.pi-lab__speed output {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.pi-lab__speed .pi-lab__shape {
  font-size: 1.125rem;
  font-weight: 500;
}
.pi-lab__speed input {
  grid-column: 1 / -1;
  width: 100%;
  min-height: 44px;
  accent-color: var(--pi-inner);
  cursor: pointer;
}
.pi-lab__area-stage {
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.025);
}
.pi-lab__area-stage svg {
  display: block;
  width: 100%;
  max-width: 600px;
  margin-inline: auto;
}
.pi-lab__area-piece {
  fill: var(--pi-inner);
  fill-opacity: 0.24;
  stroke: var(--pi-inner);
  stroke-width: 0.6;
  vector-effect: non-scaling-stroke;
}
.pi-lab__area-piece--top {
  fill: var(--pi-outer);
  stroke: var(--pi-outer);
}
.pi-lab__area-limit {
  fill: none;
  stroke: currentColor;
  stroke-width: 1;
  stroke-dasharray: 4 3;
  opacity: 0.5;
}
.pi-lab__area-radius {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
}
.pi-lab__area-half-arc {
  fill: none;
  stroke: var(--pi-inner);
  stroke-width: 2;
}
.pi-lab__area-label {
  fill: currentColor;
  font-size: 16px;
}
.pi-lab__area-label--arc {
  fill: var(--pi-inner);
}
.pi-lab__area-panel {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 32px;
  margin-top: 20px;
}
.pi-lab__area-formula-words {
  font-size: clamp(1.25rem, 3vw, 1.5rem);
  line-height: 1.5;
}
.pi-lab__area-formula {
  font-size: 1rem;
  line-height: 1.5;
}
.pi-lab__area-count {
  margin-top: 8px;
}
@media (max-width: 700px) {
  .pi-lab {
    padding-inline: 0;
  }
  .pi-lab__experiment {
    padding: 20px 16px;
  }
  .pi-lab__grid,
  .pi-lab__wheel-panel {
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;
  }
  .pi-lab__header {
    gap: 12px;
  }
  .pi-lab__header h2 {
    font-size: 1.125rem;
  }
  .pi-lab__visual {
    max-width: 300px;
  }
  .pi-lab__big {
    font-size: 2.5rem;
  }
  .pi-lab__monte,
  .pi-lab__polygon,
  .pi-lab__wheel,
  .pi-lab__area {
    padding: 12px;
    scroll-margin-top: 64px;
  }
  .pi-lab__monte .pi-lab__header,
  .pi-lab__polygon .pi-lab__header,
  .pi-lab__wheel .pi-lab__header,
  .pi-lab__area .pi-lab__header {
    gap: 10px;
    margin-bottom: 8px;
  }
  .pi-lab__monte .pi-lab__badge,
  .pi-lab__polygon .pi-lab__badge,
  .pi-lab__wheel .pi-lab__badge,
  .pi-lab__area .pi-lab__badge {
    flex-basis: 32px;
    height: 32px;
  }
  .pi-lab__monte .pi-lab__header p,
  .pi-lab__polygon .pi-lab__header p,
  .pi-lab__wheel .pi-lab__header p,
  .pi-lab__area .pi-lab__header p {
    font-size: 0.8125rem;
    line-height: 1.5;
  }
  .pi-lab__polygon .pi-lab__header,
  .pi-lab__wheel .pi-lab__header,
  .pi-lab__area .pi-lab__header {
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr);
    gap: 6px 10px;
  }
  .pi-lab__polygon .pi-lab__header > div,
  .pi-lab__wheel .pi-lab__header > div,
  .pi-lab__area .pi-lab__header > div {
    display: contents;
  }
  .pi-lab__polygon .pi-lab__header h2,
  .pi-lab__wheel .pi-lab__header h2,
  .pi-lab__area .pi-lab__header h2 {
    grid-column: 2;
    margin: 0;
    line-height: 1.4;
  }
  .pi-lab__polygon .pi-lab__header p,
  .pi-lab__wheel .pi-lab__header p,
  .pi-lab__area .pi-lab__header p {
    grid-column: 1 / -1;
  }
  .pi-lab__monte-grid {
    grid-template-columns: minmax(0, 0.43fr) minmax(0, 0.57fr);
    gap: 6px;
  }
  .pi-lab__monte .pi-lab__panel {
    display: contents;
  }
  .pi-lab__monte .pi-lab__visual {
    display: contents;
  }
  .pi-lab__monte .pi-lab__square {
    grid-column: 1;
    grid-row: 2;
    max-width: 180px;
  }
  .pi-lab__monte .pi-lab__result {
    display: grid;
    grid-column: 1 / -1;
    grid-row: 1;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 4px;
    font-size: 0.75rem;
  }
  .pi-lab__monte .pi-lab__estimate {
    grid-column: 1 / -1;
    grid-row: 2;
    font-size: clamp(1.2rem, 5vw, 1.5rem);
  }
  .pi-lab__monte .pi-lab__formula {
    grid-column: 2;
    grid-row: 1;
    text-align: right;
  }
  .pi-lab__monte .pi-lab__metrics {
    grid-column: 2;
    grid-row: 2;
    align-self: start;
    gap: 8px;
    margin: 0;
  }
  .pi-lab__monte .pi-lab__metrics > div {
    width: 100%;
  }
  .pi-lab__monte .pi-lab__metrics dt {
    font-size: 0.75rem;
  }
  .pi-lab__monte .pi-lab__metrics dd {
    font-size: 1rem;
    overflow-wrap: anywhere;
  }
  .pi-lab__monte .pi-lab__legend {
    grid-column: 1 / -1;
    grid-row: 3;
    gap: 4px 8px;
    margin: 0;
    font-size: 0.75rem;
    line-height: 1.5;
  }
  .pi-lab__monte .pi-lab__note {
    margin: 0;
    font-size: 0.75rem;
    line-height: 1.5;
  }
  .pi-lab__monte .pi-lab__visual > .pi-lab__note {
    grid-column: 1 / -1;
    grid-row: 4;
  }
  .pi-lab__monte .pi-lab__controls,
  .pi-lab__monte .pi-lab__speed,
  .pi-lab__monte-grid > .pi-lab__note {
    grid-column: 1 / -1;
  }
  .pi-lab__monte .pi-lab__controls {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }
  .pi-lab__monte .pi-lab__controls .v-btn {
    padding-inline: 8px;
    font-size: 0.875rem;
  }
  .pi-lab__monte .pi-lab__speed {
    margin: 0;
  }
  .pi-lab__monte .pi-lab__speed input {
    margin: 0;
  }
  .pi-lab__monte .pi-lab__chart figcaption {
    margin-bottom: 4px;
  }
  .pi-lab__polygon-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 4px;
  }
  .pi-lab__polygon .pi-lab__panel,
  .pi-lab__polygon .pi-lab__visual {
    display: contents;
  }
  .pi-lab__polygon .pi-lab__result {
    grid-column: 1 / -1;
    grid-row: 1;
    gap: 2px;
  }
  .pi-lab__polygon .pi-lab__bounds {
    margin: 0;
    gap: 6px;
    font-size: clamp(1.125rem, 4.8vw, 1.25rem);
    line-height: 1.4;
  }
  .pi-lab__polygon--precise .pi-lab__bounds {
    font-size: clamp(0.75rem, 3.7vw, 1rem);
    gap: 4px;
  }
  .pi-lab__polygon--precise .pi-lab__calculation-result {
    display: none;
  }
  .pi-lab__polygon .pi-lab__geometry {
    grid-column: 1 / -1;
    grid-row: 4;
    justify-self: center;
    width: clamp(180px, 50vw, 210px);
    aspect-ratio: 1;
  }
  .pi-lab__polygon .pi-lab__circle,
  .pi-lab__polygon .pi-lab__inner-polygon,
  .pi-lab__polygon .pi-lab__outer-polygon {
    vector-effect: non-scaling-stroke;
    stroke-width: 1.5;
  }
  .pi-lab__polygon .pi-lab__interval {
    grid-column: 1 / -1;
    grid-row: 3;
    margin: 0;
  }
  .pi-lab__polygon .pi-lab__interval-track {
    height: 12px;
  }
  .pi-lab__polygon .pi-lab__interval-track i {
    height: 20px;
  }
  .pi-lab__polygon .pi-lab__interval-labels {
    margin-top: 6px;
  }
  .pi-lab__polygon .pi-lab__calculation {
    grid-column: 1 / -1;
    grid-row: 2;
    margin: 0;
    font-size: clamp(0.75rem, 3.3vw, 0.875rem);
  }
  .pi-lab__polygon .pi-lab__calculation dl {
    margin-top: 4px;
  }
  .pi-lab__polygon .pi-lab__diameter-label {
    font-size: 32px;
  }
  .pi-lab__polygon .pi-lab__legend {
    grid-column: 1 / -1;
    grid-row: 5;
    margin: 0;
    font-size: 0.75rem;
    line-height: 1.5;
  }
  .pi-lab__polygon .pi-lab__sides {
    grid-column: 1 / -1;
    grid-row: 6;
    margin: 0;
  }
  .pi-lab__polygon .pi-lab__shape {
    line-height: 1.25;
  }
  .pi-lab__polygon .pi-lab__sides input {
    margin: 0;
  }
  .pi-lab__polygon .pi-lab__details {
    margin-top: 8px;
  }
  .pi-lab__polygon .pi-lab__details summary {
    box-sizing: border-box;
    padding-block: 10px;
  }
  .pi-lab__wheel-panel,
  .pi-lab__area-panel {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    margin-top: 12px;
  }
  .pi-lab__wheel .pi-lab__result {
    gap: 2px;
    font-size: 0.8125rem;
  }
  .pi-lab__wheel-answer output {
    font-size: clamp(1.375rem, 6vw, 1.625rem);
  }
  .pi-lab__wheel-rotation {
    gap: 0 8px;
    font-size: 0.8125rem;
  }
  .pi-lab__wheel-rotation .v-btn {
    padding-inline: 12px;
    font-size: 0.8125rem;
  }
}
</style>
