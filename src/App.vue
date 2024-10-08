<template>
  <v-app>
    <v-app-bar flat density="comfortable">
      <template v-slot:prepend>
        <v-app-bar-nav-icon
          variant="text"
          @click.stop="drawer = !drawer"
          aria-label="メニューを開閉する"
        />
      </template>
      <v-app-bar-title>
        <v-btn
          to="/"
          variant="text"
          :active="false"
          aria-label="トップページへ移動"
        >
          MCRE TOOLS
        </v-btn>
      </v-app-bar-title>
      <template v-slot:append>
        <x-share-button class="mr-1" />
      </template>
    </v-app-bar>

    <v-navigation-drawer
      v-model="drawer"
      v-for="(tool, key) in tools"
      :key="key"
    >
      <v-list lines="two" :role="null">
        <v-list-item
          :title="tool.params.title"
          :subtitle="tool.params.descriptionShort"
          :to="tool.params.path"
        >
          <template v-slot:prepend>
            <v-avatar size="32">
              <img
                :src="`/img/${tool.params.iconDir}/32.png`"
                alt=""
                width="32"
                height="32"
              />
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
  </v-app>
</template>

<script lang="ts" setup>
const drawer = ref(false);
import { useTheme } from "vuetify";

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
