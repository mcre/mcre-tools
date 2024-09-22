<template>
  <v-btn
    :icon="model ? `mdi-arrow-${forward}-thick` : `mdi-arrow-${reverse}-thick`"
    variant="text"
    tabindex="-1"
    size="small"
    @click="model = !model"
  />
</template>

<script lang="ts" setup>
type Direction = "up" | "down" | "left" | "right";
const model = defineModel<boolean>();

defineProps<{
  forward: Direction;
  reverse: Direction;
}>();
</script>
