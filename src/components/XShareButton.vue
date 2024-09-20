<template>
  <v-btn color="black" variant="flat" @click="updateAndOpenShareUrl">
    <template v-slot:prepend>
      <img
        src="@/assets/x.svg"
        alt="X icon"
        class="icon"
        width="16"
        height="16"
      />
    </template>
    SHARE
  </v-btn>
</template>

<script setup lang="ts">
import { useRoute } from "vue-router";

const route = useRoute();

const updateAndOpenShareUrl = (): void => {
  const shareUrl: string = `https://twitter.com/intent/tweet?url=${encodeURIComponent(
    window.location.origin + route.fullPath
  )}`;
  window.open(shareUrl, "_blank");
};
</script>
