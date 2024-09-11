<template>
  <v-text-field
    v-model="model"
    maxlength="1"
    variant="outlined"
    hide-details
    :error="!isKanjiValid"
    @compositionstart="isComposing = true"
    @compositionend="handleCompositionEnd"
    @input="handleInput"
  />
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { useUtil } from "@/composables/util";
const util = useUtil();

const model = defineModel<string>();
const isComposing = ref(false);
const isKanjiValid = ref(true);

const validateKanji = () => {
  if (!model.value || model.value === "") {
    isKanjiValid.value = true;
  } else {
    isKanjiValid.value = util.isKanji(model.value);
  }
};

const handleCompositionEnd = () => {
  isComposing.value = false;
  validateKanji();
};

const handleInput = () => {
  if (!isComposing.value) {
    validateKanji();
  }
};
</script>
