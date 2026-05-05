<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <h1>{{ $t("notFound.title") }}</h1>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <v-btn :to="i18nUtil.path('/')">
          {{ $t("notFound.returnToHome") }}
        </v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts" setup>
import { useHead } from "@unhead/vue";
import { useI18n } from "vue-i18n";
const { t } = useI18n();
const i18nUtil = useI18nUtil();
const headerUtil = useHeaderUtil();

useHead(headerUtil.getHead());
useHead({
  title: computed(() => `${t("notFound.title")} - ${t("common.title")}`),
  meta: [
    {
      name: "robots",
      content: "noindex, nofollow, noarchive",
    },
  ],
} as any);
</script>
