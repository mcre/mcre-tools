<template>
  <v-container>
    <v-menu offset-y>
      <template v-slot:activator="{ props }">
        <v-btn
          :icon="mdiTranslate"
          size="small"
          v-bind="props"
          id="language-switcher-button"
        />
      </template>
      <v-list>
        <v-list-item
          v-for="(lang, index) in availableLocales"
          :key="index"
          @click="changeLanguage(lang)"
          :id="`language-option-${lang}`"
        >
          <v-list-item-title>
            {{ messages[lang]?.languageName }}
            <v-icon v-if="locale === lang" size="small" :icon="mdiCheck" />
          </v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
  </v-container>
</template>

<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { mdiTranslate, mdiCheck } from "@mdi/js";
import { AvailableLocales } from "@/plugins/i18n";

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
