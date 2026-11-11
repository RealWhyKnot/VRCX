<template>
  <Dialog
    :open="inviteDialog.visible"
    @update:open="
      (open) => {
        if (!open) closeInviteDialog();
      }
    "
  >
    <DialogContent class="x-dialog sm:max-w-125">
      <DialogHeader>
        <DialogTitle>{{ t("dialog.invite.header") }}</DialogTitle>
      </DialogHeader>

      <div v-if="inviteDialog.visible" class="overflow-hidden">
        <Location :location="inviteDialog.worldId" :link="false" class="cursor-default" />
        <br />
        <Button size="sm" class="mr-2 mt-2" variant="outline" @click="addSelfToInvite">{{ t("dialog.invite.add_self") }}</Button>
        <Button size="sm" class="mr-2 mt-2" variant="outline" :disabled="inviteDialog.friendsInInstance.length === 0" @click="addFriendsInInstanceToInvite">{{
          t("dialog.invite.add_friends_in_instance")
        }}</Button>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button
              class="mt-2"
              size="sm"
              variant="outline"
              :disabled="remoteFriendFavoriteGroupItems.length === 0 && localFriendFavoriteGroupItems.length === 0"
              >{{ t("dialog.invite.add_favorite_friends") }}</Button
            >
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" class="w-48">
            <DropdownMenuItem v-for="group in remoteFriendFavoriteGroupItems" :key="group.key" @select.prevent @click="addGroupOnlineFriendsToInvite(group)">
              {{ group.displayName }}
            </DropdownMenuItem>
            <DropdownMenuSeparator v-if="remoteFriendFavoriteGroupItems.length && localFriendFavoriteGroupItems.length" />
            <DropdownMenuItem v-for="group in localFriendFavoriteGroupItems" :key="group.key" @select.prevent @click="addGroupOnlineFriendsToInvite(group)">
              {{ group.displayName }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div class="mt-4" style="width: 100%">
          <VirtualCombobox
            :model-value="Array.isArray(inviteDialog.userIds) ? inviteDialog.userIds : []"
            :groups="userPickerGroups"
            multiple
            :disabled="inviteDialog.loading"
            :placeholder="t('dialog.invite.select_placeholder')"
            :search-placeholder="t('dialog.invite.select_placeholder')"
            :clearable="true"
            @update:model-value="setInviteUserIds"
          >
            <template #item="{ item, selected }">
              <div class="flex w-full items-center p-1.5 text-[13px]">
                <template v-if="item.user">
                  <div class="relative inline-block flex-none size-9 mr-2.5" :class="userStatusClass(item.user)">
                    <img class="size-full rounded-full object-cover" :src="userImage(item.user)" loading="lazy" />
                  </div>
                  <div class="flex-1 overflow-hidden">
                    <span class="block truncate font-medium leading-[18px]" :style="{ color: item.user.$userColour }">{{ item.user.displayName }}</span>
                  </div>
                </template>
                <template v-else>
                  <span>{{ item.label }}</span>
                </template>

                <CheckIcon :class="['ml-auto size-4', selected ? 'opacity-100' : 'opacity-0']" />
              </div>
            </template>
          </VirtualCombobox>
        </div>
      </div>

      <DialogFooter>
        <Button variant="secondary" class="mr-2" :disabled="inviteDialog.loading || !inviteDialog.userIds.length" @click="showSendInviteDialog">{{
          t("dialog.invite.invite_with_message")
        }}</Button>
        <Button :disabled="inviteDialog.loading || !inviteDialog.userIds.length" @click="sendInvite">{{ t("dialog.invite.invite") }}</Button>
      </DialogFooter>
    </DialogContent>

    <SendInviteDialog
      v-model:send-invite-dialog-visible="sendInviteDialogVisible"
      v-model:send-invite-dialog="sendInviteDialog"
      :invite-dialog="inviteDialog"
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
import { Check as CheckIcon } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import { useFavoriteStore } from "../../../stores/favorite";
import { useFriendStore } from "../../../stores/friend";
import { useGalleryStore } from "../../../stores/gallery";
import { useInviteStore } from "../../../stores/invite";
import { useModalStore } from "../../../stores/modal";
import { useUserStore } from "../../../stores/user";
import { parseLocation } from "../../../shared/utils/location-parser";
import { useUserDisplay } from "../../../composables/use-user-display";
import { instanceRequest } from "../../../api/instance";
import { notificationRequest } from "../../../api/notification";
import VirtualCombobox from "../../ui/virtual-combobox/VirtualCombobox.vue";
import DropdownMenu from "../../ui/dropdown-menu/DropdownMenu.vue";
import DropdownMenuContent from "../../ui/dropdown-menu/DropdownMenuContent.vue";
import DropdownMenuItem from "../../ui/dropdown-menu/DropdownMenuItem.vue";
import DropdownMenuSeparator from "../../ui/dropdown-menu/DropdownMenuSeparator.vue";
import DropdownMenuTrigger from "../../ui/dropdown-menu/DropdownMenuTrigger.vue";

import SendInviteDialog from "./SendInviteDialog.vue";

const { userImage, userStatusClass } = useUserDisplay();
const friendStore = useFriendStore();
const { vipFriends, onlineFriends, activeFriends, friends } = storeToRefs(friendStore);
const favoriteStore = useFavoriteStore();
const { favoriteFriendGroups, localFriendFavoriteGroups, localFriendFavorites, groupedByGroupKeyFavoriteFriends } = storeToRefs(favoriteStore);
const { refreshInviteMessageTableData } = useInviteStore();
const { currentUser } = storeToRefs(useUserStore());
const { clearInviteImageUpload } = useGalleryStore();

const modalStore = useModalStore();

const { t } = useI18n();
const props = defineProps({
  inviteDialog: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["closeInviteDialog"]);

const sendInviteDialogVisible = ref(false);
const sendInviteDialog = ref({
  messageSlot: {},
  userId: "",
  params: {},
});

const friendSections = computed(() => [
  {
    key: "friendsInInstance",
    label: t("dialog.invite.friends_in_instance"),
    friends: props.inviteDialog?.friendsInInstance ?? [],
  },
  {
    key: "vip",
    label: t("side_panel.favorite"),
    friends: vipFriends.value,
  },
  {
    key: "online",
    label: t("side_panel.online"),
    friends: onlineFriends.value,
  },
  {
    key: "active",
    label: t("side_panel.active"),
    friends: activeFriends.value,
  },
]);

const userPickerGroups = computed(() => {
  const groups = [];

  if (currentUser.value) {
    groups.push({
      key: "me",
      label: t("side_panel.me"),
      items: [
        {
          value: String(currentUser.value.id),
          label: currentUser.value.displayName,
          search: currentUser.value.displayName,
          user: currentUser.value,
        },
      ],
    });
  }

  const addFriendGroup = ({ key, label, friends }) => {
    if (!friends?.length) return;
    groups.push({
      key,
      label,
      items: friends.map((friend) => {
        const user = friend?.ref ?? null;
        const displayName = resolveUserDisplayName(friend.id);
        return {
          value: String(friend.id),
          label: displayName,
          search: displayName,
          user,
        };
      }),
    });
  };

  friendSections.value.forEach(addFriendGroup);

  return groups;
});

function setInviteUserIds(value) {
  const next = Array.isArray(value) ? value.map((v) => String(v ?? "")).filter(Boolean) : [];
  const ids = Array.isArray(props.inviteDialog.userIds) ? props.inviteDialog.userIds : [];
  ids.splice(0, ids.length, ...next);
}

const friendById = computed(() => {
  const map = new Map();
  for (const section of friendSections.value) {
    for (const friend of section.friends ?? []) {
      map.set(friend.id, friend);
    }
  }
  return map;
});

function resolveUserDisplayName(userId) {
  if (currentUser.value?.id && currentUser.value.id === userId) {
    return currentUser.value.displayName;
  }
  const friend = friendById.value.get(userId);
  return friend?.ref?.displayName ?? friend?.name ?? String(userId);
}

function closeInviteDialog() {
  emit("closeInviteDialog");
}

function showSendInviteDialog(params, userId) {
  sendInviteDialog.value = {
    params,
    userId,
    messageSlot: {},
  };
  refreshInviteMessageTableData("message");
  clearInviteImageUpload();
  sendInviteDialogVisible.value = true;
}

function addSelfToInvite() {
  const D = props.inviteDialog;
  if (!D.userIds.includes(currentUser.value.id)) {
    D.userIds.push(currentUser.value.id);
  }
}

function addFriendsInInstanceToInvite() {
  const D = props.inviteDialog;
  for (const friend of D.friendsInInstance) {
    if (!D.userIds.includes(friend.id)) {
      D.userIds.push(friend.id);
    }
  }
}

function hasOnlineFriend(userIds) {
  for (const id of userIds) {
    const ctx = friends.value.get(id);
    if (ctx && ctx.state === "online") return true;
  }
  return false;
}

const remoteFriendFavoriteGroupItems = computed(() =>
  favoriteFriendGroups.value
    .filter((group) => {
      const favorites = groupedByGroupKeyFavoriteFriends.value[group.key];
      return favorites?.length && hasOnlineFriend(favorites.map((f) => f.id));
    })
    .map((group) => ({
      key: group.key,
      displayName: group.displayName,
      type: "remote",
    }))
);

const localFriendFavoriteGroupItems = computed(() =>
  localFriendFavoriteGroups.value
    .filter((groupName) => {
      const userIds = localFriendFavorites.value[groupName];
      return userIds?.length && hasOnlineFriend(userIds);
    })
    .map((groupName) => ({
      key: `local:${groupName}`,
      displayName: groupName,
      type: "local",
      localName: groupName,
    }))
);

function addGroupOnlineFriendsToInvite(group) {
  const D = props.inviteDialog;
  let userIds;

  if (group.type === "remote") {
    const favorites = groupedByGroupKeyFavoriteFriends.value[group.key] || [];
    userIds = favorites.map((fav) => fav.id);
  } else {
    userIds = localFriendFavorites.value[group.localName] || [];
  }

  for (const userId of userIds) {
    const ctx = friends.value.get(userId);
    if (ctx && ctx.state === "online" && !D.userIds.includes(userId)) {
      D.userIds.push(userId);
    }
  }
}

function sendInvite() {
  modalStore
    .confirm({
      description: t("confirm.invite"),
      title: "Confirm",
    })
    .then(({ ok }) => {
      if (!ok) return;
      const D = props.inviteDialog;
      if (D.loading === true) {
        return;
      }
      D.loading = true;
      const inviteLoop = () => {
        if (D.userIds.length > 0) {
          const receiverUserId = D.userIds.shift();
          if (receiverUserId === currentUser.value.id) {
            const L = parseLocation(D.worldId);
            instanceRequest
              .selfInvite({
                instanceId: L.instanceId,
                worldId: L.worldId,
              })
              .finally(inviteLoop);
          } else {
            notificationRequest
              .sendInvite(
                {
                  instanceId: D.worldId,
                  worldId: D.worldId,
                  worldName: D.worldName,
                },
                receiverUserId
              )
              .finally(inviteLoop);
          }
        } else {
          D.loading = false;
          D.visible = false;
          toast.success(t("message.invite.sent"));
        }
      };
      inviteLoop();
    });
}
</script>

}) .catch(() => {});
