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

<script setup>
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { computed, ref } from "vue";
import { Button } from "@/components/ui/button";
import { DataTableLayout } from "@/components/ui/data-table";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { useVrcxVueTable } from "@/lib/table/useVrcxVueTable";

import { useGalleryStore, useInviteStore, useUserStore } from "../../../stores";
import { createColumns } from "./sendInviteColumns.jsx";

import EditAndSendInviteDialog from "./EditAndSendInviteDialog.vue";
import SendInviteConfirmDialog from "./SendInviteConfirmDialog.vue";

const { t } = useI18n();

const { refreshInviteMessageTableData } = useInviteStore();
const { inviteMessageTable } = storeToRefs(useInviteStore());
const { inviteImageUpload } = useGalleryStore();
const { isLocalUserVrcPlusSupporter } = storeToRefs(useUserStore());

const props = defineProps({
  sendInviteDialogVisible: {
    type: Boolean,
    default: false,
  },
  sendInviteDialog: {
    type: Object,
    required: true,
  },
  inviteDialog: {
    type: Object,
    required: false,
    default: () => ({}),
  },
});

const emit = defineEmits(["closeInviteDialog", "update:sendInviteDialogVisible", "update:sendInviteDialog"]);

const isSendInviteConfirmDialogVisible = ref(false);

const editAndSendInviteDialog = ref({
  visible: false,
  newMessage: "",
});

const inviteMessageRows = computed(() => inviteMessageTable.value?.data ?? []);
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
  getRowId: (row) => String(row?.slot ?? ""),
  enablePagination: false,
  initialSorting: [{ id: "slot", desc: false }],
});

function handleInviteMessageRowClick(row) {
  showSendInviteConfirmDialog(row?.original);
}

function showSendInviteConfirmDialog(row) {
  emit("update:sendInviteDialog", { ...props.sendInviteDialog, messageSlot: row });
  isSendInviteConfirmDialogVisible.value = true;
}

function showEditAndSendInviteDialog(row) {
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
