<template>
  <Dialog
    :open="isSendInviteConfirmDialogVisible"
    @update:open="
      (open) => {
        if (!open) cancelInviteConfirm();
      }
    "
  >
    <DialogContent class="x-dialog sm:max-w-100">
      <DialogHeader>
        <DialogTitle>{{ t(`dialog.${i18nPrefix}.header`) }}</DialogTitle>
      </DialogHeader>

      <div class="text-xs">
        <span>{{ t(`dialog.${i18nPrefix}.confirmation`) }}</span>
      </div>

      <DialogFooter>
        <Button variant="secondary" @click="cancelInviteConfirm">
          {{ t(`dialog.${i18nPrefix}.cancel`) }}
        </Button>
        <Button @click="sendInviteConfirm">
          {{ t("common.actions.confirm") }}
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
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import { instanceRequest } from "../../../api/instance";
import { notificationRequest } from "../../../api/notification";
import { useGalleryStore } from "../../../stores/gallery";
import { logFailure } from "../../../stores/log-failure";
import { useUserStore } from "../../../stores/user";
import { parseLocation } from "../../../shared/utils/location-parser";
import { recordRecentAction } from "../../../composables/use-recent-actions";
import type { SendInviteDialogState } from "../UserDialog/use-user-dialog-commands";
import type { InviteDialogState } from "./invite-dialog-types";

const { t } = useI18n();

const { uploadImage } = storeToRefs(useGalleryStore());
const { clearInviteImageUpload } = useGalleryStore();
const { currentUser } = storeToRefs(useUserStore());

const props = withDefaults(
  defineProps<{
    isSendInviteConfirmDialogVisible: boolean;
    sendInviteDialog: SendInviteDialogState;
    inviteDialog?: Partial<InviteDialogState> | undefined;
  }>(),
  {
    inviteDialog: () => ({}),
  }
);

const emit = defineEmits<{
  "update:isSendInviteConfirmDialogVisible": [value: boolean];
  closeInviteDialog: [];
}>();

const i18nPrefix = computed(() => {
  const messageType = props.sendInviteDialog.messageSlot?.messageType;
  return messageType === "request" ? "invite_request_message" : "invite_message";
});

function cancelInviteConfirm() {
  emit("update:isSendInviteConfirmDialogVisible", false);
}

function dispatchInvite(slot: number) {
  const D = props.sendInviteDialog;
  const J = props.inviteDialog;
  const messageType = D.messageSlot?.messageType;
  if (J.visible) {
    const pendingUserIds = J.userIds ?? [];
    const worldId = J.worldId ?? "";
    const worldName = J.worldName ?? "";
    const inviteLoop = () => {
      const receiverUserId = pendingUserIds.shift();
      if (receiverUserId === undefined) {
        J.loading = false;
        J.visible = false;
        toast.success("Invite message sent");
        return;
      }
      if (receiverUserId === currentUser.value.id) {
        const L = parseLocation(worldId);
        void instanceRequest
          .selfInvite({
            instanceId: L.instanceId,
            worldId: L.worldId,
          })
          .then(() => {
            recordRecentAction(receiverUserId, "Invite");
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
          .then(() => {
            recordRecentAction(receiverUserId, "Invite Photo");
          })
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
          .then(() => {
            recordRecentAction(receiverUserId, "Invite Message");
          })
          .finally(inviteLoop)
          .catch(logFailure("Sending the invite failed:"));
      }
    };
    inviteLoop();
  } else if (messageType === "message") {
    const instanceId = D.params.instanceId;
    if (instanceId === undefined) {
      return;
    }
    D.params.messageSlot = slot;
    if (uploadImage.value) {
      notificationRequest
        .sendInvitePhoto({ ...D.params, instanceId }, D.userId)
        .then(() => {
          recordRecentAction(D.userId, "Invite Photo");
          toast.success("Invite photo message sent");
        })
        .catch((err: unknown) => {
          console.error(err);
        });
    } else {
      notificationRequest
        .sendInvite({ ...D.params, instanceId }, D.userId)
        .then(() => {
          recordRecentAction(D.userId, "Invite Message");
          toast.success("Invite message sent");
        })
        .catch((err: unknown) => {
          console.error(err);
        });
    }
  } else if (messageType === "request") {
    D.params.requestSlot = slot;
    if (uploadImage.value) {
      notificationRequest
        .sendRequestInvitePhoto(D.params, D.userId)
        .then(() => {
          recordRecentAction(D.userId, "Request Invite Photo");
          toast.success("Request invite photo message sent");
        })
        .catch((err: unknown) => {
          clearInviteImageUpload();
          console.error(err);
        });
    } else {
      notificationRequest
        .sendRequestInvite(D.params, D.userId)
        .then(() => {
          recordRecentAction(D.userId, "Request Invite Message");
          toast.success("Request invite message sent");
        })
        .catch((err: unknown) => {
          console.error(err);
        });
    }
  }
}

function sendInviteConfirm() {
  const slot = props.sendInviteDialog.messageSlot?.slot;
  if (slot !== undefined) {
    dispatchInvite(slot);
  }
  cancelInviteConfirm();
  emit("closeInviteDialog");
}
</script>
