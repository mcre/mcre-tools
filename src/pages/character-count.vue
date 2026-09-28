<template>
  <tool-heading class="compact-heading" :tool="tool" />

  <v-container class="counter">
    <div class="counter__results">
      <div class="counter__metric counter__metric--main">
        <span class="counter__label">{{ $t(`${messages}.total`) }}</span>

        <strong class="counter__number" data-testid="total-count">{{
          counts.total.toLocaleString()
        }}</strong>
      </div>

      <div class="counter__metric">
        <span class="counter__label">{{
          $t(`${messages}.withoutWhitespace`)
        }}</span>

        <strong class="counter__number" data-testid="compact-count">{{
          counts.withoutWhitespace.toLocaleString()
        }}</strong>
      </div>

      <div v-if="selection" class="counter__selection" role="status">
        {{ $t(`${messages}.selection`) }}
        <strong data-testid="selection-count">{{
          selectionCount.toLocaleString()
        }}</strong>
      </div>
    </div>

    <div class="counter__editor">
      <label class="sr-only" for="count-text">{{
        $t(`${messages}.input`)
      }}</label>

      <textarea
        id="count-text"
        ref="editor"
        v-model="text"
        class="counter__textarea"
        :placeholder="$t(`${messages}.placeholder`)"
        spellcheck="false"
        @input="updateSelection"
        @keyup="updateSelection"
        @pointerup="updateSelection"
        @select="updateSelection"
      />

      <div class="counter__toolbar">
        <div class="counter__clipboard">
          <v-btn
            :aria-label="$t(`${messages}.copy`)"
            :disabled="!text || clipboardBusy"
            :icon="clipboardStatus === 'copied' ? mdiCheck : mdiContentCopy"
            size="40"
            :title="
              $t(
                `${messages}.${clipboardStatus === 'copied' ? 'copied' : 'copy'}`,
              )
            "
            variant="text"
            @click="copy"
          />

          <v-btn
            :aria-label="$t(`${messages}.paste`)"
            :disabled="clipboardBusy"
            :icon="mdiContentPaste"
            size="40"
            :title="$t(`${messages}.paste`)"
            variant="text"
            @click="paste"
          />
        </div>

        <v-btn
          v-if="canRestore"
          :prepend-icon="mdiUndo"
          variant="text"
          @click="restoreText"
          >{{ $t(`${messages}.undo`) }}</v-btn
        >

        <v-btn
          v-else
          :disabled="!text"
          :prepend-icon="mdiClose"
          variant="text"
          @click="clear"
          >{{ $t(`${messages}.clear`) }}</v-btn
        >
      </div>

      <p
        :class="clipboardFailed ? 'counter__feedback' : 'sr-only'"
        role="status"
      >
        {{ clipboardMessage ? $t(`${messages}.${clipboardMessage}`) : "" }}
      </p>
    </div>

    <p class="counter__note" data-testid="counting-note">
      {{ $t(`${messages}.countingNote`) }}
    </p>

    <details
      class="counter__details"
      data-testid="text-details"
      @toggle="updateDetails"
    >
      <summary>
        <span>{{ $t(`${messages}.moreCounts`) }}</span>
        <v-icon aria-hidden="true" :icon="mdiChevronDown" size="20" />
      </summary>

      <dl v-if="detailCounts" class="counter__detail-grid">
        <div v-for="metric in detailMetrics" :key="metric.key">
          <dt>{{ $t(`${messages}.detailLabels.${metric.key}`) }}</dt>

          <dd>
            <strong :data-testid="metric.testId">{{
              detailCounts[metric.key].toLocaleString()
            }}</strong>

            <span class="counter__detail-note">{{
              $t(`${messages}.detailNotes.${metric.key}`)
            }}</span>
          </dd>
        </div>
      </dl>
    </details>

    <tool-guide :tool="tool" :topics="['counting', 'details', 'draft']" />
  </v-container>
</template>

<script lang="ts" setup>
import {
  mdiCheck,
  mdiChevronDown,
  mdiClose,
  mdiContentCopy,
  mdiContentPaste,
  mdiUndo,
} from "@mdi/js";
import { useHead } from "@unhead/vue";

