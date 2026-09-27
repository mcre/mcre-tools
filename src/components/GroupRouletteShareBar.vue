<template>
  <v-sheet
    aria-labelledby="group-roulette-share"
    border
    class="group-roulette-share pa-4"
    rounded="lg"
    tag="section"
  >
    <div class="share-header">
      <div>
        <h2 id="group-roulette-share">
          {{ $t(`tools.${tool}.roomSection`) }}
        </h2>

        <p>{{ $t(`tools.${tool}.shareHelp`) }}</p>
      </div>

      <v-chip density="comfortable" size="small" variant="tonal">
        {{ $t(memberLabel) }}
      </v-chip>
    </div>

    <div class="share-actions">
      <v-btn
        color="primary"
        :prepend-icon="mdiContentCopy"
        variant="tonal"
        @click="copyShareUrl"
      >
        {{ $t(`tools.${tool}.copyShareUrl`) }}
      </v-btn>

      <v-btn
        :append-icon="showUrl ? mdiChevronUp : mdiChevronDown"
        variant="text"
        @click="showUrl = !showUrl"
      >
        {{ $t(`tools.${tool}.${showUrl ? "hideShareUrl" : "showShareUrl"}`) }}
      </v-btn>
    </div>

    <p v-if="showUrl" class="share-url">{{ shareUrl }}</p>

    <v-snackbar v-model="copied" timeout="1600">
      {{ $t(`tools.${tool}.copySuccess`) }}
    </v-snackbar>
  </v-sheet>
</template>

<script lang="ts" setup>
import type { GroupRouletteMember } from "@/apis/@types";
import { mdiChevronDown, mdiChevronUp, mdiContentCopy } from "@mdi/js";

const tool = GROUP_ROULETTE_TOOL;

const props = defineProps<{
  member: GroupRouletteMember | null;
  shareUrl: string;
}>();

const showUrl = ref(false);
const copied = ref(false);

const memberLabel = computed(() => {
  if (!props.member) return `tools.${tool}.notJoined`;
  return props.member.role === "host"
    ? `tools.${tool}.memberRoleHost`
    : `tools.${tool}.memberRoleGuest`;
});

const copyShareUrl = async () => {
  try {
    if (!import.meta.env.SSR && navigator.clipboard) {
      await navigator.clipboard.writeText(props.shareUrl);
    }
  } finally {
    copied.value = true;
  }
};
</script>

<style scoped>
.group-roulette-share {
  display: grid;
  gap: 12px;
}

.share-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
}

.share-header h2 {
  margin: 0;
  font-size: 1rem;
}

.share-header p {
  margin: 2px 0 0;
  color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 68%, transparent);
  font-size: 0.875rem;
}

.share-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.share-url {
  padding: 10px 12px;
  border: 1px solid rgb(var(--v-theme-outline-variant));
  border-radius: 8px;
  margin: 0;
  background: color-mix(
    in srgb,
    rgb(var(--v-theme-on-surface)) 6%,
    transparent
  );
  color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 76%, transparent);
  font-size: 0.85rem;
  overflow-wrap: anywhere;
}

@media (max-width: 600px) {
  .share-actions {
    display: grid;
  }
}
</style>
