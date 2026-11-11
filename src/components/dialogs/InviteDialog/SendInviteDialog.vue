<template>
  <Dialog
    :open="sendInviteDialogVisible"
    @update:open="
      (open) => {
        if (!open) cancelSendInvite();
      }
    "
  >
    <DialogContent class="x-dialog sm:max-w-200">
      <DialogHeader>
        <DialogTitle>{{ t("dialog.invite_message.header") }}</DialogTitle>
      </DialogHeader>

      <template v-if="isLocalUserVrcPlusSupporter">
        <input class="inviteImageUploadButton" type="file" accept="image/*" @change="inviteImageUpload" />
      </template>

      <DataTableLayout
        style="margin-top: 8px"
        :table="inviteMessageTanstackTable"
        :loading="false"
        :show-pagination="false"
        :on-row-click="handleInviteMessageRowClick"
      />

      <DialogFooter>
        <Button variant="secondary" @click="cancelSendInvite">
          {{ t("dialog.invite_message.cancel") }}
        </Button>
        <Button variant="outline" @click="refreshInviteMessageTableData('message')">
          {{ t("dialog.invite_message.refresh") }}
        </Button>
      </DialogFooter>
    </DialogContent>

    <SendInviteConfirmDialog
      v-model:is-send-invite-confirm-dialog-visible="isSendInviteConfirmDialogVisible"
      :send-invite-dialog="sendInviteDialog"
      :invite-dialog="inviteDialog"
      @update:send-invite-dialog="emit('update:sendInviteDialog', $event)"
      @close-invite-dialog="closeInviteDialog"
    />
    <EditAndSendInviteDialog
      v-model:edit-and-send-invite-dialog="editAndSendInviteDialog"
      :send-invite-dialog="sendInviteDialog"
      :invite-dialog="inviteDialog"
      @update:send-invite-dialog="emit('update:sendInviteDialog', $event)"
      @close-invite-dialog="closeInviteDialog"
    />
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogFooter from "@/components/ui/dialog/DialogFooter.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import { computed, ref } from "vue";
import Button from "@/components/ui/button/Button.vue";
import DataTableLayout from "@/components/ui/data-table/DataTableLayout.vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { useVrcxVueTable } from "@/lib/table/use-vrcx-vue-table";

import { useGalleryStore } from "../../../stores/gallery";
import { useInviteStore } from "../../../stores/invite";
import { useUserStore } from "../../../stores/user";
import type { InviteMessage } from "vrchat";
import type { Json } from "../../../types/vrcx";
import type { SendInviteDialogState } from "../UserDialog/use-user-dialog-commands";
import { createColumns } from "./send-invite-columns.tsx";
import type { EditAndSendInviteDialogState, InviteDialogState } from "./invite-dialog-types";

import EditAndSendInviteDialog from "./EditAndSendInviteDialog.vue";
import SendInviteConfirmDialog from "./SendInviteConfirmDialog.vue";

type InviteMessageRow = { original: Json<InviteMessage> };

const { t } = useI18n();

const { refreshInviteMessageTableData } = useInviteStore();
const { inviteMessageTable } = storeToRefs(useInviteStore());
const { inviteImageUpload } = useGalleryStore();
const { isLocalUserVrcPlusSupporter } = storeToRefs(useUserStore());

const props = withDefaults(
  defineProps<{
    sendInviteDialogVisible?: boolean;
    sendInviteDialog: SendInviteDialogState;
    inviteDialog?: Partial<InviteDialogState> | undefined;
  }>(),
  {
    sendInviteDialogVisible: false,
    inviteDialog: () => ({}),
  }
);

const emit = defineEmits<{
  closeInviteDialog: [];
  "update:sendInviteDialogVisible": [value: boolean];
  "update:sendInviteDialog": [value: SendInviteDialogState];
}>();

const isSendInviteConfirmDialogVisible = ref(false);

const editAndSendInviteDialog = ref<EditAndSendInviteDialogState>({
  visible: false,
  newMessage: "",
});

const inviteMessageRows = computed(() => inviteMessageTable.value.data);
const inviteMessageColumns = computed(() =>
  createColumns({
    onEdit: showEditAndSendInviteDialog,
  })
);

const { table: inviteMessageTanstackTable } = useVrcxVueTable({
  persistKey: "invite-message",
  get data() {
    return inviteMessageRows.value;
  },
  columns: inviteMessageColumns,
  getRowId: (row) => String(row.slot),
  enablePagination: false,
  initialSorting: [{ id: "slot", desc: false }],
});

function handleInviteMessageRowClick(row: InviteMessageRow) {
  showSendInviteConfirmDialog(row.original);
}

function showSendInviteConfirmDialog(row: Json<InviteMessage>) {
  emit("update:sendInviteDialog", { ...props.sendInviteDialog, messageSlot: row });
  isSendInviteConfirmDialogVisible.value = true;
}

function showEditAndSendInviteDialog(row: Json<InviteMessage>) {
  emit("update:sendInviteDialog", { ...props.sendInviteDialog, messageSlot: row });
  editAndSendInviteDialog.value = {
    newMessage: row.message,
    visible: true,
  };
}

function cancelSendInvite() {
  emit("update:sendInviteDialogVisible", false);
}

function closeInviteDialog() {
  cancelSendInvite();
  emit("closeInviteDialog");
}
</script>
