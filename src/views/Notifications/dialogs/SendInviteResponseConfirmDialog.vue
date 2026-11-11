<template>
  <Dialog :open="sendInviteResponseConfirmDialog.visible" @update:open="(open) => (open ? null : cancelInviteResponseConfirm())">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ t("dialog.invite_response_message.header") }}</DialogTitle>
      </DialogHeader>
      <div class="text-xs">
        <span>{{ t("dialog.invite_response_message.confirmation") }}</span>
      </div>

      <DialogFooter>
        <Button variant="secondary" class="mr-2" @click="cancelInviteResponseConfirm">{{ t("dialog.invite_response_message.cancel") }}</Button>
        <Button @click="sendInviteResponseConfirm">{{ t("dialog.invite_response_message.confirm") }}</Button>
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
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import { useGalleryStore } from "../../../stores/gallery";
import { useNotificationStore } from "../../../stores/notification";
import { logFailure } from "../../../stores/log-failure";
import { notificationRequest } from "../../../api/notification";
import type { InviteResponseSelection } from "./send-invite-response-columns.tsx";

const { t } = useI18n();

const galleryStore = useGalleryStore();
const { uploadImage } = storeToRefs(galleryStore);

const props = defineProps<{
  sendInviteResponseDialog: InviteResponseSelection;
  sendInviteResponseConfirmDialog: { visible: boolean };
}>();

const emit = defineEmits<{
  closeResponseConfirmDialog: [];
  closeInviteDialog: [];
}>();

function cancelInviteResponseConfirm() {
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
    toast.success(t(isPhoto ? "message.invite.response_photo_sent" : "message.invite.response_sent"));
  } catch (err: unknown) {
    console.error(isPhoto ? "Invite response photo failed" : "Invite response failed", err);
    toast.error(t("message.error"));
  } finally {
    emit("closeInviteDialog");
  }
}

function sendInviteResponseConfirm() {
  const { invite, messageSlot } = props.sendInviteResponseDialog;
  const inviteId = invite.id;
  const slot = messageSlot.slot;
  if (inviteId !== undefined && slot !== undefined) {
    void sendInviteResponse(inviteId, slot).catch(logFailure("Sending invite response failed:"));
  }
  cancelInviteResponseConfirm();
}
</script>
