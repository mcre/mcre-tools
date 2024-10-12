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

const util = useUtil();

const props = defineProps({
  typing: {
    type: Boolean,
    required: true,
  },
});

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
  nextTick();
  if (isKanjiValid.value) emits("input");
};

const handleCompositionStart = () => {
  emits("update:typing", true);
};

const handleCompositionEnd = (event: Event) => {
  emits("update:typing", false);
  processInput(event);
};

const handleInput = (event: Event) => {
  if (!props.typing) {
    processInput(event);
  }
};
</script>
