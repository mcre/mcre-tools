<template>
  <v-app-bar flat density="comfortable">
    <template v-slot:prepend>
      <v-app-bar-nav-icon
        variant="text"
        @click.stop="drawer = !drawer"
        :aria-label="$t('common.toggleMenu')"
      />
    </template>
    <v-app-bar-title>
      <v-btn
        :to="i18nUtil.path('/')"
        variant="text"
        :active="false"
        :aria-label="$t('common.moveToHome')"
      >
        MCRE TOOLS
      </v-btn>
    </v-app-bar-title>
    <template v-slot:append>
      <language-switcher />
      <x-share-button class="mr-1" />
    </template>
  </v-app-bar>

  <v-navigation-drawer v-model="drawer" v-for="tool in tools" :key="tool">
    <v-list lines="two" :role="null">
      <v-list-item
        :title="$t(`tools.${tool}.title`)"
        :subtitle="$t(`tools.${tool}.descriptionShort`)"
        :to="i18nUtil.path(tool)"
      >
        <template v-slot:prepend>
          <v-avatar size="32">
            <img :src="`/img/${tool}/32.png`" alt="" width="32" height="32" />
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
const drawer = ref(false);
import { useTheme } from "vuetify";
const i18nUtil = useI18nUtil();

onMounted(() => {
  if (!import.meta.env.SSR) {
    const theme = useTheme();
    const currentTheme = window.matchMedia("(prefers-color-scheme: dark)")
      .matches
      ? "dark"
      : "light";
    theme.global.name.value = currentTheme;
  }
});
</script>
