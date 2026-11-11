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

<script setup>
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

import instanceRequest from "../../../api/instance";
import notificationRequest from "../../../api/notification";
import { useGalleryStore } from "../../../stores/gallery";
import { useUserStore } from "../../../stores/user";
import { parseLocation } from "../../../shared/utils/location-parser";
import { recordRecentAction } from "../../../composables/use-recent-actions";

const { t } = useI18n();

const { uploadImage } = storeToRefs(useGalleryStore());
const { clearInviteImageUpload } = useGalleryStore();
const { currentUser } = storeToRefs(useUserStore());

const props = defineProps({
  isSendInviteConfirmDialogVisible: {
    type: Boolean,
    required: true,
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

const emit = defineEmits(["update:isSendInviteConfirmDialogVisible", "closeInviteDialog"]);

const i18nPrefix = computed(() => {
  const messageType = props.sendInviteDialog?.messageSlot?.messageType;
  return messageType === "request" ? "invite_request_message" : "invite_message";
});

function cancelInviteConfirm() {
  emit("update:isSendInviteConfirmDialogVisible", false);
}

function sendInviteConfirm() {
  const D = props.sendInviteDialog;
  const J = props.inviteDialog;
  const messageType = D.messageSlot.messageType;
  const slot = D.messageSlot.slot;
  if (J?.visible) {
    const inviteLoop = () => {
      if (J.userIds.length > 0) {
        const receiverUserId = J.userIds.shift();
        if (receiverUserId === currentUser.value.id) {
          const L = parseLocation(J.worldId);
          instanceRequest
            .selfInvite({
              instanceId: L.instanceId,
              worldId: L.worldId,
            })
            .then(() => {
              recordRecentAction(receiverUserId, "Invite");
            })
            .finally(inviteLoop);
        } else if (uploadImage.value) {
          notificationRequest
            .sendInvitePhoto(
              {
                instanceId: J.worldId,
                worldId: J.worldId,
                worldName: J.worldName,
                messageSlot: slot,
              },
              receiverUserId
            )
            .then(() => {
              recordRecentAction(receiverUserId, "Invite Photo");
            })
            .finally(inviteLoop);
        } else {
          notificationRequest
            .sendInvite(
              {
                instanceId: J.worldId,
                worldId: J.worldId,
                worldName: J.worldName,
                messageSlot: slot,
              },
              receiverUserId
            )
            .then(() => {
              recordRecentAction(receiverUserId, "Invite Message");
            })
            .finally(inviteLoop);
        }
      } else {
        J.loading = false;
        J.visible = false;
        toast.success("Invite message sent");
      }
    };
    inviteLoop();
  } else if (messageType === "message") {
    D.params.messageSlot = slot;
    if (uploadImage.value) {
      notificationRequest
        .sendInvitePhoto(D.params, D.userId)
        .then((args) => {
          recordRecentAction(D.userId, "Invite Photo");
          toast.success("Invite photo message sent");
          return args;
        })
        .catch((err) => {
          console.error(err);
        });
    } else {
      notificationRequest
        .sendInvite(D.params, D.userId)
        .then((args) => {
          recordRecentAction(D.userId, "Invite Message");
          toast.success("Invite message sent");
          return args;
        })
        .catch((err) => {
          console.error(err);
        });
    }
  } else if (messageType === "request") {
    D.params.requestSlot = slot;
    if (uploadImage.value) {
      notificationRequest
        .sendRequestInvitePhoto(D.params, D.userId)
        .then((args) => {
          recordRecentAction(D.userId, "Request Invite Photo");
          toast.success("Request invite photo message sent");
          return args;
        })
        .catch((err) => {
          clearInviteImageUpload();
          console.error(err);
        });
    } else {
      notificationRequest
        .sendRequestInvite(D.params, D.userId)
        .then((args) => {
          recordRecentAction(D.userId, "Request Invite Message");
          toast.success("Request invite message sent");
          return args;
        })
        .catch((err) => {
          console.error(err);
        });
    }
  }
  cancelInviteConfirm();
  emit("closeInviteDialog");
}
</script>
