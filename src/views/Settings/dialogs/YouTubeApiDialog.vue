<template>
  <Dialog :open="isYouTubeApiDialogVisible" @update:open="(open) => (open ? null : closeDialog())">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ t("dialog.youtube_api.header") }}</DialogTitle>
      </DialogHeader>
      <div class="text-xs">{{ t("dialog.youtube_api.description") }} <br /></div>

      <InputGroupTextareaField v-model="youTubeApiKey" :placeholder="t('dialog.youtube_api.placeholder')" :maxlength="39" :rows="2" class="mt-2.5" show-count />

      <DialogFooter>
        <Button variant="outline" @click="openExternalLink('https://smashballoon.com/doc/youtube-api-key/')">
          {{ t("dialog.youtube_api.guide") }}
        </Button>
        <Button @click="testYouTubeApiKey">
          {{ t("dialog.youtube_api.save") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogFooter from "@/components/ui/dialog/DialogFooter.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import Button from "@/components/ui/button/Button.vue";
import InputGroupTextareaField from "@/components/ui/input-group/InputGroupTextareaField.vue";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import { openExternalLink } from "../../../shared/utils/app-actions";
import { useAdvancedSettingsStore } from "../../../stores/settings/advanced";

const advancedSettingsStore = useAdvancedSettingsStore();

const { youTubeApiKey } = storeToRefs(advancedSettingsStore);

const { lookupYouTubeVideo, setYouTubeApiKey } = advancedSettingsStore;

const { t } = useI18n();

defineProps({
  isYouTubeApiDialogVisible: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:isYouTubeApiDialogVisible"]);

async function testYouTubeApiKey() {
  const previousKey = youTubeApiKey.value;
  if (!youTubeApiKey.value) {
    toast.success("YouTube API key removed");
    closeDialog();
    return;
  }
  const data = await lookupYouTubeVideo("dQw4w9WgXcQ");
  if (!data) {
    setYouTubeApiKey(previousKey);
    toast.error("Invalid YouTube API key");
  } else {
    setYouTubeApiKey(youTubeApiKey.value);
    toast.success("YouTube API key valid!");
    closeDialog();
  }
}

function closeDialog() {
  emit("update:isYouTubeApiDialogVisible", false);
}
</script>
