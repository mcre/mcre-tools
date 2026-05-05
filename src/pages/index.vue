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
      <v-col v-for="tool in tools" :key="tool" cols="12">
        <v-card
          :subtitle="$t(`tools.${tool}.descriptionShort`)"
          :title="$t(`tools.${tool}.title`)"
          :to="i18nUtil.path(tool)"
        >
          <template #prepend>
            <v-avatar size="32">
              <img alt="" height="32" :src="`/img/${tool}/32.png`" width="32" />
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
          <v-icon class="mb-1" start>
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
          <v-icon class="mb-1" start>
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
          :icon="mdiAccountCircle"
          rel="noopener noreferrer"
          size="small"
          target="_blank"
        />
        {{ $t("index.aboutTheCreator") }}
      </v-col>

      <v-col cols="12" sm="4">
        <v-btn
          class="mb-1 mr-2"
          href="https://github.com/mcre/mcre-tools"
          :icon="mdiGithub"
          rel="noopener noreferrer"
          size="small"
          target="_blank"
        />
        {{ $t("index.sourceCodes") }}
      </v-col>

      <v-col cols="12" sm="4">
        <v-btn
          class="mb-1 mr-2"
          href="https://github.com/mcre/mcre-tools/blob/main/LICENSE"
          :icon="mdiCertificateOutline"
          rel="noopener noreferrer"
          size="small"
          target="_blank"
        />
        {{ $t("index.aboutLicenses") }}
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts" setup>
import {
  mdiAccountCircle,
  mdiCertificateOutline,
  mdiGithub,
  mdiInformationOutline,
  mdiScaleBalance,
  mdiToolbox,
} from "@mdi/js";
import { useHead } from "@unhead/vue";
const headerUtil = useHeaderUtil();
useHead(headerUtil.getHead());

const i18nUtil = useI18nUtil();
</script>
