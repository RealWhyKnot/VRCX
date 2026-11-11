<template>
  <Dialog :open="sendInviteRequestResponseDialogVisible" @update:open="(open) => (open ? null : cancelSendInviteRequestResponse())">
    <DialogContent class="x-dialog sm:max-w-200">
      <DialogHeader>
        <DialogTitle>{{ t("dialog.invite_request_response_message.header") }}</DialogTitle>
      </DialogHeader>
      <template v-if="isLocalUserVrcPlusSupporter">
        <input class="inviteImageUploadButton" type="file" accept="image/*" @change="inviteImageUpload" />
      </template>

      <DataTableLayout
        class="mt-2"
        :table="inviteRequestResponseTable"
        :loading="false"
        :show-pagination="false"
        :on-row-click="handleInviteRequestResponseRowClick"
      />

      <DialogFooter>
        <Button variant="secondary" class="mr-2" @click="cancelSendInviteRequestResponse">
          {{ t("dialog.invite_request_response_message.cancel") }}
        </Button>
        <Button @click="refreshInviteMessageTableData('requestResponse')">
          {{ t("dialog.invite_request_response_message.refresh") }}
        </Button>
      </DialogFooter>
      <EditAndSendInviteResponseDialog
        v-model:edit-and-send-invite-response-dialog="editAndSendInviteResponseDialog"
        :send-invite-response-dialog="sendInviteResponseDialog"
        @close-invite-dialog="closeInviteDialog"
        @close-response-confirm-dialog="closeResponseConfirmDialog"
      />
      <SendInviteResponseConfirmDialog
        :send-invite-response-dialog="sendInviteResponseDialog"
        :send-invite-response-confirm-dialog="sendInviteResponseConfirmDialog"
        @close-invite-dialog="closeInviteDialog"
        @close-response-confirm-dialog="closeResponseConfirmDialog"
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
import { createColumns } from "./send-invite-request-response-columns.tsx";
import type { InviteMessageRow, InviteResponseSelection } from "./send-invite-request-response-columns.tsx";

import EditAndSendInviteResponseDialog from "./EditAndSendInviteResponseDialog.vue";
import SendInviteResponseConfirmDialog from "./SendInviteResponseConfirmDialog.vue";

const { t } = useI18n();
const inviteStore = useInviteStore();
const { refreshInviteMessageTableData } = inviteStore;
const { inviteRequestResponseMessageTable } = storeToRefs(inviteStore);
const galleryStore = useGalleryStore();
const { inviteImageUpload } = galleryStore;
const { isLocalUserVrcPlusSupporter } = storeToRefs(useUserStore());

const props = defineProps<{
  sendInviteResponseDialog: InviteResponseSelection;
  sendInviteRequestResponseDialogVisible: boolean;
}>();

const emit = defineEmits<{
  "update:sendInviteRequestResponseDialogVisible": [value: boolean];
  "update:sendInviteResponseDialog": [value: InviteResponseSelection];
}>();

const editAndSendInviteResponseDialog = ref({
  visible: false,
  newMessage: "",
});

const sendInviteResponseConfirmDialog = ref({
  visible: false,
});

const inviteRequestResponseRows = computed(() => inviteRequestResponseMessageTable.value.data);
const inviteRequestResponseColumns = computed(() =>
  createColumns({
    onEdit: showEditAndSendInviteResponseDialog,
  })
);

const { table: inviteRequestResponseTable } = useVrcxVueTable({
  persistKey: "invite-request-response-message",
  get data() {
    return inviteRequestResponseRows.value;
  },
  columns: inviteRequestResponseColumns,
  getRowId: (row) => String(row.slot),
  enablePagination: false,
  initialSorting: [{ id: "slot", desc: false }],
});

function handleInviteRequestResponseRowClick(row: { original: InviteMessageRow }) {
  showSendInviteResponseConfirmDialog(row.original);
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

function closeInviteDialog() {
  cancelSendInviteRequestResponse();
}

function closeResponseConfirmDialog() {
  sendInviteResponseConfirmDialog.value.visible = false;
  editAndSendInviteResponseDialog.value.visible = false;
}

function cancelSendInviteRequestResponse() {
  emit("update:sendInviteRequestResponseDialogVisible", false);
}
</script>
