<template>
  <v-btn
    class="share-button"
    color="black"
    variant="flat"
    @click="updateAndOpenShareUrl"
  >
    <template #prepend>
      <img
        alt=""
        aria-hidden="true"
        class="share-button__icon share-button__icon--x"
        height="20"
        src="@/assets/images/x.svg"
        width="20"
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

<style scoped>
.share-button {
  color: #ffffff;
  font-weight: 700;
}

.share-button :deep(.v-btn__prepend) {
  margin-inline-end: 10px;
}

.share-button__icon {
  display: block;
  flex: 0 0 auto;
  object-fit: contain;
}

.share-button__icon--x {
  height: 20px;
  width: 20px;
}
</style>
