<template>
  <Dialog :open="sendInviteResponseDialogVisible" @update:open="(open) => (open ? null : cancelSendInviteResponse())">
    <DialogContent class="x-dialog sm:max-w-200">
      <DialogHeader>
        <DialogTitle>{{ t("dialog.invite_response_message.header") }}</DialogTitle>
      </DialogHeader>
      <template v-if="isLocalUserVrcPlusSupporter">
        <input class="inviteImageUploadButton" type="file" accept="image/*" @change="inviteImageUpload" />
      </template>

      <DataTableLayout
        style="margin-top: 8px"
        :table="inviteResponseTable"
        :loading="false"
        :show-pagination="false"
        :on-row-click="handleInviteResponseRowClick"
      />

      <DialogFooter>
        <Button variant="secondary" class="mr-2" @click="cancelSendInviteResponse">{{ t("dialog.invite_response_message.cancel") }}</Button>
        <Button @click="refreshInviteMessageTableData('response')">{{ t("dialog.invite_response_message.refresh") }}</Button>
      </DialogFooter>
      <EditAndSendInviteResponseDialog
        v-model:edit-and-send-invite-response-dialog="editAndSendInviteResponseDialog"
        :send-invite-response-dialog="sendInviteResponseDialog"
        @close-response-confirm-dialog="closeResponseConfirmDialog"
        @close-invite-dialog="closeInviteDialog"
      />
      <SendInviteResponseConfirmDialog
        :send-invite-response-dialog="sendInviteResponseDialog"
        :send-invite-response-confirm-dialog="sendInviteResponseConfirmDialog"
        @close-response-confirm-dialog="closeResponseConfirmDialog"
        @close-invite-dialog="closeInviteDialog"
      />
    </DialogContent>
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
import { createColumns } from "./send-invite-response-columns.tsx";
import type { InviteMessageRow, InviteResponseSelection } from "./send-invite-response-columns.tsx";

import EditAndSendInviteResponseDialog from "./EditAndSendInviteResponseDialog.vue";
import SendInviteResponseConfirmDialog from "./SendInviteResponseConfirmDialog.vue";

const { t } = useI18n();

const inviteStore = useInviteStore();
const { refreshInviteMessageTableData } = inviteStore;
const { inviteResponseMessageTable } = storeToRefs(inviteStore);
const galleryStore = useGalleryStore();
const { inviteImageUpload } = galleryStore;
const { isLocalUserVrcPlusSupporter } = storeToRefs(useUserStore());

const props = defineProps<{
  sendInviteResponseDialog: InviteResponseSelection;
  sendInviteResponseDialogVisible: boolean;
}>();

const editAndSendInviteResponseDialog = ref({
  visible: false,
  newMessage: "",
});

const emit = defineEmits<{
  "update:sendInviteResponseDialogVisible": [value: boolean];
  "update:sendInviteResponseDialog": [value: InviteResponseSelection];
}>();

const sendInviteResponseConfirmDialog = ref({
  visible: false,
});

const inviteResponseRows = computed(() => inviteResponseMessageTable.value.data);
const inviteResponseColumns = computed(() =>
  createColumns({
    onEdit: showEditAndSendInviteResponseDialog,
  })
);

const { table: inviteResponseTable } = useVrcxVueTable({
  persistKey: "invite-response-message",
  get data() {
    return inviteResponseRows.value;
  },
  columns: inviteResponseColumns,
  getRowId: (row) => String(row.slot),
  enablePagination: false,
  initialSorting: [{ id: "slot", desc: false }],
});

function handleInviteResponseRowClick(row: { original: InviteMessageRow }) {
  showSendInviteResponseConfirmDialog(row.original);
}

function closeInviteDialog() {
  cancelSendInviteResponse();
}

function cancelSendInviteResponse() {
  emit("update:sendInviteResponseDialogVisible", false);
}

function closeResponseConfirmDialog() {
  sendInviteResponseConfirmDialog.value.visible = false;
  editAndSendInviteResponseDialog.value.visible = false;
}

function showEditAndSendInviteResponseDialog(row: InviteMessageRow) {
  emit("update:sendInviteResponseDialog", { ...props.sendInviteResponseDialog, messageSlot: row });
  editAndSendInviteResponseDialog.value = {
    newMessage: row.message,
    visible: true,
  };
}

function showSendInviteResponseConfirmDialog(row: InviteMessageRow) {
  emit("update:sendInviteResponseDialog", { ...props.sendInviteResponseDialog, messageSlot: row });
  sendInviteResponseConfirmDialog.value.visible = true;
}
</script>
