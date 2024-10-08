<template>
  <v-btn
    :icon="model ? forwardIcon : reverseIcon"
    variant="text"
    tabindex="-1"
    size="small"
    @click="model = !model"
  />
</template>

<script lang="ts" setup>
import {
  mdiArrowUpThick,
  mdiArrowDownThick,
  mdiArrowLeftThick,
  mdiArrowRightThick,
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
