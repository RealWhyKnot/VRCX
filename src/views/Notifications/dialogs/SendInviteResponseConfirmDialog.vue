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

<script setup>
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
import { notificationRequest } from "../../../api/notification";

const { t } = useI18n();

const galleryStore = useGalleryStore();
const { uploadImage } = storeToRefs(galleryStore);

const props = defineProps({
  sendInviteResponseDialog: {
    type: Object,
    default: () => ({}),
  },
  sendInviteResponseConfirmDialog: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["closeResponseConfirmDialog", "closeInviteDialog"]);

function cancelInviteResponseConfirm() {
  emit("closeResponseConfirmDialog");
}

function sendInviteResponseConfirm() {
  const D = props.sendInviteResponseDialog;
  const params = {
    responseSlot: D.messageSlot.slot,
    rsvp: true,
  };
  if (uploadImage.value) {
    notificationRequest
      .sendInviteResponsePhoto(params, D.invite.id)
      .then((args) => {
        notificationRequest
          .hideNotification({
            notificationId: D.invite.id,
          })
          .then(() => {
            useNotificationStore().handleNotificationHide(D.invite.id);
          });
        toast.success(t("message.invite.response_photo_sent"));
        return args;
      })
      .catch((err) => {
        console.error("Invite response photo failed", err);
        toast.error(t("message.error"));
      })
      .finally(() => {
        emit("closeInviteDialog");
      });
  } else {
    notificationRequest
      .sendInviteResponse(params, D.invite.id)
      .then((args) => {
        notificationRequest
          .hideNotification({
            notificationId: D.invite.id,
          })
          .then(() => {
            useNotificationStore().handleNotificationHide(D.invite.id);
          });
        toast.success(t("message.invite.response_sent"));
        return args;
      })
      .catch((err) => {
        console.error("Invite response failed", err);
        toast.error(t("message.error"));
      })
      .finally(() => {
        emit("closeInviteDialog");
      });
  }
  cancelInviteResponseConfirm();
}
</script>
