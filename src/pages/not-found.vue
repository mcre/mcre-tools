<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <h1>このページは存在しません</h1>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12">
        <v-btn to="/">トップページに戻る</v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts" setup>
import { useHead } from '@unhead/vue'
const util = useUtil();
util.setToolTitle();

const site = import.meta.env.VITE_APP_TITLE;
useHead({
  title: `このページは存在しません - ${site}`,
  meta: [
    {
      id: "robots",
      content: "noindex, nofollow, noarchive",
    }
  ]
})

</script>
