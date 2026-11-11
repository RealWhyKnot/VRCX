<template>
  <Dialog v-model:open="inviteGroupDialog.visible">
    <DialogContent class="sm:max-w-112.5">
      <DialogHeader>
        <DialogTitle>{{ t("dialog.invite_to_group.header") }}</DialogTitle>
      </DialogHeader>

      <div v-if="inviteGroupDialog.visible">
        <span>{{ t("dialog.invite_to_group.description") }}</span>
        <br />

        <div class="mt-4" style="width: 100%">
          <VirtualCombobox
            v-model="inviteGroupDialog.groupId"
            :groups="groupPickerGroups"
            :disabled="inviteGroupDialog.loading"
            :placeholder="t('dialog.invite_to_group.choose_group_placeholder')"
            :search-placeholder="t('dialog.invite_to_group.choose_group_placeholder')"
            :clearable="true"
            :close-on-select="true"
            :deselect-on-reselect="true"
          >
            <template #item="{ item, selected }">
              <div class="flex w-full items-center p-1.5 text-[13px]">
                <div class="relative inline-block flex-none size-9 mr-2.5">
                  <img class="size-full rounded-full object-cover" :src="groupIconUrl(item)" loading="lazy" />
                </div>
                <div class="flex-1 overflow-hidden">
                  <span class="block truncate font-medium leading-[18px]" v-text="item.label"></span>
                </div>
                <CheckIcon :class="['ml-auto size-4', selected ? 'opacity-100' : 'opacity-0']" />
              </div>
            </template>
          </VirtualCombobox>
        </div>

        <div style="width: 100%; margin-top: 16px">
          <VirtualCombobox
            v-model="inviteGroupDialog.userIds"
            :groups="friendPickerGroups"
            multiple
            :disabled="inviteGroupDialog.loading"
            :placeholder="t('dialog.invite_to_group.choose_friends_placeholder')"
            :search-placeholder="t('dialog.invite_to_group.choose_friends_placeholder')"
            :clearable="true"
          >
            <template #item="{ item, selected }">
              <div class="flex w-full items-center p-1.5 text-[13px]">
                <template v-if="friendUser(item)">
                  <div class="relative inline-block flex-none size-9 mr-2.5" :class="userStatusClass(friendUser(item))">
                    <img class="size-full rounded-full object-cover" :src="userImage(friendUser(item))" loading="lazy" />
                  </div>
                  <div class="flex-1 overflow-hidden">
                    <span
                      class="block truncate font-medium leading-[18px] text-[color:var(--user-colour)]"
                      :style="{ '--user-colour': friendUser(item)?.$userColour }"
                      v-text="friendUser(item)?.displayName"
                    ></span>
                  </div>
                </template>
                <template v-else>
                  <span v-text="item.label"></span>
                </template>

                <CheckIcon :class="['ml-auto size-4', selected ? 'opacity-100' : 'opacity-0']" />
              </div>
            </template>
          </VirtualCombobox>
        </div>
      </div>

      <DialogFooter>
        <Button :disabled="inviteGroupDialog.loading || !inviteGroupDialog.userIds.length || !inviteGroupDialog.groupId" @click="sendGroupInvite">
          {{ t("dialog.invite_to_group.invite") }}
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
import { computed, watch } from "vue";
import Button from "@/components/ui/button/Button.vue";
import { Check as CheckIcon } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import { hasGroupPermission } from "../../shared/utils/group";
import { useUserDisplay } from "../../composables/use-user-display";
import { useFriendStore } from "../../stores/friend";
import type { FriendContext } from "../../stores/friend-types";
import { useGroupStore } from "../../stores/group";
import { logFailure } from "../../stores/log-failure";
import { useModalStore } from "../../stores/modal";
import { groupRequest } from "../../api/group";
import { queryRequest } from "../../api/query-request";
import VirtualCombobox from "../ui/virtual-combobox/VirtualCombobox.vue";
import { applyGroup } from "../../coordinators/group-coordinator";

import { configRepository } from "../../services/config";

const { userImage, userStatusClass } = useUserDisplay();
const { vipFriends, onlineFriends, activeFriends, offlineFriends } = storeToRefs(useFriendStore());
const { currentUserGroups, inviteGroupDialog } = storeToRefs(useGroupStore());
const { t } = useI18n();
const modalStore = useModalStore();

watch(
  () => inviteGroupDialog.value.visible,
  async (isVisible) => {
    if (isVisible) {
      const lastGroupId = await configRepository.getString("inviteGroupLastGroup", "");
      if (!inviteGroupDialog.value.groupId) {
        inviteGroupDialog.value.groupId = lastGroupId;
      }
      initDialog();
    } else {
      await configRepository.setString("inviteGroupLastGroup", inviteGroupDialog.value.groupId);
    }
  }
);

const groupsWithInvitePermission = computed(() => {
  return Array.from(currentUserGroups.value.values()).filter((group) => hasGroupPermission(group, "group-invites-manage"));
});

