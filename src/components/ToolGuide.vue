<template>
  <details class="tool-guide" data-testid="tool-guide">
    <summary>
      <span>{{ $t(`tools.${tool}.guide.title`) }}</span>
      <v-icon aria-hidden="true" :icon="mdiChevronDown" size="20" />
    </summary>

    <div class="tool-guide__body">
      <p>{{ $t(`tools.${tool}.guide.intro`) }}</p>

      <section v-for="topic in topics" :key="topic">
        <h2>{{ $t(`tools.${tool}.guide.${topic}.question`) }}</h2>
        <p>{{ $t(`tools.${tool}.guide.${topic}.answer`) }}</p>
      </section>

      <slot />
    </div>
  </details>
</template>

<script lang="ts" setup>
import { mdiChevronDown } from "@mdi/js";

defineProps<{ tool: string; topics: readonly string[] }>();
</script>

<style scoped>
.tool-guide {
  margin-top: 24px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  color: rgba(var(--v-theme-on-surface), 0.68);
  font-size: 0.875rem;
}
.tool-guide summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 48px;
  padding: 12px 4px;
  list-style: none;
  cursor: pointer;
}
.tool-guide summary::-webkit-details-marker {
  display: none;
}
.tool-guide summary:hover {
  color: rgb(var(--v-theme-on-surface));
}
.tool-guide summary:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
  border-radius: 4px;
}
.tool-guide[open] summary .v-icon {
  transform: rotate(180deg);
}
.tool-guide__body {
  max-width: 800px;
  padding: 8px 4px 16px;
  line-height: 1.9;
  overflow-wrap: anywhere;
}
.tool-guide section {
  margin-top: 20px;
}
.tool-guide h2 {
  margin-bottom: 4px;
  color: rgb(var(--v-theme-on-surface));
  font-size: 0.9375rem;
  font-weight: 600;
}
</style>
