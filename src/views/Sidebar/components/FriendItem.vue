<template>
  <div
    class="relative isolate box-border flex items-center overflow-hidden rounded-lg p-1.5 text-[13px] cursor-pointer transition-colors duration-150 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    :role="friend.ref ? 'button' : undefined"
    :tabindex="friend.ref ? 0 : undefined"
    @click="showUserDialog(friend.id)"
    @keydown.enter.self="showUserDialog(friend.id)"
    @keydown.space.self.prevent="showUserDialog(friend.id)"
  >
    <template v-if="friend.ref">
      <div class="relative inline-block flex-none size-9 mr-2.5" :class="friendStatusClass">
        <Avatar class="size-full rounded-full">
          <AvatarImage :src="userImage(friend.ref, true)" class="object-cover" />
          <AvatarFallback>
            <User class="size-5 text-muted-foreground" />
          </AvatarFallback>
        </Avatar>
        <IconFrame :enabled="sidebarCosmetics" :icon-frame="friend.ref.iconFrame ?? ''" />
      </div>
      <div class="flex-1 overflow-hidden h-9 flex flex-col justify-between">
        <span
          v-if="!hideNicknames && friend.$nickName"
          class="block truncate font-medium leading-[18px] [color:var(--user-colour,inherit)]"
          :style="{ '--user-colour': friend.ref.$userColour }"
        >
          <TooltipWrapper v-if="hasRecentInviteAction" :content="t('side_panel.recently_invited')" side="top"
            ><Clock class="mr-1 inline size-3.5 align-[-2px] text-muted-foreground" /></TooltipWrapper
          >{{ friend.ref.displayName }} ({{ friend.$nickName }})
        </span>
        <span v-else class="block truncate font-medium leading-[18px] [color:var(--user-colour,inherit)]" :style="{ '--user-colour': friend.ref.$userColour }"
          ><TooltipWrapper v-if="hasRecentInviteAction" :content="t('side_panel.recently_invited')" side="top"
            ><Clock class="mr-1 inline size-3.5 align-[-2px] text-muted-foreground" /></TooltipWrapper
          >{{ friend.ref.displayName }}{{ isGroupByInstance && isFavorite ? " ⭐" : "" }}</span
        >

        <span v-if="isFriendActiveOrOffline" class="block truncate text-xs">{{ friend.ref.statusDescription }}</span>
        <template v-else>
          <div v-if="friend.pendingOffline" class="extra block truncate text-xs">
            {{ t("side_panel.pending_offline") }}
          </div>
          <template v-else-if="isGroupByInstance">
            <div class="flex items-center">
              <Spinner v-if="isFriendTraveling" class="mr-1" />
              <Timer class="text-xs" :class="isFriendTraveling ? 'inline-block [overflow:unset]' : undefined" :epoch="epoch" />
            </div>
          </template>
          <Location v-else class="extra block truncate text-xs!" :location="locationProp" :traveling="travelingProp" :link="false" />
        </template>
      </div>
    </template>
    <template v-else-if="!friend.ref && !isRefreshFriendsLoading">
      <span>{{ friend.name || friend.id }}</span>
      <TooltipWrapper :content="t('common.actions.delete')" side="left">
        <Button size="sm" variant="ghost" class="mr-1 w-6 h-6 text-xs" :aria-label="t('common.actions.delete')" @click.stop="confirmDeleteFriend(friend.id)"
          ><Trash2 class="h-4 w-4" />
        </Button>
      </TooltipWrapper>
    </template>
  </div>
</template>

<script setup lang="ts">
import Avatar from "@/components/ui/avatar/Avatar.vue";
import AvatarFallback from "@/components/ui/avatar/AvatarFallback.vue";
import AvatarImage from "@/components/ui/avatar/AvatarImage.vue";
import { Clock, Trash2, User } from "lucide-vue-next";
import Button from "@/components/ui/button/Button.vue";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import TooltipWrapper from "@/components/ui/tooltip/TooltipWrapper.vue";
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import Location from "@/components/Location.vue";
import Timer from "@/components/Timer.vue";
import IconFrame from "@/components/IconFrame.vue";

import { useAppearanceSettingsStore } from "../../../stores/settings/appearance";
import { useFriendStore } from "../../../stores/friend";
import type { FriendContext } from "../../../stores/friend-types";
import { isActionRecent } from "../../../composables/use-recent-actions";
import { useUserDisplay } from "../../../composables/use-user-display";

import "@/styles/status-icon.css";
import { showUserDialog } from "../../../coordinators/user-coordinator";
import { confirmDeleteFriend } from "../../../coordinators/friend-relationship-coordinator";

const props = defineProps<{
  friend: FriendContext;
  isGroupByInstance?: boolean | undefined;
  isFavorite?: boolean | undefined;
}>();

const { hideNicknames, sidebarCosmetics } = storeToRefs(useAppearanceSettingsStore());
const { isRefreshFriendsLoading } = storeToRefs(useFriendStore());
const { userImage, userStatusClass } = useUserDisplay();

const { t } = useI18n();

const isFriendTraveling = computed(() => props.friend.ref?.location === "traveling");
const isFriendActiveOrOffline = computed(() => props.friend.state === "active" || props.friend.state === "offline");

const INVITE_ACTIONS = ["Invite", "Invite Photo", "Invite Message", "Request Invite", "Request Invite Photo", "Request Invite Message"];

const hasRecentInviteAction = computed(() => INVITE_ACTIONS.some((action) => isActionRecent(props.friend.id, action)));

const friendStatusClass = computed(() => {
  return userStatusClass(props.friend.ref, props.friend.pendingOffline);
});

const epoch = computed(() => (isFriendTraveling.value ? props.friend.ref?.$travelingToTime : props.friend.ref?.$location_at) ?? 0);

const locationProp = computed(() => props.friend.ref?.location ?? "");
const travelingProp = computed(() => props.friend.ref?.travelingToLocation ?? "");
</script>
