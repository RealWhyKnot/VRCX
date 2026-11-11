<template>
  <Dialog v-model:open="isVisible">
    <DialogContent class="sm:max-w-150">
      <DialogHeader>
        <DialogTitle>{{ t("dialog.allowed_video_player_domains.header") }}</DialogTitle>
      </DialogHeader>

      <div>
        <InputGroupAction
          v-for="(url, index) in urlList"
          :key="index"
          :model-value="url"
          class="mt-1.5"
          size="sm"
          @update:model-value="(value) => setUrl(index, value)"
        >
          <template #actions>
            <Button variant="ghost" @click="urlList.splice(index, 1)"><Trash2 /></Button>
          </template>
        </InputGroupAction>
        <Button size="sm" variant="outline" style="margin-top: 6px" @click="urlList.push('')">
          {{ t("dialog.allowed_video_player_domains.add_domain") }}
        </Button>
      </div>

      <DialogFooter>
        <Button :disabled="!worldAllowedDomainsDialog.worldId" @click="saveWorldAllowedDomains">
          {{ t("dialog.allowed_video_player_domains.save") }}
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
import { computed, ref, watch } from "vue";
import Button from "@/components/ui/button/Button.vue";
import InputGroupAction from "@/components/ui/input-group/InputGroupAction.vue";
import { Trash2 } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import { worldRequest } from "../../../api/world";
import { logError } from "../../../stores/vrcx-messages";
import type { WorldAllowedDomainsState } from "./use-world-dialog-commands";

const props = defineProps<{
  worldAllowedDomainsDialog: WorldAllowedDomainsState;
}>();

defineEmits<{
  "update:worldAllowedDomainsDialog": [value: WorldAllowedDomainsState];
}>();

const { t } = useI18n();

const urlList = ref<string[]>([]);

function setUrl(index: number, value: string | number) {
  urlList.value[index] = String(value);
}

const isVisible = computed({
  get() {
    return props.worldAllowedDomainsDialog.visible;
  },
  set(isVisible: boolean) {
    const D = props.worldAllowedDomainsDialog;
    D.visible = isVisible;
  },
});

watch(
  () => props.worldAllowedDomainsDialog.visible,
  (isVisible) => {
    if (isVisible) {
      urlList.value = props.worldAllowedDomainsDialog.urlList;
    }
  }
);

function saveWorldAllowedDomains() {
  const D = props.worldAllowedDomainsDialog;
  void worldRequest
    .saveWorld({
      id: D.worldId,
      urlList: urlList.value,
    })
    .then(() => {
      toast.success("Allowed Video Player Domains updated");
    })
    .catch(logError);
  D.visible = false;
}
</script>
