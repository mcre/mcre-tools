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
import { useUtil } from "@/composables/util";

const util = useUtil();
util.setTitle("このページは存在しません");
</script>
