<template>
  <tool-heading class="compact-heading" :tool="tool" />

  <v-container>
    <div class="qr-tool">
      <div class="qr-tool__input-area">
        <label class="qr-tool__label" for="qr-text">{{
          $t(`${messages}.input`)
        }}</label>

        <div class="qr-tool__editor">
          <textarea
            id="qr-text"
            ref="editor"
            v-model="text"
            autocapitalize="off"
            autocomplete="off"
            class="qr-tool__textarea"
            :placeholder="$t(`${messages}.placeholder`)"
            spellcheck="false"
          />

          <div class="qr-tool__toolbar">
            <v-btn
              v-if="canRestore"
              :prepend-icon="mdiUndo"
              variant="text"
              @click="restoreText"
              >{{ $t(`${messages}.undo`) }}</v-btn
            >

            <v-btn
              v-else
              :disabled="!text"
              :prepend-icon="mdiClose"
              variant="text"
              @click="clear"
              >{{ $t(`${messages}.clear`) }}</v-btn
            >
          </div>
        </div>

        <p v-if="error" class="qr-tool__error" role="alert">
          {{ $t(`${messages}.tooLong`) }}
        </p>
      </div>

      <div class="qr-tool__result">
        <div :aria-busy="pending" class="qr-tool__paper" data-testid="qr-paper">
          <img
            v-if="image"
            :alt="$t(`${messages}.imageAlt`)"
            class="qr-tool__image"
            data-testid="qr-image"
            height="1024"
            :src="image"
            width="1024"
          />

          <div v-else class="qr-tool__placeholder">
            <v-icon aria-hidden="true" :icon="mdiQrcode" size="64" />

            <span>{{
              $t(`${messages}.${pending ? "generating" : "empty"}`)
            }}</span>
          </div>
        </div>

        <div class="qr-tool__actions">
          <v-btn
            color="primary"
            :disabled="!image || !supported"
            height="48"
            :loading="status === 'copying'"
            :prepend-icon="status === 'copied' ? mdiCheck : mdiContentCopy"
            variant="flat"
            @click="copy"
            >{{
              $t(`${messages}.${status === "copied" ? "copied" : "copy"}`)
            }}</v-btn
          >

          <v-btn
            v-if="image"
            download="qr-code.png"
            height="48"
            :href="image"
            :prepend-icon="mdiDownload"
            variant="tonal"
            >{{ $t(`${messages}.save`) }}</v-btn
          >

          <v-btn
            v-else
            disabled
            height="48"
            :prepend-icon="mdiDownload"
            variant="tonal"
            >{{ $t(`${messages}.save`) }}</v-btn
          >
        </div>

        <p class="qr-tool__status" role="status">
          {{
            image && (!supported || status === "failed")
              ? $t(
                  `${messages}.${supported ? "copyFailed" : "copyUnsupported"}`,
                )
              : ""
          }}
        </p>
      </div>
    </div>

    <tool-guide :tool="tool" :topics="['image', 'draft']">
      <router-link
        class="qr-tool__terms-link"
        :to="`/${$i18n.locale}/#termsOfUseTitle`"
        >{{ $t("index.termsOfUse") }}</router-link
      >
    </tool-guide>

    <p class="text-caption text-medium-emphasis mt-6 mb-0">
      {{ $t("common.qrCodeTrademark") }}
    </p>
  </v-container>
</template>

<script lang="ts" setup>
import {
  mdiCheck,
  mdiClose,
  mdiContentCopy,
  mdiDownload,
  mdiQrcode,
  mdiUndo,
} from "@mdi/js";
import { useHead } from "@unhead/vue";

const tool = "qr-code";
const messages = `tools.${tool}`;
useHead(useHeaderUtil().getHead(tool));
const { text, canRestore, clear, restore } = useTextDraft();
const { image, pending, error } = useQrCode(text);
const { supported, status, copy } = useQrClipboard(image);
const editor = ref<HTMLTextAreaElement | null>(null);
const restoreText = async () => {
  restore();
  await nextTick();
  editor.value?.focus();
};
</script>

<style scoped>
.compact-heading :deep(h1),
.compact-heading :deep(p) {
  margin: 0;
}
.compact-heading :deep(.v-row) {
  gap: 16px;
}
.compact-heading :deep(.v-row + .v-row) {
  margin-top: 12px;
}
.qr-tool {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 48px;
  align-items: start;
  padding-top: 8px;
}
.qr-tool__label {
  display: block;
  margin-bottom: 12px;
  font-size: 0.875rem;
  font-weight: 500;
}
.qr-tool__editor {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.2);
  border-radius: 12px;
  background: rgb(var(--v-theme-surface));
}
.qr-tool__editor:focus-within {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 0 1px rgb(var(--v-theme-primary));
}
.qr-tool__textarea {
  display: block;
  width: 100%;
  height: 220px;
  min-height: 112px;
  padding: 20px;
  resize: vertical;
  outline: none;
  border: 0;
  border-radius: 12px 12px 0 0;
  background: transparent;
  color: inherit;
  font: inherit;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.qr-tool__textarea::placeholder {
  color: rgba(var(--v-theme-on-surface), 0.45);
}
.qr-tool__toolbar {
  display: flex;
  justify-content: flex-end;
  padding: 4px 8px;
}
.qr-tool__result {
  min-width: 0;
}
.qr-tool__paper {
  display: grid;
  place-items: center;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  border: 1px solid #e4e7eb;
}
.qr-tool__image {
  display: block;
  width: 100%;
  height: auto;
}
.qr-tool__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 20px;
  text-align: center;
  color: #667085;
  font-size: 0.875rem;
}
.qr-tool__placeholder .v-icon {
  opacity: 0.4;
}
.qr-tool__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 20px;
}
.qr-tool__actions .v-btn {
  min-width: 0;
  padding-inline: 12px;
  letter-spacing: 0;
}
.qr-tool__status,
.qr-tool__error {
  margin-top: 12px;
  font-size: 0.875rem;
  line-height: 1.6;
}
.qr-tool__status {
  color: rgba(var(--v-theme-on-surface), 0.68);
}
.qr-tool__error {
  color: rgb(var(--v-theme-error));
}
.qr-tool__terms-link {
  display: inline-block;
  margin-top: 20px;
  color: inherit;
  text-underline-offset: 3px;
}
.qr-tool__terms-link:hover {
  color: rgb(var(--v-theme-primary));
}
@media (max-width: 700px) {
  .compact-heading :deep(h1) {
    font-size: 28px;
  }
  .qr-tool {
    grid-template-columns: minmax(0, 1fr);
    gap: 20px;
    padding-top: 0;
  }
  .qr-tool__textarea {
    height: 96px;
    min-height: 96px;
    padding: 16px;
  }
  .qr-tool__result {
    width: 100%;
    max-width: 360px;
    margin-inline: auto;
  }
  .qr-tool__paper {
    width: clamp(160px, 28dvh, 240px);
    margin-inline: auto;
  }
  .qr-tool__actions {
    margin-top: 16px;
  }
}
</style>
