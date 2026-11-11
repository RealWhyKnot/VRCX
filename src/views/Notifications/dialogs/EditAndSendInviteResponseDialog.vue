<template>
  <Dialog :open="editState.visible" @update:open="(open) => (open ? null : cancelEditAndSendInviteResponse())">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ t("dialog.edit_send_invite_response_message.header") }}</DialogTitle>
      </DialogHeader>
      <div class="text-xs">
        <span>{{ t("dialog.edit_send_invite_response_message.description") }}</span>
      </div>
      <InputGroupTextareaField v-model="editState.newMessage" :maxlength="64" :rows="2" class="mt-2.5" placeholder="" show-count />
      <DialogFooter>
        <Button variant="secondary" class="mr-2" @click="cancelEditAndSendInviteResponse">{{ t("dialog.edit_send_invite_response_message.cancel") }}</Button>
        <Button :disabled="!editState.newMessage" @click="saveEditAndSendInviteResponse">{{ t("dialog.edit_send_invite_response_message.send") }}</Button>
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
import Button from "@/components/ui/button/Button.vue";
import InputGroupTextareaField from "@/components/ui/input-group/InputGroupTextareaField.vue";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import { inviteMessagesRequest } from "../../../api/invite-messages";
import { notificationRequest } from "../../../api/notification";
import { useGalleryStore } from "../../../stores/gallery";
import { useNotificationStore } from "../../../stores/notification";
import { logFailure } from "../../../stores/log-failure";
import type { InviteResponseSelection } from "./send-invite-response-columns.tsx";

const { t } = useI18n();
const galleryStore = useGalleryStore();
const { uploadImage } = storeToRefs(galleryStore);

const props = defineProps<{
  sendInviteResponseDialog: InviteResponseSelection;
}>();

const editState = defineModel<{ visible: boolean; newMessage: string }>("editAndSendInviteResponseDialog", { required: true });

const emit = defineEmits<{
  closeInviteDialog: [];
  closeResponseConfirmDialog: [];
}>();

function cancelEditAndSendInviteResponse() {
  emit("closeResponseConfirmDialog");
}

async function sendInviteResponse(inviteId: string, slot: number) {
  const params = {
    responseSlot: slot,
    rsvp: true,
  };
  const isPhoto = uploadImage.value;
  try {
    if (isPhoto) {
      await notificationRequest.sendInviteResponsePhoto(params, inviteId);
    } else {
      await notificationRequest.sendInviteResponse(params, inviteId);
    }
    void notificationRequest
      .hideNotification({
        notificationId: inviteId,
      })
      .then(() => {
        useNotificationStore().handleNotificationHide(inviteId);
      })
      .catch(logFailure("Hiding invite notification failed:"));
    toast.success(t("message.invite.response_sent"));
  } catch (err: unknown) {
    console.error(isPhoto ? "Invite response photo failed" : "Invite response failed", err);
    toast.error(t("message.error"));
  } finally {
    emit("closeInviteDialog");
  }
}

async function saveEditAndSendInviteResponse() {
  editState.value.visible = false;
  const { invite, messageSlot } = props.sendInviteResponseDialog;
  const inviteId = invite.id;
  const { messageType, slot, message: originalMessage } = messageSlot;
  const newMessage = editState.value.newMessage;
  if (inviteId === undefined || messageType === undefined || slot === undefined) {
    return;
  }
  if (originalMessage !== newMessage) {
    const args = await inviteMessagesRequest.editInviteMessage({ message: newMessage }, messageType, slot).catch((err: unknown) => {
      console.error("Invite response message update failed", err);
      toast.error(t("message.error"));
      return undefined;
    });
    if (args === undefined) {
      return;
    }
    const updated = args.json[slot];
    if (updated === undefined) {
      toast.error(t("message.invite.message_update_failed"));
      return;
    }
    const { message: savedMessage } = updated;
    if (savedMessage === originalMessage) {
      toast.error(t("message.invite.message_update_failed"));
      return;
    }
    toast(t("message.invite.message_updated"));
  }
  await sendInviteResponse(inviteId, slot);
}
</script>
