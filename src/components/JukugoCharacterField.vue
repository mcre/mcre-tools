<template>
  <v-text-field
    v-model="model"
    class="centered-input"
    variant="outlined"
    hide-details
    :error="!isKanjiValid"
    @compositionstart="handleCompositionStart"
    @compositionend="handleCompositionEnd"
    @input="handleInput"
    min-width="48px"
  />
</template>

<script lang="ts" setup>
const model = defineModel<string>();
const emits = defineEmits(["input", "update:typing"]);

const jukugoUtil = useJukugoUtil();

const isKanjiValid = ref(true);
const typing = ref(false);

const validateKanji = (value: string) => {
  if (!value || value === "") {
    isKanjiValid.value = true;
  } else {
    isKanjiValid.value = jukugoUtil.isKanji(value);
  }
};

const slice = (str: string) => {
  if (str.length > 1) {
    return str.slice(0, 1);
  }
  return str;
};

const processInput = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const sliced = slice(input.value);
  model.value = sliced;
  validateKanji(sliced);
  await nextTick();
  emits("input");
};

const handleCompositionStart = () => {
  typing.value = true;
  emits("update:typing", true);
};

const handleCompositionEnd = (event: Event) => {
  typing.value = false;
  emits("update:typing", false);
  processInput(event);
};

const handleInput = async (event: Event) => {
  await nextTick();
  if (!typing.value) {
    processInput(event);
  }
};
</script>
