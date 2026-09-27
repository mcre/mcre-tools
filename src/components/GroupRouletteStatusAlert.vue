<template>
  <div class="group-roulette-status">
    <v-alert
      v-if="errorMessage"
      density="comfortable"
      type="error"
      variant="tonal"
    >
      {{ errorMessage }}
    </v-alert>

    <v-alert
      v-else-if="status === 'expired'"
      density="comfortable"
      type="error"
      variant="tonal"
    >
      {{ $t(`tools.${tool}.expiredStageGuidance`) }}
    </v-alert>

    <v-alert v-else density="comfortable" type="info" variant="tonal">
      <div class="status-line">
        <span>{{ $t(statusLabel) }}</span>

        <span v-if="member">
          {{ member.displayName }} / {{ $t(roleLabel) }}
        </span>
      </div>
    </v-alert>
  </div>
</template>

<script lang="ts" setup>
import type { GroupRouletteMember } from "@/apis/@types";
import type { GroupRouletteStatus } from "@/composables/useGroupRoulette";

const tool = GROUP_ROULETTE_TOOL;

const props = defineProps<{
  errorMessage: string | null;
  member: GroupRouletteMember | null;
  status: GroupRouletteStatus;
}>();

const statusLabel = computed(() => `tools.${tool}.${props.status}`);
const roleLabel = computed(() =>
  props.member?.role === "host"
    ? `tools.${tool}.memberRoleHost`
    : `tools.${tool}.memberRoleGuest`,
);
</script>

<style scoped>
.group-roulette-status {
  display: grid;
}

.status-line {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  justify-content: space-between;
}
</style>
