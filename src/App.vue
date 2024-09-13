<template>
  <v-app>
    <v-app-bar flat>
      <template v-slot:prepend>
        <v-app-bar-nav-icon variant="text" @click.stop="drawer = !drawer" />
      </template>
      <v-app-bar-title>
        <v-btn to="/" variant="text" :active="false">mcre tools</v-btn>
      </v-app-bar-title>
    </v-app-bar>

    <v-navigation-drawer
      v-model="drawer"
      v-for="(tool, key) in tools"
      :key="key"
    >
      <v-list lines="two">
        <v-list-item
          :title="tool.title"
          :subtitle="tool.descriptionShort"
          :to="tool.to"
        >
          <template v-slot:prepend>
            <v-avatar :image="`/img/${tool.iconDir}/32.png`" size="24" />
          </template>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <v-container max-width="1140">
        <router-view />
      </v-container>
    </v-main>
  </v-app>
</template>

<script lang="ts" setup>
import tools from "@/consts/tools";

const drawer = ref(false);
</script>
