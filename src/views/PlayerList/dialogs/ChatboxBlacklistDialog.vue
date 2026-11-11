<template>
  <Dialog :open="chatboxBlacklistDialog.visible" @update:open="emit('updateOpen', $event)">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ t("dialog.chatbox_blacklist.header") }}</DialogTitle>
      </DialogHeader>
      <div v-if="chatboxBlacklistDialog.visible">
        <h2>{{ t("dialog.chatbox_blacklist.keyword_blacklist") }}</h2>
        <InputGroupAction
          v-for="(item, index) in chatboxBlacklist"
          :key="index"
          :model-value="item"
          class="mt-1.5"
          size="sm"
          @update:model-value="updateChatboxBlacklistItem(index, $event)"
          @change="saveChatboxBlacklist"
        >
          <template #actions>
            <Button
              variant="outline"
              @click="
                chatboxBlacklist.splice(index, 1);
                saveChatboxBlacklist();
              "
            >
            </Button>
          </template>
        </InputGroupAction>
        <Button size="sm" variant="outline" class="mt-1.5" @click="chatboxBlacklist.push('')">
          {{ t("dialog.chatbox_blacklist.add_item") }}
        </Button>
        <br />
        <h2>{{ t("dialog.chatbox_blacklist.user_blacklist") }}</h2>
        <Badge v-for="user in chatboxUserBlacklist" :key="user[0]" variant="outline" class="mr-1.5 mt-1.5">
          <span>{{ user[1] }}</span>
          <button
            type="button"
            class="ml-2 [border:none] [background:transparent] p-0 inline-flex items-center text-[inherit] cursor-pointer"
            @click="deleteChatboxUserBlacklist(user[0])"
          >
            <X class="h-3 w-3 leading-none" />
          </button>
        </Badge>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import Button from "@/components/ui/button/Button.vue";
import InputGroupAction from "@/components/ui/input-group/InputGroupAction.vue";
import { X } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import Badge from "../../../components/ui/badge/Badge.vue";
import { usePhotonStore } from "../../../stores/photon";

const { t } = useI18n();

const photonStore = usePhotonStore();
const { chatboxUserBlacklist, chatboxBlacklist } = storeToRefs(photonStore);
const { saveChatboxBlacklist } = photonStore;

defineProps<{
  chatboxBlacklistDialog: { visible: boolean; loading: boolean };
}>();

const emit = defineEmits<{
  deleteChatboxUserBlacklist: [userId: string];
  updateOpen: [open: boolean];
}>();

function updateChatboxBlacklistItem(index: number, value: string | number) {
  chatboxBlacklist.value[index] = String(value);
}

function deleteChatboxUserBlacklist(userId: string) {
  emit("deleteChatboxUserBlacklist", userId);
}
</script>
