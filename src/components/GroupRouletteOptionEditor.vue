<template>
  <v-sheet
    aria-labelledby="group-roulette-option-editor"
    border
    class="group-roulette-option-editor pa-4"
    rounded="lg"
    tag="section"
  >
    <div class="option-editor-header">
      <h2 id="group-roulette-option-editor">
        {{ $t(`tools.${tool}.optionEditorTitle`) }}
      </h2>

      <p>{{ $t(helperText) }}</p>
    </div>

    <form class="option-editor-form" @submit.prevent="submit">
      <v-text-field
        v-model="label"
        density="comfortable"
        :disabled="!canAddOption || addingOption"
        hide-details="auto"
        :label="$t(`tools.${tool}.optionLabel`)"
        maxlength="80"
        variant="outlined"
      />

      <v-btn
        class="option-editor-form__submit"
        :color="addingOption || label.trim() ? 'primary' : undefined"
        :disabled="!addingOption && (!label.trim() || !canAddOption)"
        :loading="addingOption"
        :prepend-icon="mdiPlus"
        type="submit"
      >
        {{ $t(`tools.${tool}.addOption`) }}
      </v-btn>
    </form>
  </v-sheet>
</template>

<script lang="ts" setup>
import type { GroupRouletteMember } from "@/apis/@types";
import type { GroupRouletteStatus } from "@/composables/useGroupRoulette";
import { mdiPlus } from "@mdi/js";

const tool = GROUP_ROULETTE_TOOL;

const props = defineProps<{
  addingOption: boolean;
  canAddOption: boolean;
  guestAddEnabled: boolean;
  member: GroupRouletteMember | null;
  status: GroupRouletteStatus;
}>();

const emit = defineEmits<{
  add: [label: string];
}>();

const label = ref("");
const shouldClearAfterAdding = ref(false);

const helperText = computed(() => {
  if (!props.member) return `tools.${tool}.joinBeforeAdding`;
  if (props.status === "spinning" || props.status === "stopping") {
    return `tools.${tool}.editingLocked`;
  }
  if (!props.guestAddEnabled && props.member.role !== "host") {
    return `tools.${tool}.guestAddDisabledHelp`;
  }
  return `tools.${tool}.optionEditorHelp`;
});

const submit = () => {
  const value = label.value.trim();
  if (props.addingOption || !value || !props.canAddOption) return;
  emit("add", value);
  shouldClearAfterAdding.value = true;
};

watch(
  () => props.addingOption,
  (addingOption, wasAddingOption) => {
    if (!addingOption && wasAddingOption && shouldClearAfterAdding.value) {
      label.value = "";
      shouldClearAfterAdding.value = false;
    }
  },
);
</script>

<style scoped>
.group-roulette-option-editor {
  display: grid;
  gap: 12px;
}

.option-editor-header h2 {
  margin: 0;
  font-size: 1rem;
}

.option-editor-header p {
  margin: 2px 0 0;
  color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 68%, transparent);
  font-size: 0.875rem;
}

.option-editor-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: start;
}

.option-editor-form__submit {
  min-height: 48px;
  min-width: 124px;
}

@media (max-width: 600px) {
  .option-editor-form {
    grid-template-columns: 1fr;
  }
}
</style>
