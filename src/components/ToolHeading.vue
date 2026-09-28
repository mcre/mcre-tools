<template>
  <v-container data-testid="tool-heading">
    <v-row class="align-center">
      <v-col cols="auto">
        <v-avatar size="32">
          <img
            alt=""
            height="32"
            :src="`/img/${tool}/32.png`"
            :srcset="`/img/${tool}/32.png 1x, /img/${tool}/64.png 2x`"
            width="32"
          />
        </v-avatar>
      </v-col>

      <v-col>
        <h1>{{ $t(`tools.${tool}.title`) }}</h1>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <p>{{ $t(`tools.${tool}.description`) }}</p>
        <slot />
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts" setup>
defineProps<{ tool: string }>();
</script>
