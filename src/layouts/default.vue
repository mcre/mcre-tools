<template>
  <v-app-bar density="comfortable" flat>
    <template #prepend>
      <v-app-bar-nav-icon
        :aria-label="$t('common.toggleMenu')"
        variant="text"
        @click.stop="drawer = !drawer"
      />
    </template>

    <v-app-bar-title>
      <v-btn
        :active="false"
        :aria-label="$t('common.moveToHome')"
        :to="i18nUtil.path('/')"
        variant="text"
      >
        MCRE TOOLS
      </v-btn>
    </v-app-bar-title>

    <template #append>
      <language-switcher />
      <x-share-button class="mr-1" />
    </template>
  </v-app-bar>

  <v-navigation-drawer v-for="tool in tools" :key="tool" v-model="drawer">
    <v-list lines="two" :role="null">
      <v-list-item
        :subtitle="$t(`tools.${tool}.descriptionShort`)"
        :title="$t(`tools.${tool}.title`)"
        :to="i18nUtil.path(tool)"
      >
        <template #prepend>
          <v-avatar size="32">
            <img alt="" height="32" :src="`/img/${tool}/32.png`" width="32" />
          </v-avatar>
        </template>
      </v-list-item>
    </v-list>
  </v-navigation-drawer>

  <v-main style="--v-layout-top: 56px">
    <v-container max-width="1140">
      <router-view />
    </v-container>
  </v-main>
</template>

<script lang="ts" setup>
import { useTheme } from "vuetify";
const drawer = ref(false);
const i18nUtil = useI18nUtil();

onMounted(() => {
  if (!import.meta.env.SSR) {
    const theme = useTheme();
    const currentTheme = window.matchMedia("(prefers-color-scheme: dark)")
      .matches
      ? "dark"
      : "light";
    theme.change(currentTheme);
  }
});
</script>
