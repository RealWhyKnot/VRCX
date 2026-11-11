<script setup lang="ts">
import AlertDialog from "@/components/ui/alert-dialog/AlertDialog.vue";
import AlertDialogContent from "@/components/ui/alert-dialog/AlertDialogContent.vue";
import AlertDialogDescription from "@/components/ui/alert-dialog/AlertDialogDescription.vue";
import AlertDialogFooter from "@/components/ui/alert-dialog/AlertDialogFooter.vue";
import AlertDialogHeader from "@/components/ui/alert-dialog/AlertDialogHeader.vue";
import AlertDialogTitle from "@/components/ui/alert-dialog/AlertDialogTitle.vue";
import Button from "@/components/ui/button/Button.vue";
import { X } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { computed, nextTick, ref, watch } from "vue";

import { useExternalLinkStore } from "@/stores/external-link";
import { copyToClipboard } from "@/shared/utils/app-actions";
import { logFailure } from "@/stores/log-failure";

const externalLinkStore = useExternalLinkStore();
const { externalLinkDialog } = storeToRefs(externalLinkStore);
const openButtonRef = ref<{ $el: HTMLElement } | null>(null);

const vrcdnStreamPrefix = "rtspt://stream.vrcdn.live/live/";
const vrcdnPreviewUrl = computed(() => {
  const link = externalLinkDialog.value.link;
  if (!link.startsWith(vrcdnStreamPrefix)) return null;
  return `https://panel.vrcdn.live/preview/${link.slice(vrcdnStreamPrefix.length)}`;
});

function setOpen(isOpen: boolean) {
  externalLinkDialog.value.visible = isOpen;
}

function dismiss() {
  setOpen(false);
}

function copyLink() {
  if (!externalLinkDialog.value.visible) return;
  const link = externalLinkDialog.value.link;
  setOpen(false);
  copyToClipboard(link, "Link copied to clipboard!");
}

function openLink() {
  if (!externalLinkDialog.value.visible) return;
  const link = externalLinkDialog.value.link;
  setOpen(false);
  if (vrcdnPreviewUrl.value) {
    void window.AppApi.OpenLink(vrcdnPreviewUrl.value).catch(logFailure("Opening the link failed:"));
    return;
  }
  void window.AppApi.OpenLink(link).catch(logFailure("Opening the link failed:"));
}

function onKeyDown(event: KeyboardEvent) {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "c") {
    return;
  }
  event.preventDefault();
  copyLink();
}

watch(
  () => externalLinkDialog.value.visible,
  async (isVisible) => {
    if (!isVisible) return;
    await nextTick();
    await nextTick();
    openButtonRef.value?.$el.focus();
  }
);
</script>

<template>
  <AlertDialog :open="externalLinkDialog.visible" @update:open="setOpen">
    <AlertDialogContent @keydown="onKeyDown" @escape-key-down="dismiss" @pointer-down-outside="dismiss" @interact-outside="dismiss">
      <button
        type="button"
        aria-label="Close"
        class="ring-offset-background focus:ring-ring absolute top-4 right-4 cursor-pointer rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden"
        @click="dismiss"
      >
        <X class="size-4" />
        <span class="sr-only">Close</span>
      </button>

      <AlertDialogHeader class="min-w-0">
        <AlertDialogTitle>Open External Link</AlertDialogTitle>
        <AlertDialogDescription class="w-full min-w-0 whitespace-normal wrap-anywhere">
          {{ externalLinkDialog.link }}
        </AlertDialogDescription>
        <p v-if="vrcdnPreviewUrl" class="w-full min-w-0 text-xs text-muted-foreground/70 whitespace-normal wrap-anywhere">
          {{ vrcdnPreviewUrl }}
        </p>
      </AlertDialogHeader>

      <AlertDialogFooter>
        <Button variant="outline" @click="copyLink">Copy</Button>
        <Button ref="openButtonRef" @click="openLink">Open</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
