<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <h1>{{ $t("common.title") }}</h1>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12">
        <p>{{ $t("common.description") }}</p>
      </v-col>
    </v-row>
  </v-container>
  <v-container>
    <v-row>
      <v-col cols="12">
        <h2>
          <v-icon start> {{ mdiToolbox }} </v-icon>{{ $t("index.toolList") }}
        </h2>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12" v-for="tool in tools" :key="tool">
        <v-card
          :title="$t(`tools.${tool}.title`)"
          :subtitle="$t(`tools.${tool}.descriptionShort`)"
          :to="i18nUtil.path(tool)"
        >
          <template v-slot:prepend>
            <v-avatar size="32">
              <img :src="`/img/${tool}/32.png`" alt="" width="32" height="32" />
            </v-avatar>
          </template>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
  <v-container>
    <v-row>
      <v-col cols="12">
        <h2>
          <v-icon start class="mb-1">
            {{ mdiScaleBalance }}
          </v-icon>
          <span id="termsOfUseTitle">{{ $t("index.termsOfUse") }}</span>
        </h2>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12">
        <p>
          {{ $t("index.termsOfUseDescription1") }}
        </p>
        <p>
          {{ $t("index.termsOfUseDescription2") }}
        </p>
      </v-col>
    </v-row>
  </v-container>
  <v-container>
    <v-row>
      <v-col cols="12">
        <h2>
          <v-icon start class="mb-1">
            {{ mdiInformationOutline }}
          </v-icon>
          {{ $t("index.referenceInformation") }}
        </h2>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12" sm="4">
        <v-btn
          class="mb-1 mr-2"
          href="https://mcre.info"
          target="_blank"
          rel="noopener noreferrer"
          :icon="mdiAccountCircle"
          size="small"
        />
        {{ $t("index.aboutTheCreator") }}
      </v-col>
      <v-col cols="12" sm="4">
        <v-btn
          class="mb-1 mr-2"
          href="https://github.com/mcre/mcre-tools"
          target="_blank"
          rel="noopener noreferrer"
          :icon="mdiGithub"
          size="small"
        />
        {{ $t("index.sourceCodes") }}
      </v-col>
      <v-col cols="12" sm="4">
        <v-btn
          class="mb-1 mr-2"
          href="https://github.com/mcre/mcre-tools/blob/main/LICENSE"
          target="_blank"
          rel="noopener noreferrer"
          :icon="mdiCertificateOutline"
          size="small"
        />
        {{ $t("index.aboutLicenses") }}
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts" setup>
import { useHead } from "@unhead/vue";
const headerUtil = useHeaderUtil();
useHead(headerUtil.getHead());

const i18nUtil = useI18nUtil();

import {
  mdiToolbox,
  mdiScaleBalance,
  mdiAccountCircle,
  mdiInformationOutline,
  mdiGithub,
  mdiCertificateOutline,
} from "@mdi/js";
</script>
