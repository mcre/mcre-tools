<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <h1>MCRE TOOLS</h1>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12">
        <p>便利ツールやジョークツールなど、いろいろ置いていきます。</p>
      </v-col>
    </v-row>
  </v-container>
  <v-container>
    <v-row>
      <v-col cols="12">
        <h2>
          <v-icon start> {{ mdiToolbox }} </v-icon>ツール一覧
        </h2>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12" v-for="(tool, key) in tools" :key="key">
        <v-card
          :title="tool.params.title"
          :subtitle="tool.params.descriptionShort"
          :to="tool.params.path"
        >
          <template v-slot:prepend>
            <v-avatar size="24">
              <img
                :src="`/img/${tool.params.iconDir}/32.png`"
                alt=""
                width="24"
                height="24"
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
          <v-icon start class="mb-1">
            {{ mdiScaleBalance }}
          </v-icon>
          利用規約
        </h2>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12">
        <p>
          当ウェブサイトで提供されるサービスやコンテンツは、あくまで参考としてご利用ください。その正確性や信頼性については保証いたしかねますので、利用者ご自身の判断と責任でご利用ください。
        </p>
        <p>
          また、当サイトの利用に関連して生じた損害等に関して、運営者は一切の責任を負いません。予告なく内容の変更や提供の終了を行うことがありますので、あらかじめご了承ください。
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
          参考情報
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
        作者について
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
        ソースコード・要望
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
        ライセンスに関して
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts" setup>
const util = useUtil();
util.setToolTitle();

import {
  mdiToolbox,
  mdiScaleBalance,
  mdiAccountCircle,
  mdiInformationOutline,
  mdiGithub,
  mdiCertificateOutline,
} from "@mdi/js";
</script>
