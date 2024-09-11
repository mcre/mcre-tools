<template>
  <v-text-field
    v-model="model"
    :placeholder="props.placeholder"
    maxlength="1"
    variant="outlined"
    hide-details
  />
</template>

<script lang="ts" setup>
const model = defineModel<string>();
const props = defineProps({
  placeholder: String,
});
</script>
