<template>
  <Dialog :open="isEditInviteMessagesDialogVisible" @update:open="(open) => !open && closeDialog()">
    <DialogContent class="sm:max-w-5xl">
      <DialogHeader>
        <DialogTitle>{{ t("dialog.edit_invite_messages.header") }}</DialogTitle>
      </DialogHeader>
      <TabsUnderline v-model="activeTab" :items="editInviteTabs" :unmount-on-hide="false" class="mt-2.5">
        <template #message>
          <DataTableLayout
            class="mt-2"
            style="cursor: pointer"
            :table="inviteMessageTanstackTable"
            :loading="false"
            :show-pagination="false"
            :on-row-click="handleEditInviteMessageRowClick"
          />
        </template>
        <template #request>
          <DataTableLayout
            style="margin-top: 8px; cursor: pointer"
            :table="inviteRequestTanstackTable"
            :loading="false"
            :show-pagination="false"
            :on-row-click="handleEditInviteMessageRowClick"
          />
        </template>
        <template #requestResponse>
          <DataTableLayout
            style="margin-top: 8px; cursor: pointer"
            :table="inviteRequestResponseTanstackTable"
            :loading="false"
            :show-pagination="false"
            :on-row-click="handleEditInviteMessageRowClick"
          />
        </template>
        <template #response>
          <DataTableLayout
            style="margin-top: 8px; cursor: pointer"
            :table="inviteResponseTanstackTable"
            :loading="false"
            :show-pagination="false"
            :on-row-click="handleEditInviteMessageRowClick"
          />
        </template>
      </TabsUnderline>
    </DialogContent>
  </Dialog>
  <template v-if="isEditInviteMessagesDialogVisible">
    <EditInviteMessageDialog
      v-model:is-edit-invite-message-dialog-visible="isEditInviteMessageDialogVisible"
      :invite-message="inviteMessage"
      @close="isEditInviteMessageDialogVisible = false"
      @update-invite-messages="refreshInviteMessageTableData"
    />
  </template>
</template>

<script setup lang="ts">
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import { computed, ref, watch } from "vue";
import DataTableLayout from "@/components/ui/data-table/DataTableLayout.vue";
import TabsUnderline from "@/components/ui/tabs/TabsUnderline.vue";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import { useVrcxVueTable } from "@/lib/table/use-vrcx-vue-table";
import type { InviteMessage } from "vrchat";
import type { Json } from "../../../types/vrcx";

import { columns as inviteMessageColumns } from "./edit-invite-messages-message-columns.tsx";
import { columns as inviteRequestColumns } from "./edit-invite-messages-request-columns.tsx";
import { columns as inviteRequestResponseColumns } from "./edit-invite-messages-request-response-columns.tsx";
import { columns as inviteResponseColumns } from "./edit-invite-messages-response-columns.tsx";
import { useInviteStore } from "../../../stores/invite";

import EditInviteMessageDialog from "./EditInviteMessageDialog.vue";

const { inviteMessageTable, inviteRequestMessageTable, inviteRequestResponseMessageTable, inviteResponseMessageTable } = storeToRefs(useInviteStore());
const { refreshInviteMessageTableData } = useInviteStore();

const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    isEditInviteMessagesDialogVisible?: boolean | undefined;
  }>(),
  {
    isEditInviteMessagesDialogVisible: false,
  }
);

const activeTab = ref("message");
const editInviteTabs = computed(() => [
  { value: "message", label: t("dialog.edit_invite_messages.invite_message_tab") },
  { value: "request", label: t("dialog.edit_invite_messages.invite_request_tab") },
  { value: "requestResponse", label: t("dialog.edit_invite_messages.invite_request_response_tab") },
  { value: "response", label: t("dialog.edit_invite_messages.invite_response_tab") },
]);

const isEditInviteMessageDialogVisible = ref(false);
const inviteMessage = ref<Partial<Json<InviteMessage>>>({});

watch(
  () => props.isEditInviteMessagesDialogVisible,
  (isVisible) => {
    if (isVisible) {
      refreshInviteMessageTableData("message");
      refreshInviteMessageTableData("request");
      refreshInviteMessageTableData("requestResponse");
      refreshInviteMessageTableData("response");
    }
  }
);

const emit = defineEmits<{
  close: [];
}>();

function closeDialog() {
  emit("close");
}

const inviteMessageRows = computed(() => inviteMessageTable.value.data);
const inviteRequestRows = computed(() => inviteRequestMessageTable.value.data);
const inviteRequestResponseRows = computed(() => inviteRequestResponseMessageTable.value.data);
const inviteResponseRows = computed(() => inviteResponseMessageTable.value.data);

const { table: inviteMessageTanstackTable } = useVrcxVueTable({
  persistKey: "edit-invite-messages:message",
  get data() {
    return inviteMessageRows.value;
  },
  columns: inviteMessageColumns,
  getRowId: (row) => String(row.slot),
  enablePagination: false,
  initialSorting: [{ id: "slot", desc: false }],
});

const { table: inviteRequestTanstackTable } = useVrcxVueTable({
  persistKey: "edit-invite-messages:request",
  get data() {
    return inviteRequestRows.value;
  },
  columns: inviteRequestColumns,
  getRowId: (row) => String(row.slot),
  enablePagination: false,
  initialSorting: [{ id: "slot", desc: false }],
});

const { table: inviteRequestResponseTanstackTable } = useVrcxVueTable({
  persistKey: "edit-invite-messages:request-response",
  get data() {
    return inviteRequestResponseRows.value;
  },
  columns: inviteRequestResponseColumns,
  getRowId: (row) => String(row.slot),
  enablePagination: false,
  initialSorting: [{ id: "slot", desc: false }],
});

const { table: inviteResponseTanstackTable } = useVrcxVueTable({
  persistKey: "edit-invite-messages:response",
  get data() {
    return inviteResponseRows.value;
  },
  columns: inviteResponseColumns,
  getRowId: (row) => String(row.slot),
  enablePagination: false,
  initialSorting: [{ id: "slot", desc: false }],
});

function handleEditInviteMessageRowClick(row: { original: Json<InviteMessage> }) {
  showEditInviteMessageDialog(row.original);
}

function showEditInviteMessageDialog(row: Json<InviteMessage>) {
  if (row.updatedAt) {
    const cooldownEnd = new Date(row.updatedAt);
    cooldownEnd.setHours(cooldownEnd.getHours() + 1);
    const now = new Date();
    if (now < cooldownEnd) {
      toast.warning("This invite message is on cooldown and cannot be edited yet.");
      return;
    }
  }
  inviteMessage.value = row;
  isEditInviteMessageDialogVisible.value = true;
}
</script>
