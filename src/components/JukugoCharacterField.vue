<template>
  <v-text-field
    v-model="model"
    class="centered-input"
    variant="outlined"
    hide-details
    :error="!isKanjiValid"
    @compositionstart="isComposing = true"
    @compositionend="handleCompositionEnd"
    @input="handleInput"
    min-width="48px"
  />
</template>

<script lang="ts" setup>
const util = useUtil();

const model = defineModel<string>();
const isComposing = ref(false);
const isKanjiValid = ref(true);

const validateKanji = (value: string) => {
  if (!value || value === "") {
    isKanjiValid.value = true;
  } else {
    isKanjiValid.value = util.isKanji(value);
  }
};

const slice = (str: string) => {
  if (str.length > 1) {
    return str.slice(0, 1);
  }
  return str;
};

const processInput = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const sliced = slice(input.value);
  model.value = sliced;
  input.value = sliced;
  validateKanji(sliced);
};

const handleCompositionEnd = (event: Event) => {
  isComposing.value = false;
  processInput(event);
};

const handleInput = (event: Event) => {
  if (!isComposing.value) {
    processInput(event);
  }
};
</script>
