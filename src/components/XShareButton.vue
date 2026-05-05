<template>
  <v-btn color="black" variant="flat" @click="updateAndOpenShareUrl">
    <template #prepend>
      <img
        alt="X icon"
        class="icon"
        height="16"
        src="@/assets/images/x.svg"
        width="16"
      />
    </template>
    SHARE
  </v-btn>
</template>

<script setup lang="ts">
const route = useRoute();

const updateAndOpenShareUrl = (): void => {
  const text = "#McreTools\n";
  const shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(
    window.location.origin + route.fullPath,
  )}&text=${encodeURIComponent(text)}`;
  window.open(shareUrl, "_blank");
};
</script>
