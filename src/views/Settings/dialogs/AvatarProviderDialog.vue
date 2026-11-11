<template>
  <Dialog :open="isAvatarProviderDialogVisible" @update:open="(open) => (open ? null : closeDialog())">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ t("dialog.avatar_database_provider.header") }}</DialogTitle>
      </DialogHeader>
      <div>
        <InputGroupAction
          v-for="(provider, index) in avatarRemoteDatabaseProviderList"
          :key="index"
          v-model="avatarRemoteDatabaseProviderList[index]"
          class="mt-1.5"
          size="sm"
          @change="saveAvatarProviderList"
        >
          <template #actions>
            <Trash2 class="cursor-pointer opacity-80 hover:opacity-100" @click="removeAvatarProvider(provider)" />
          </template>
        </InputGroupAction>

        <Button size="sm" style="margin-top: 6px" @click="addProvider">
          {{ t("dialog.avatar_database_provider.add_provider") }}
        </Button>
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
import { Trash2 } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import { useAvatarProviderStore } from "../../../stores/avatar-provider";

const { t } = useI18n();

const avatarProviderStore = useAvatarProviderStore();

const { avatarRemoteDatabaseProviderList } = storeToRefs(avatarProviderStore);
const { saveAvatarProviderList, removeAvatarProvider } = avatarProviderStore;

defineProps({
  isAvatarProviderDialogVisible: {
    type: Boolean,
    required: true,
  },
});

const emit = defineEmits(["update:isAvatarProviderDialogVisible"]);

function closeDialog() {
  emit("update:isAvatarProviderDialogVisible", false);
}

function addProvider() {
  avatarRemoteDatabaseProviderList.value.push("");
}
</script>
