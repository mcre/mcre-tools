<template>
  <v-btn
    :icon="model ? forwardIcon : reverseIcon"
    size="small"
    tabindex="-1"
    variant="text"
    @click="model = !model"
  />
</template>

<script lang="ts" setup>
import {
  mdiArrowDownThick,
  mdiArrowLeftThick,
  mdiArrowRightThick,
  mdiArrowUpThick,
} from "@mdi/js";
import { computed } from "vue";

type Direction = "up" | "down" | "left" | "right";

const props = defineProps<{
  forward: Direction;
  reverse: Direction;
}>();

const model = defineModel<boolean>();

const iconMap: Record<Direction, string> = {
  up: mdiArrowUpThick,
  down: mdiArrowDownThick,
  left: mdiArrowLeftThick,
  right: mdiArrowRightThick,
};

const forwardIcon = computed(() => iconMap[props.forward]);
const reverseIcon = computed(() => iconMap[props.reverse]);
</script>
