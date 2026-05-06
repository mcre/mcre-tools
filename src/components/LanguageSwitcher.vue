<template>
  <v-container>
    <v-menu offset-y>
      <template #activator="{ props }">
        <v-btn
          v-bind="props"
          id="language-switcher-button"
          :aria-label="$t('common.changeLanguage')"
          :icon="mdiTranslate"
          size="small"
        />
      </template>

      <v-list>
        <v-list-item
          v-for="(lang, index) in availableLocales"
          :id="`language-option-${lang}`"
          :key="index"
          @click="changeLanguage(lang)"
        >
          <v-list-item-title>
            {{ messages[lang]?.languageName }}
            <v-icon v-if="locale === lang" :icon="mdiCheck" size="small" />
          </v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
  </v-container>
</template>

<script lang="ts" setup>
import type { AvailableLocales } from "@/plugins/i18n";
import { mdiCheck, mdiTranslate } from "@mdi/js";
import { useI18n } from "vue-i18n";

const { messages, locale, availableLocales } = useI18n();

const router = useRouter();
const route = useRoute();

const changeLanguage = (lang: AvailableLocales) => {
  if (locale.value === lang) return;

  const pathSegments = route.path.split("/");
  if (availableLocales.includes(pathSegments[1] as AvailableLocales)) {
    pathSegments[1] = lang;
  } else {
    pathSegments.unshift(lang);
  }

  const newPath = pathSegments.join("/").replace(/\/+/g, "/");
  locale.value = lang;
  router.push({
    path: newPath,
    query: route.query,
    hash: route.hash,
  });
};
</script>