const groupPickerGroups = computed(() => [
  {
    key: "groupsWithInvitePermission",
    label: t("dialog.invite_to_group.groups_with_invite_permission"),
    items: groupsWithInvitePermission.value.map((group) => ({
      value: String(group.id),
      label: group.name ?? "",
      search: group.name ?? "",
    })),
  },
]);

const groupIconUrlById = computed(
  () => new Map<string, string | undefined>(groupsWithInvitePermission.value.map((group) => [String(group.id), group.iconUrl ?? undefined]))
);

function groupIconUrl(item: { value: string | number }) {
  return groupIconUrlById.value.get(String(item.value));
}

const friendSections = computed(() => [
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
  {
    key: "offline",
    label: t("side_panel.offline"),
    friends: offlineFriends.value,
  },
]);

const friendById = computed(() => {
  const map = new Map<string, FriendContext>();
  for (const section of friendSections.value) {
    for (const friend of section.friends) {
      map.set(friend.id, friend);
    }
  }
  return map;
});

type PickerUser = NonNullable<FriendContext["ref"]>;

const friendUserById = computed(() => {
  const map = new Map<string, PickerUser>();
  for (const section of friendSections.value) {
    for (const friend of section.friends) {
      if (friend.ref) {
        map.set(friend.id, friend.ref);
      }
    }
  }
  return map;
});

function friendUser(item: { value: string | number }) {
  return friendUserById.value.get(String(item.value));
}

function resolveUserDisplayName(userId: string) {
  const D = inviteGroupDialog.value;
  if (D.userObject.id && D.userObject.id === userId) {
    return D.userObject.displayName ?? userId;
  }
  const friend = friendById.value.get(userId);
  return friend?.ref?.displayName ?? friend?.name ?? userId;
}

const friendPickerGroups = computed(() => {
  const D = inviteGroupDialog.value;

  const groups: { key: string; label: string; items: { value: string; label: string; search: string }[] }[] = [];

  if (D.userId) {
    const selectedUser = D.userObject.id
      ? {
          value: D.userObject.id,
          label: D.userObject.displayName ?? D.userObject.id,
          search: D.userObject.displayName ?? D.userObject.id,
        }
      : {
          value: D.userId,
          label: D.userId,
          search: D.userId,
        };

    groups.push({
      key: "selectedUsers",
      label: t("dialog.invite_to_group.selected_users"),
      items: [selectedUser],
    });
  }

  const addFriendGroup = ({ key, label, friends }: { key: string; label: string; friends: FriendContext[] }) => {
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

watch(
  () => inviteGroupDialog.value.groupId,
  (groupId) => {
    if (!inviteGroupDialog.value.visible) {
      return;
    }
    if (!groupId) {
      inviteGroupDialog.value.groupName = "";
      return;
    }
    void queryRequest
      .fetch("group", { groupId })
      .then((args) => {
        inviteGroupDialog.value.groupName = args.ref.name ?? "";
      })
      .catch(() => {
        inviteGroupDialog.value.groupId = "";
      });
    isAllowedToInviteToGroup();
  }
);

function initDialog() {
  const D = inviteGroupDialog.value;
  if (D.groupId) {
    void queryRequest
      .fetch("group", {
        groupId: D.groupId,
      })
      .then((args) => {
        D.groupName = args.ref.name ?? "";
      })
      .catch(() => {
        D.groupId = "";
      });
    isAllowedToInviteToGroup();
  }

  if (D.userId) {
    void queryRequest
      .fetch("user.dialog", { userId: D.userId })
      .then((args) => {
        D.userObject = args.ref;
        D.userIds = [D.userId];
      })
      .catch(logFailure("Loading the invite target user failed:"));
  }
}
function isAllowedToInviteToGroup() {
  const D = inviteGroupDialog.value;
  const groupId = D.groupId;
  if (!groupId) {
    return;
  }
  inviteGroupDialog.value.loading = true;
  void groupRequest
    .getGroup({ groupId })
    .then((args) => {
      const ref = applyGroup(args.json);
      if (!hasGroupPermission(ref, "group-invites-manage")) {
        inviteGroupDialog.value.groupId = "";
        toast.error("You are not allowed to invite to this group");
      }
      inviteGroupDialog.value.loading = false;
    })
    .catch((error: unknown) => {
      inviteGroupDialog.value.loading = false;
      logFailure("Checking the invite group permission failed:")(error);
    });
}
function sendGroupInvite() {
  void modalStore
    .confirm({
      description: t("confirm.invite_group"),
      title: "Confirm",
    })
    .then(({ ok }) => {
      if (!ok) return;
      const D = inviteGroupDialog.value;
      if (D.loading) {
        return;
      }
      D.loading = true;
      const inviteLoop = () => {
        const receiverUserId = D.userIds.shift();
        if (receiverUserId === undefined) {
          D.loading = false;
          return;
        }
        void groupRequest
          .sendGroupInvite({
            groupId: D.groupId,
            userId: receiverUserId,
          })
          .then(inviteLoop)
          .catch(() => {
            D.loading = false;
          });
      };
      inviteLoop();
    })
    .catch(logFailure("Sending the group invite failed:"));
}
</script>
