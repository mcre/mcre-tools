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
          <span class="section-heading">
            <v-icon class="section-heading__icon" :icon="mdiToolbox" />

            <span class="section-heading__label">
              {{ $t("index.toolList") }}
            </span>
          </span>
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
              <img
                alt=""
                height="32"
                :src="`/img/${tool}/32.png`"
                :srcset="`/img/${tool}/32.png 1x, /img/${tool}/64.png 2x`"
                width="32"
              />
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
          <span class="section-heading">
            <v-icon class="section-heading__icon" :icon="mdiScaleBalance" />

            <span id="termsOfUseTitle" class="section-heading__label">
              {{ $t("index.termsOfUse") }}
            </span>
          </span>
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
          <span class="section-heading">
            <v-icon
              class="section-heading__icon"
              :icon="mdiInformationOutline"
            />

            <span class="section-heading__label">
              {{ $t("index.referenceInformation") }}
            </span>
          </span>
        </h2>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" sm="4">
        <div class="reference-link">
          <v-btn
            :aria-label="$t('index.aboutTheCreatorLinkLabel')"
            href="https://mcre.info"
            :icon="mdiAccountCircle"
            rel="noopener noreferrer"
            size="small"
            target="_blank"
          />

          <span class="reference-link__label">
            {{ $t("index.aboutTheCreator") }}
          </span>
        </div>
      </v-col>

      <v-col cols="12" sm="4">
        <div class="reference-link">
          <v-btn
            :aria-label="$t('index.sourceCodesLinkLabel')"
            href="https://github.com/mcre/mcre-tools"
            :icon="mdiGithub"
            rel="noopener noreferrer"
            size="small"
            target="_blank"
          />

          <span class="reference-link__label">
            {{ $t("index.sourceCodes") }}
          </span>
        </div>
      </v-col>

      <v-col cols="12" sm="4">
        <div class="reference-link">
          <v-btn
            :aria-label="$t('index.aboutLicensesLinkLabel')"
            href="https://github.com/mcre/mcre-tools/blob/main/LICENSE"
            :icon="mdiCertificateOutline"
            rel="noopener noreferrer"
            size="small"
            target="_blank"
          />

          <span class="reference-link__label">
            {{ $t("index.aboutLicenses") }}
          </span>
        </div>
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

<style scoped>
.section-heading,
.reference-link {
  display: inline-flex;
  align-items: center;
  column-gap: 8px;
}

.section-heading__icon {
  flex: 0 0 auto;
}

.section-heading__label,
.reference-link__label {
  line-height: 1.5;
}
</style>
