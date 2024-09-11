<template>
  <v-btn
    :icon="
      model
        ? `mdi-arrow-${props.forward}-thick`
        : `mdi-arrow-${props.reverse}-thick`
    "
    variant="text"
    tabindex="-1"
    size="small"
    @click="model = !model"
  />
</template>

<script lang="ts" setup>
type Direction = "up" | "down" | "left" | "right";
const model = defineModel<boolean>();

const props = defineProps<{
  forward: Direction;
  reverse: Direction;
}>();
</script>