const tool = "character-count";
const messages = `tools.${tool}`;
useHead(useHeaderUtil().getHead(tool));
const { text, canRestore, clear, restore } = useTextDraft();
const editor = ref<HTMLTextAreaElement | null>(null);
const {
  status: clipboardStatus,
  busy: clipboardBusy,
  copy,
  paste,
} = useTextClipboard(text, editor);
const clipboardFailed = computed(() =>
  ["copyFailed", "pasteFailed"].includes(clipboardStatus.value),
);
const clipboardMessage = computed(() =>
  ["copied", "pasted", "copyFailed", "pasteFailed"].includes(
    clipboardStatus.value,
  )
    ? clipboardStatus.value
    : "",
);
const selection = ref("");
const counts = computed(() => countCharacters(text.value));
const selectionCount = computed(() => countCharacters(selection.value).total);
const detailsOpen = ref(false);
const detailCounts = computed(() =>
  detailsOpen.value ? countTextDetails(text.value) : null,
);
const detailMetrics = [
  { key: "lines", testId: "line-count" },
  { key: "paragraphs", testId: "paragraph-count" },
  { key: "words", testId: "word-count" },
  { key: "utf8Bytes", testId: "utf8-count" },
] as const;
const updateDetails = (event: Event) => {
  detailsOpen.value = (event.currentTarget as HTMLDetailsElement).open;
};
watch(
  text,
  () => {
    selection.value = "";
  },
  { flush: "sync" },
);
const updateSelection = () => {
  const input = editor.value;
  selection.value = input
    ? input.value.slice(input.selectionStart, input.selectionEnd)
    : "";
};
const restoreText = async () => {
  restore();
  await nextTick();
  editor.value?.focus();
};
</script>

<style scoped>
.compact-heading :deep(h1),
.compact-heading :deep(p) {
  margin: 0;
}
.compact-heading :deep(.v-row) {
  gap: 16px;
}
.compact-heading :deep(.v-row + .v-row) {
  margin-top: 12px;
}
.counter__results {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 20px 48px;
  position: sticky;
  top: 56px;
  z-index: 2;
  padding: 8px 0 24px;
  background: rgb(var(--v-theme-background));
}
.counter__metric {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.counter__label,
.counter__note {
  color: rgba(var(--v-theme-on-surface), 0.68);
  font-size: 0.875rem;
}
.counter__number {
  font-size: clamp(32px, 5vw, 48px);
  line-height: 1.2;
  font-weight: 600;
  letter-spacing: -0.035em;
  font-variant-numeric: tabular-nums;
}
.counter__metric--main .counter__number {
  color: rgb(var(--v-theme-primary));
}
.counter__selection {
  margin-left: auto;
  padding: 8px 14px;
  border-radius: 8px;
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
  font-size: 0.875rem;
}
.counter__selection strong {
  margin-left: 8px;
  font-variant-numeric: tabular-nums;
}
.counter__editor {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.2);
  border-radius: 12px;
  background: rgb(var(--v-theme-surface));
}
.counter__editor:focus-within {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 0 1px rgb(var(--v-theme-primary));
}
.counter__textarea {
  display: block;
  width: 100%;
  height: clamp(240px, 42dvh, 420px);
  min-height: 180px;
  padding: 24px;
  resize: vertical;
  outline: none;
  border: 0;
  border-radius: 12px 12px 0 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 1.125rem;
  line-height: 1.9;
}
.counter__textarea::placeholder {
  color: rgba(var(--v-theme-on-surface), 0.45);
}
.counter__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px 8px 24px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.counter__clipboard {
  display: flex;
  gap: 4px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.counter__clipboard :deep(.v-icon) {
  font-size: 20px;
}
.counter__feedback {
  padding: 0 24px 12px;
  color: rgba(var(--v-theme-on-surface), 0.68);
  font-size: 0.8125rem;
  line-height: 1.6;
}
.counter__note {
  margin-top: 16px;
}
.counter__details {
  margin-top: 20px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.16);
  border-radius: 12px;
  background: rgb(var(--v-theme-surface));
}
.counter__details summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 52px;
  padding: 12px 20px;
  border-radius: 12px;
  list-style: none;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
}
.counter__details summary::-webkit-details-marker {
  display: none;
}
.counter__details summary:hover {
  background: rgba(var(--v-theme-on-surface), 0.04);
}
.counter__details summary:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 3px;
}
.counter__details[open] summary .v-icon {
  transform: rotate(180deg);
}
.counter__detail-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 24px;
  margin: 0;
  padding: 20px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.counter__detail-grid dt {
  margin-bottom: 4px;
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), 0.68);
}
.counter__detail-grid dd {
  margin: 0;
}
.counter__detail-grid strong {
  font-size: 1.5rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.counter__detail-note {
  display: block;
  margin-top: 8px;
  font-size: 0.75rem;
  line-height: 1.6;
  color: rgba(var(--v-theme-on-surface), 0.68);
  overflow-wrap: anywhere;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
@media (max-width: 600px) {
  .compact-heading :deep(h1) {
    font-size: 28px;
  }
  .counter__results {
    gap: 8px 24px;
    padding-bottom: 16px;
  }
  .counter__selection {
    margin-left: 0;
    padding: 4px 10px;
  }
  .counter__textarea {
    padding: 16px;
    height: clamp(180px, 38dvh, 320px);
    font-size: 1rem;
  }
  .counter__toolbar {
    padding-left: 16px;
  }
  .counter__detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 24px 16px;
  }
}
</style>
