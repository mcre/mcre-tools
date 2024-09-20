<template>
  <v-btn color="black" variant="flat" :href="shareUrl" target="_blank">
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

<script setup>
const route = useRoute();
const shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(
  window.location.origin + route.fullPath
)}`;
</script>
