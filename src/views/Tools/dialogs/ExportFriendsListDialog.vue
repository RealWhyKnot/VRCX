<template>
  <Dialog v-model:open="isVisible">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ t("dialog.export_friends_list.header") }}</DialogTitle>
      </DialogHeader>
      <TabsUnderline default-value="csv" :items="exportFriendsTabs" :unmount-on-hide="false" class="mt-2.5">
        <template #csv>
          <InputGroupTextareaField v-model="exportFriendsListCsv" :rows="15" readonly input-class="resize-none mt-4" @click="selectTextareaOnClick" />
        </template>
        <template #json>
          <InputGroupTextareaField v-model="exportFriendsListJson" :rows="15" readonly class="mt-4" input-class="resize-none" @click="selectTextareaOnClick" />
        </template>
      </TabsUnderline>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import { computed, ref, watch } from "vue";
import InputGroupTextareaField from "@/components/ui/input-group/InputGroupTextareaField.vue";
import TabsUnderline from "@/components/ui/tabs/TabsUnderline.vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import { useUserStore } from "../../../stores/user";
import { escapeCsvField } from "./csv-field";
import type { FriendContext } from "../../../stores/friend-types";

const props = defineProps<{
  friends: Map<string, FriendContext>;
  isExportFriendsListDialogVisible: boolean;
}>();
const emit = defineEmits<{
  "update:isExportFriendsListDialogVisible": [value: boolean];
}>();

const { currentUser } = storeToRefs(useUserStore());

const { t } = useI18n();

const exportFriendsListCsv = ref("");
const exportFriendsListJson = ref("");
const exportFriendsTabs = computed(() => [
  { value: "csv", label: t("dialog.export_friends_list.csv") },
  { value: "json", label: t("dialog.export_friends_list.json") },
]);

const isVisible = computed({
  get() {
    return props.isExportFriendsListDialogVisible;
  },
  set(isOpen: boolean) {
    emit("update:isExportFriendsListDialogVisible", isOpen);
  },
});

function selectTextareaOnClick(event: MouseEvent) {
  const target = event.target;
  if (target instanceof HTMLTextAreaElement) {
    target.select();
  }
}

watch(
  () => props.isExportFriendsListDialogVisible,
  (isOpen) => {
    if (isOpen) {
      initExportFriendsListDialog();
    }
  }
);

function initExportFriendsListDialog() {
  const { friends } = currentUser.value;
  if (!Array.isArray(friends)) {
    return;
  }
  const lines = ["UserID,DisplayName,Memo"];
  const friendsList: string[] = [];
  for (const userId of friends) {
    const ref = props.friends.get(userId);
    const name = ref?.name ?? "";
    const memo = (ref?.ref?.$memo ?? "").replace(/\n/g, " ");
    lines.push(`${escapeCsvField(userId)},${escapeCsvField(name)},${escapeCsvField(memo)}`);
    friendsList.push(userId);
  }
  exportFriendsListJson.value = JSON.stringify({ friends: friendsList }, null, 4);
  exportFriendsListCsv.value = lines.join("\n");
}
</script>
