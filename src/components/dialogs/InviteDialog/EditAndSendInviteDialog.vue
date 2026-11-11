<template>
  <Dialog
    :open="editAndSendInviteDialog.visible"
    @update:open="
      (open) => {
        if (!open) cancelEditAndSendInvite();
      }
    "
  >
    <DialogContent class="x-dialog sm:max-w-100">
      <DialogHeader>
        <DialogTitle>{{ t("dialog.edit_send_invite_message.header") }}</DialogTitle>
      </DialogHeader>

      <div class="text-xs">
        <span>{{ t("dialog.edit_send_invite_message.description") }}</span>
      </div>

      <InputGroupTextareaField
        :model-value="editAndSendInviteDialog.newMessage"
        :maxlength="64"
        :rows="2"
        class="mt-2.5"
        placeholder=""
        show-count
        @update:model-value="setNewMessage"
      />

      <DialogFooter>
        <Button variant="secondary" class="mr-2" @click="cancelEditAndSendInvite">
          {{ t("dialog.edit_send_invite_message.cancel") }}
        </Button>
        <Button :disabled="!editAndSendInviteDialog.newMessage" @click="saveEditAndSendInvite">
          {{ t("dialog.edit_send_invite_message.send") }}
        </Button>
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

import { instanceRequest } from "../../../api/instance";
import { inviteMessagesRequest } from "../../../api/invite-messages";
import { notificationRequest } from "../../../api/notification";
import { useGalleryStore } from "../../../stores/gallery";
import { logFailure } from "../../../stores/log-failure";
import { useUserStore } from "../../../stores/user";
import { parseLocation } from "../../../shared/utils/location-parser";
import type { SendInviteDialogState } from "../UserDialog/use-user-dialog-commands";
import type { EditAndSendInviteDialogState, InviteDialogState } from "./invite-dialog-types";

const { t } = useI18n();
const { uploadImage } = storeToRefs(useGalleryStore());
const { clearInviteImageUpload } = useGalleryStore();
const { currentUser } = storeToRefs(useUserStore());

const props = withDefaults(
  defineProps<{
    editAndSendInviteDialog: EditAndSendInviteDialogState;
    sendInviteDialog: SendInviteDialogState;
    inviteDialog?: Partial<InviteDialogState> | undefined;
  }>(),
  {
    inviteDialog: () => ({}),
  }
);

const emit = defineEmits<{
  "update:editAndSendInviteDialog": [value: EditAndSendInviteDialogState];
  closeInviteDialog: [];
}>();

function cancelEditAndSendInvite() {
  emit("update:editAndSendInviteDialog", { ...props.editAndSendInviteDialog, visible: false });
}

function setNewMessage(value: string) {
  emit("update:editAndSendInviteDialog", { ...props.editAndSendInviteDialog, newMessage: value });
}

async function saveEditAndSendInvite() {
  const D = props.editAndSendInviteDialog;
  const I = props.sendInviteDialog;
  D.visible = false;
  const messageType = I.messageSlot?.messageType;
  const slot = I.messageSlot?.slot;
  if (messageType === undefined || slot === undefined) {
    return;
  }
  const currentMessage = I.messageSlot?.message;
  if (currentMessage !== D.newMessage) {
    const updated = await inviteMessagesRequest.editInviteMessage({ message: D.newMessage }, messageType, slot).catch((err: unknown) => {
      console.error("Invite message update failed", err);
      return undefined;
    });
    if (!updated) {
      return;
    }
    const updatedMessage = updated.json[slot]?.message;
    if (updatedMessage === undefined || updatedMessage === currentMessage) {
      toast.error(t("message.invite.message_update_failed"));
      return;
    }
    toast("Invite message updated");
  }
  const J = props.inviteDialog;
  const worldId = J.worldId ?? "";
  const worldName = J.worldName ?? "";
  const instanceId = I.params.instanceId;
  if (J.visible) {
    const pendingUserIds = J.userIds ?? [];
    const inviteLoop = () => {
      const receiverUserId = pendingUserIds.shift();
      if (receiverUserId === undefined) {
        J.loading = false;
        J.visible = false;
        toast.success(t("message.invite.sent"));
        return;
      }
      if (receiverUserId === currentUser.value.id) {
        const L = parseLocation(worldId);
        void instanceRequest
          .selfInvite({
            instanceId: L.instanceId,
            worldId: L.worldId,
          })
          .finally(inviteLoop)
          .catch(logFailure("Sending the self invite failed:"));
      } else if (uploadImage.value) {
        void notificationRequest
          .sendInvitePhoto(
            {
              instanceId: worldId,
              worldId,
              worldName,
              messageSlot: slot,
            },
            receiverUserId
          )
          .finally(inviteLoop)
          .catch(logFailure("Sending the invite photo failed:"));
      } else {
        void notificationRequest
          .sendInvite(
            {
              instanceId: worldId,
              worldId,
              worldName,
              messageSlot: slot,
            },
            receiverUserId
          )
          .finally(inviteLoop)
          .catch(logFailure("Sending the invite failed:"));
      }
    };
    inviteLoop();
  } else if (messageType === "message" && instanceId !== undefined) {
    I.params.messageSlot = slot;
    if (uploadImage.value) {
      notificationRequest
        .sendInvitePhoto({ ...I.params, instanceId }, I.userId)
        .then(() => {
          toast.success("Invite photo message sent");
        })
        .catch((err: unknown) => {
          console.error(err);
        });
    } else {
      notificationRequest
        .sendInvite({ ...I.params, instanceId }, I.userId)
        .then(() => {
          toast.success("Invite message sent");
        })
        .catch((err: unknown) => {
          console.error(err);
        });
    }
  } else if (messageType === "request") {
    I.params.requestSlot = slot;
    if (uploadImage.value) {
      notificationRequest
        .sendRequestInvitePhoto(I.params, I.userId)
        .then(() => {
          toast.success("Request invite photo message sent");
        })
        .catch((err: unknown) => {
          clearInviteImageUpload();
          console.error(err);
        });
    } else {
      notificationRequest
        .sendRequestInvite(I.params, I.userId)
        .then(() => {
          toast.success("Request invite message sent");
        })
        .catch((err: unknown) => {
          console.error(err);
        });
    }
  }

  emit("closeInviteDialog");
}
</script>
