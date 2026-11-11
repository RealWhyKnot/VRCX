<template>
  <Dialog :open="isEditInviteMessageDialogVisible" @update:open="(open) => !open && closeDialog()">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>{{ t("dialog.edit_invite_message.header") }}</DialogTitle>
      </DialogHeader>
      <div class="text-xs">
        <span>{{ t("dialog.edit_invite_message.description") }}</span>
        <InputGroupTextareaField v-model="message" :maxlength="64" :rows="2" class="mt-2.5" placeholder="" show-count />
      </div>
      <DialogFooter>
        <Button variant="secondary" class="mr-2" @click="closeDialog">{{ t("dialog.edit_invite_message.cancel") }}</Button>
        <Button @click="saveEditInviteMessage">{{ t("dialog.edit_invite_message.save") }}</Button>
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
import { ref, watch } from "vue";
import Button from "@/components/ui/button/Button.vue";
import InputGroupTextareaField from "@/components/ui/input-group/InputGroupTextareaField.vue";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import { inviteMessagesRequest } from "../../../api/invite-messages";
import { logError } from "../../../stores/vrcx-messages";
import type { InviteMessage, InviteMessageType } from "vrchat";
import type { Json } from "../../../types/vrcx";

const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    isEditInviteMessageDialogVisible?: boolean | undefined;
    inviteMessage: Partial<Json<InviteMessage>>;
  }>(),
  {
    isEditInviteMessageDialogVisible: false,
  }
);

const emit = defineEmits<{
  "update:isEditInviteMessageDialogVisible": [value: boolean];
  updateInviteMessages: [messageType: InviteMessageType];
}>();

const message = ref("");

watch(
  () => props.inviteMessage,
  (inviteMessage) => {
    message.value = inviteMessage.message ?? "";
  },
  { deep: true }
);

function saveEditInviteMessage() {
  closeDialog();
  const { message: originalMessage, slot, messageType } = props.inviteMessage;
  if (originalMessage !== message.value && slot !== undefined && messageType !== undefined) {
    const params = {
      message: message.value,
    };
    void inviteMessagesRequest
      .editInviteMessage(params, messageType, slot)
      .then((args) => {
        const updatedMessage = args.json[slot];
        if (updatedMessage === undefined) {
          throw new TypeError(`No invite message in slot ${slot}`);
        }
        const { message: savedMessage } = updatedMessage;
        if (savedMessage === originalMessage) {
          const errorMessage = t("message.invite.message_update_failed");
          toast.error(errorMessage);
          throw new Error(errorMessage);
        } else {
          toast.success("Invite message updated");
          emit("updateInviteMessages", messageType);
        }
        return args;
      })
      .catch(logError);
  }
}

function closeDialog() {
  emit("update:isEditInviteMessageDialogVisible", false);
}
</script>
