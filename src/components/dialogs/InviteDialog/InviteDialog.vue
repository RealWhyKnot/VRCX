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
            :model-value="inviteDialog.userIds"
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
                <template v-if="pickerUser(item)">
                  <div class="relative inline-block flex-none size-9 mr-2.5" :class="userStatusClass(pickerUser(item))">
                    <img class="size-full rounded-full object-cover" :src="userImage(pickerUser(item))" loading="lazy" />
                  </div>
                  <div class="flex-1 overflow-hidden">
                    <span
                      class="block truncate font-medium leading-[18px] text-[color:var(--user-colour)]"
                      :style="{ '--user-colour': pickerUser(item)?.$userColour }"
                      >{{ pickerUser(item)?.displayName }}</span
                    >
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

<script setup lang="ts">
import Location from "@/components/Location.vue";
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
import { logFailure } from "../../../stores/log-failure";
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
import type { SendInviteDialogState } from "../UserDialog/use-user-dialog-commands";
import type { FriendContext } from "../../../stores/friend-types";
import type { InviteDialogState } from "./invite-dialog-types";

import SendInviteDialog from "./SendInviteDialog.vue";

type FavoriteGroupItem = { key: string; displayName: string; type: "remote" } | { key: string; displayName: string; type: "local"; localName: string };

type FriendSection = { key: string; label: string; friends: FriendContext[] };

const { userImage, userStatusClass } = useUserDisplay();
const friendStore = useFriendStore();
const { vipFriends, onlineFriends, activeFriends, friends } = storeToRefs(friendStore);
const favoriteStore = useFavoriteStore();
const { favoriteFriendGroups, localFriendFavoriteGroups, localFriendFavorites, groupedByGroupKeyFavoriteFriends } = storeToRefs(favoriteStore);
const { refreshInviteMessageTableData } = useInviteStore();
const { currentUser } = storeToRefs(useUserStore());
const { cachedUsers } = useUserStore();
const { clearInviteImageUpload } = useGalleryStore();

const modalStore = useModalStore();

const { t } = useI18n();
const props = defineProps<{
  inviteDialog: InviteDialogState;
}>();

const emit = defineEmits<{
  closeInviteDialog: [];
}>();

const sendInviteDialogVisible = ref(false);
const sendInviteDialog = ref<SendInviteDialogState>({
  messageSlot: {},
  userId: "",
  params: {},
});

const friendSections = computed<FriendSection[]>(() => [
  {
    key: "friendsInInstance",
    label: t("dialog.invite.friends_in_instance"),
    friends: props.inviteDialog.friendsInInstance,
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
  const groups: { key: string; label: string; items: { value: string; label: string; search: string }[] }[] = [];

  groups.push({
    key: "me",
    label: t("side_panel.me"),
    items: [
      {
        value: currentUser.value.id,
        label: currentUser.value.displayName,
        search: currentUser.value.displayName,
      },
    ],
  });

  const addFriendGroup = ({ key, label, friends }: FriendSection) => {
    if (!friends.length) return;
    groups.push({
      key,
      label,
      items: friends.map((friend) => {
        const displayName = resolveUserDisplayName(friend.id);
        return {
          value: friend.id,
          label: displayName,
          search: displayName,
        };
      }),
    });
  };

  friendSections.value.forEach(addFriendGroup);

  return groups;
});

type PickerUser = NonNullable<FriendContext["ref"]>;

const pickerUserById = computed(() => {
  const map = new Map<string, PickerUser>();
  const self = cachedUsers.get(currentUser.value.id);
  if (self) {
    map.set(currentUser.value.id, self);
  }
  for (const section of friendSections.value) {
    for (const friend of section.friends) {
      if (friend.ref) {
        map.set(friend.id, friend.ref);
      }
    }
  }
  return map;
});

function pickerUser(item: { value: string | number }) {
  return pickerUserById.value.get(String(item.value));
}

function setInviteUserIds(value: unknown) {
  const next = Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.length > 0) : [];
  const ids = props.inviteDialog.userIds;
  ids.splice(0, ids.length, ...next);
}

const friendById = computed(() => {
  const map = new Map<string, FriendContext>();
  for (const section of friendSections.value) {
    for (const friend of section.friends) {
      map.set(friend.id, friend);
    }
  }
  return map;
});

function resolveUserDisplayName(userId: string) {
  if (currentUser.value.id && currentUser.value.id === userId) {
    return currentUser.value.displayName;
  }
  const friend = friendById.value.get(userId);
  return friend?.ref?.displayName ?? friend?.name ?? userId;
}

function closeInviteDialog() {
  emit("closeInviteDialog");
}

function showSendInviteDialog() {
  sendInviteDialog.value = {
    params: {},
    userId: "",
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

function hasOnlineFriend(userIds: string[]) {
  for (const id of userIds) {
    const ctx = friends.value.get(id);
    if (ctx?.state === "online") return true;
  }
  return false;
}

const remoteFriendFavoriteGroupItems = computed<FavoriteGroupItem[]>(() =>
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

const localFriendFavoriteGroupItems = computed<FavoriteGroupItem[]>(() =>
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

function addGroupOnlineFriendsToInvite(group: FavoriteGroupItem) {
  const D = props.inviteDialog;
  let userIds: string[];

  if (group.type === "remote") {
    const favorites = groupedByGroupKeyFavoriteFriends.value[group.key] ?? [];
    userIds = favorites.map((fav) => fav.id);
  } else {
    userIds = localFriendFavorites.value[group.localName] ?? [];
  }

  for (const userId of userIds) {
    const ctx = friends.value.get(userId);
    if (ctx?.state === "online" && !D.userIds.includes(userId)) {
      D.userIds.push(userId);
    }
  }
}

function sendInvite() {
  void modalStore
    .confirm({
      description: t("confirm.invite"),
      title: "Confirm",
    })
    .then(({ ok }) => {
      if (!ok) return;
      const D = props.inviteDialog;
      if (D.loading) {
        return;
      }
      D.loading = true;
      const inviteLoop = () => {
        const receiverUserId = D.userIds.shift();
        if (receiverUserId === undefined) {
          D.loading = false;
          D.visible = false;
          toast.success(t("message.invite.sent"));
          return;
        }
        if (receiverUserId === currentUser.value.id) {
          const L = parseLocation(D.worldId);
          void instanceRequest
            .selfInvite({
              instanceId: L.instanceId,
              worldId: L.worldId,
            })
            .finally(inviteLoop)
            .catch(logFailure("Sending the self invite failed:"));
        } else {
          void notificationRequest
            .sendInvite(
              {
                instanceId: D.worldId,
                worldId: D.worldId,
                worldName: D.worldName,
              },
              receiverUserId
            )
            .finally(inviteLoop)
            .catch(logFailure("Sending the invite failed:"));
        }
      };
      inviteLoop();
    })
    .catch(logFailure("Opening the invite confirmation failed:"));
}
</script>
