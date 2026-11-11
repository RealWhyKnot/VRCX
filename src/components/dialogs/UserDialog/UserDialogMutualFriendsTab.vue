<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden rounded-xl bg-(--profile-card) p-2">
    <div class="shrink-0 flex items-center justify-between">
      <div class="flex items-center">
        <Button class="rounded-full" variant="ghost" size="icon-sm" :disabled="userDialog.isMutualFriendsLoading" @click="getUserMutualFriends(userDialog.id)">
          <Spinner v-if="userDialog.isMutualFriendsLoading" />
          <RefreshCw v-else />
        </Button>
        <span class="inline-flex items-center gap-1 ml-1.5 text-sm">
          <Users class="size-3.5 text-muted-foreground" />
          {{ t("dialog.user.groups.total_count", { count: userDialog.mutualFriends.length }) }}
        </span>
      </div>
      <div class="flex items-center">
        <Input v-model="searchQuery" class="h-8 w-40 mr-2" :placeholder="t('dialog.user.mutual_friends.search_placeholder')" @click.stop />
        <span class="mr-1.5">{{ t("dialog.user.groups.sort_by") }}</span>
        <Select
          :model-value="userDialogMutualFriendSortingKey"
          :disabled="userDialog.isMutualFriendsLoading"
          @update:model-value="selectMutualFriendSortingKey"
        >
          <SelectTrigger size="sm" @click.stop>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="(item, key) in userDialogMutualFriendSortingOptions" :key="String(key)" :value="String(key)">
              {{ t(item.name) }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
    <div class="min-h-0 flex-1 overflow-auto">
      <ul class="flex flex-wrap items-start mt-2 min-w-[130px]">
        <li
          v-for="user in filteredMutualFriends"
          :key="user.id"
          class="box-border flex items-center p-1.5 text-[13px] cursor-pointer w-[167px] hover:rounded-[25px_5px_5px_25px]"
          @click="showUserDialog(user.id)"
        >
          <div class="relative inline-block flex-none size-9 mr-2.5">
            <Avatar class="size-9">
              <AvatarImage :src="userImage(user)" class="object-cover" />
              <AvatarFallback>
                <User class="size-4 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
            <IconFrame :icon-frame="user.iconFrame ?? ''" />
          </div>
          <div class="flex-1 overflow-hidden">
            <span
              class="block truncate font-medium leading-[18px] text-[var(--user-colour,inherit)]"
              :style="{ '--user-colour': user.$userColour }"
              v-text="user.displayName"
            ></span>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import Avatar from "@/components/ui/avatar/Avatar.vue";
import AvatarFallback from "@/components/ui/avatar/AvatarFallback.vue";
import AvatarImage from "@/components/ui/avatar/AvatarImage.vue";
import IconFrame from "@/components/IconFrame.vue";
import Select from "@/components/ui/select/Select.vue";
import SelectContent from "@/components/ui/select/SelectContent.vue";
import SelectItem from "@/components/ui/select/SelectItem.vue";
import SelectTrigger from "@/components/ui/select/SelectTrigger.vue";
import SelectValue from "@/components/ui/select/SelectValue.vue";
import Button from "@/components/ui/button/Button.vue";
import { RefreshCw, User, Users } from "lucide-vue-next";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import Input from "@/components/ui/input/Input.vue";
import { computed, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import { compareByDisplayName, compareByFriendOrder, compareByLastActiveRef } from "../../../shared/utils/compare";
import { useUserDisplay } from "../../../composables/use-user-display";
import { database } from "../../../services/database";
import { processBulk } from "../../../services/request";
import { useOptionKeySelect } from "../../../composables/use-option-key-select";
import { useUserStore } from "../../../stores/user";
import type { UserSorting } from "../../../stores/user-state";
import { userDialogMutualFriendSortingOptions } from "../../../shared/constants/user";
import { userRequest } from "../../../api/user";
import { showUserDialog } from "../../../coordinators/user-coordinator";

const { t } = useI18n();
const { userImage } = useUserDisplay();

const userStore = useUserStore();
const { userDialog, currentUser } = storeToRefs(userStore);
const { cachedUsers } = userStore;

const { selectedKey: userDialogMutualFriendSortingKey, selectByKey: setUserDialogMutualFriendSortingByKey } = useOptionKeySelect(
  userDialogMutualFriendSortingOptions,
  () => userDialog.value.mutualFriendSorting,
  setUserDialogMutualFriendSorting
);

function selectMutualFriendSortingKey(value: unknown) {
  if (typeof value === "string") {
    setUserDialogMutualFriendSortingByKey(value);
  }
}

const searchQuery = ref("");
const filteredMutualFriends = computed(() => {
  const friends = userDialog.value.mutualFriends;
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return friends;
  return friends.filter((u) => (u.displayName ?? "").toLowerCase().includes(query));
});
watch(
  () => userDialog.value.id,
  () => {
    searchQuery.value = "";
  }
);

function setUserDialogMutualFriendSorting(sortOrder: UserSorting) {
  const D = userDialog.value;
  D.mutualFriendSorting = sortOrder;
  switch (sortOrder.value) {
    case "alphabetical":
      D.mutualFriends.sort(compareByDisplayName);
      break;
    case "lastActive":
      D.mutualFriends.sort(compareByLastActiveRef);
      break;
    case "friendOrder":
      D.mutualFriends.sort(compareByFriendOrder);
      break;
  }
}

function getUserMutualFriends(userId: string) {
  userDialog.value.mutualFriends = [];
  if (currentUser.value.hasSharedConnectionsOptOut) {
    return;
  }
  userDialog.value.isMutualFriendsLoading = true;
  const params = {
    userId,
    n: 100,
    offset: 0,
  };
  processBulk({
    fn: (params) => userRequest.getMutualFriends(params),
    N: -1,
    params,
    handle: (args) => {
      for (const json of args.json) {
        if (userDialog.value.mutualFriends.some((u) => u.id === json.id)) {
          continue;
        }
        const ref = cachedUsers.get(json.id);
        if (typeof ref !== "undefined") {
          userDialog.value.mutualFriends.push(ref);
        } else {
          userDialog.value.mutualFriends.push(json);
        }
      }
      setUserDialogMutualFriendSorting(userDialog.value.mutualFriendSorting);
    },
    done: (isSuccess) => {
      userDialog.value.isMutualFriendsLoading = false;
      if (isSuccess) {
        const mutualIds = userDialog.value.mutualFriends.map((u) => u.id);
        void database.updateMutualsForFriend(userId, mutualIds).catch((err: unknown) => {
          console.error(err);
        });
      }
    },
  }).catch((err: unknown) => {
    console.error(err);
  });
}

defineExpose({ getUserMutualFriends });
</script>
