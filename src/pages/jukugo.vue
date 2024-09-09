<template>
  <HelloWorld />
</template>

<script lang="ts" setup>
import { useUtil } from "@/composables/util";

const util = useUtil();
util.setTitle(
  "熟語パズル",
  "jukugo",
  "上下左右4つの漢字から真ん中の漢字を当てるパズル、いわゆる「和同開珎」を自動で解くツールです。"
);
</script>
