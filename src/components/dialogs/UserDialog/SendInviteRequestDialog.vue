<template>
  <Dialog
    :open="sendInviteRequestDialogVisible"
    @update:open="
      (open) => {
        if (!open) cancelSendInviteRequest();
      }
    "
  >
    <DialogContent class="x-dialog sm:max-w-200">
      <DialogHeader>
        <DialogTitle>{{ t("dialog.invite_request_message.header") }}</DialogTitle>
      </DialogHeader>

      <template v-if="isLocalUserVrcPlusSupporter">
        <input class="inviteImageUploadButton" type="file" accept="image/*" @change="inviteImageUpload" />
      </template>

      <DataTableLayout
        style="margin-top: 8px"
        :table="inviteRequestMessageTanstackTable"
        :loading="false"
        :show-pagination="false"
        :on-row-click="handleInviteRequestMessageRowClick"
      />

      <DialogFooter>
        <Button variant="secondary" class="mr-2" @click="cancelSendInviteRequest">{{ t("dialog.invite_request_message.cancel") }}</Button>
        <Button @click="refreshInviteMessageTableData('request')">{{ t("dialog.invite_request_message.refresh") }}</Button>
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
import { createColumns } from "./send-invite-request-columns.jsx";

import EditAndSendInviteDialog from "../InviteDialog/EditAndSendInviteDialog.vue";
import SendInviteConfirmDialog from "../InviteDialog/SendInviteConfirmDialog.vue";

const { t } = useI18n();

const inviteStore = useInviteStore();
const { refreshInviteMessageTableData } = inviteStore;
const { inviteRequestMessageTable } = storeToRefs(inviteStore);
const galleryStore = useGalleryStore();
const { inviteImageUpload } = galleryStore;
const { isLocalUserVrcPlusSupporter } = storeToRefs(useUserStore());

const props = defineProps({
  sendInviteRequestDialogVisible: {
    type: Boolean,
    default: false,
  },
  sendInviteDialog: {
    type: Object,
    default: () => ({}),
  },
  inviteDialog: {
    type: Object,
    require: false,
    default: () => ({}),
  },
});

const emit = defineEmits(["update:sendInviteRequestDialogVisible", "closeInviteDialog", "update:sendInviteDialog"]);

const isSendInviteConfirmDialogVisible = ref(false);

const editAndSendInviteDialog = ref({
  visible: false,
  newMessage: "",
});

const inviteRequestMessageRows = computed(() => inviteRequestMessageTable.value?.data ?? []);
const inviteRequestMessageColumns = computed(() =>
  createColumns({
    onEdit: showEditAndSendInviteDialog,
  })
);

const { table: inviteRequestMessageTanstackTable } = useVrcxVueTable({
  persistKey: "invite-request-message",
  get data() {
    return inviteRequestMessageRows.value;
  },
  columns: inviteRequestMessageColumns,
  getRowId: (row) => String(row?.slot ?? ""),
  enablePagination: false,
  initialSorting: [{ id: "slot", desc: false }],
});

function handleInviteRequestMessageRowClick(row) {
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
function cancelSendInviteRequest() {
  emit("update:sendInviteRequestDialogVisible", false);
}

function closeInviteDialog() {
  cancelSendInviteRequest();
}
</script>
