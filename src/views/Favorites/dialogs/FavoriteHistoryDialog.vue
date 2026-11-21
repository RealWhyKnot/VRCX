<template>
  <Dialog
    :open="true"
    @update:open="
      (open) => {
        if (!open) emit('close');
      }
    "
  >
    <DialogContent
      class="grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-2xl"
      @open-auto-focus.prevent="heading?.focus({ preventScroll: true })"
    >
      <DialogHeader
        ><DialogTitle as-child
          ><h2 ref="heading" tabindex="-1" class="outline-none">{{ t("dialog.retained_history.favorites") }}</h2></DialogTitle
        ></DialogHeader
      >
      <RetainedHistoryTable :key="userStore.currentUser.id" kind="favorite" />
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import RetainedHistoryTable from "@/components/history/RetainedHistoryTable.vue";
import { useUserStore } from "@/stores/user";
const { t } = useI18n();
const userStore = useUserStore();
const heading = ref<HTMLElement | null>(null);
const emit = defineEmits<{ close: [] }>();
</script>
