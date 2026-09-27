<template>
  <v-sheet
    aria-labelledby="group-roulette-options"
    border
    class="group-roulette-options"
    rounded="lg"
    tag="section"
  >
    <details open>
      <summary>
        <span id="group-roulette-options">
          {{
            $t(`tools.${tool}.optionListTitle`, {
              count: options.length,
            })
          }}
        </span>

        <v-icon :icon="mdiChevronDown" size="small" />
      </summary>

      <v-list class="option-list" density="compact" lines="two">
        <v-list-item
          v-for="option in options"
          :key="option.id"
          class="option-list__item"
        >
          <template #prepend>
            <span class="option-order">{{ option.order }}</span>
          </template>

          <v-list-item-title class="option-list__title" :title="option.label">
            {{ option.label }}
          </v-list-item-title>

          <template v-if="isHost" #append>
            <v-btn
              :aria-label="$t(`tools.${tool}.removeOption`)"
              :disabled="!canEditOptions"
              :icon="mdiDeleteOutline"
              size="small"
              variant="text"
              @click="$emit('remove', option.id)"
            />
          </template>
        </v-list-item>

        <v-list-item
          v-if="options.length === 0"
          class="option-list__empty"
          :title="$t(`tools.${tool}.noOptions`)"
        />
      </v-list>
    </details>
  </v-sheet>
</template>

<script lang="ts" setup>
import type { GroupRouletteOption } from "@/apis/@types";
import { mdiChevronDown, mdiDeleteOutline } from "@mdi/js";

const tool = GROUP_ROULETTE_TOOL;

defineProps<{
  canEditOptions: boolean;
  isHost: boolean;
  options: readonly GroupRouletteOption[];
}>();

defineEmits<{
  remove: [optionId: string];
}>();
</script>

<style scoped>
.group-roulette-options {
  display: grid;
}

details {
  overflow: hidden;
}

summary {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  cursor: pointer;
  font-weight: 700;
  list-style: none;
}

summary::-webkit-details-marker {
  display: none;
}

details[open] summary .v-icon {
  transform: rotate(180deg);
}

.option-list {
  max-height: min(44vh, 420px);
  overflow-y: auto;
  border-top: 1px solid rgb(var(--v-theme-outline-variant));
}

.option-list__item {
  align-items: flex-start;
  min-height: 46px;
  padding-block: 6px;
}

.option-list__item :deep(.v-list-item__prepend) {
  align-self: flex-start;
  padding-top: 2px;
  margin-inline-end: 12px;
}

.option-list__item :deep(.v-list-item__append) {
  align-self: flex-start;
  padding-top: 0;
  margin-inline-start: 8px;
}

.option-list__title {
  display: -webkit-box;
  overflow: hidden;
  line-height: 1.35;
  overflow-wrap: anywhere;
  white-space: normal;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.option-list__empty {
  color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 68%, transparent);
}

.option-order {
  display: inline-grid;
  min-width: 36px;
  min-height: 28px;
  place-items: center;
  padding: 0 8px;
  border-radius: 999px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-size: 0.82rem;
  font-weight: 700;
}
</style>
