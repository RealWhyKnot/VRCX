<template>
  <template v-if="favorite.ref">
    <UserContextMenu :user-id="favorite.id" :state="favorite.ref.state" :location="favorite.ref.location">
      <template #append>
        <ContextMenuSeparator />
        <ContextMenuItem @click="showFavoriteDialog('friend', favorite.id)">
          {{ t("view.favorite.edit_favorite_tooltip") }}
        </ContextMenuItem>
        <ContextMenuItem variant="destructive" @click="handleDeleteFavorite">
          {{ deleteMenuLabel }}
        </ContextMenuItem>
      </template>
      <Item variant="outline" class="favorites-item cursor-pointer hover:bg-muted x-hover-list" :style="itemStyle" @click="handleOpenProfile">
        <ItemMedia class="relative size-10">
          <Avatar class="size-full">
            <AvatarImage :src="userImage(favorite.ref, true)" loading="lazy" />
            <AvatarFallback>
              <User class="size-4 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
          <IconFrame :icon-frame="favorite.ref.iconFrame" />
        </ItemMedia>
        <ItemContent class="min-w-0">
          <ItemTitle class="truncate max-w-full" :style="displayNameStyle">{{ displayName }}</ItemTitle>
          <ItemDescription class="truncate line-clamp-1 text-xs!">
            <template v-if="favorite.ref.location !== 'offline'">
              <Location :location="favorite.ref.location" :traveling="favorite.ref.travelingToLocation" :link="false" />
            </template>
            <template v-else>
              {{ favorite.ref.statusDescription }}
            </template>
          </ItemDescription>
        </ItemContent>
        <ItemActions v-if="editMode" @click.stop>
          <Checkbox v-model="isSelected" />
        </ItemActions>
        <DropdownMenu v-else>
          <DropdownMenuTrigger as-child>
            <Button size="icon-sm" variant="ghost" class="rounded-full" :aria-label="t('nav_tooltip.manage')" @click.stop>
              <MoreHorizontal class="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem @click="handleOpenProfile">
              {{ t("common.actions.view_details") }}
            </DropdownMenuItem>
            <DropdownMenuItem v-if="favorite.ref.state === 'online'" @click="friendRequestInvite">
              {{ t("dialog.user.actions.request_invite") }}
            </DropdownMenuItem>
            <DropdownMenuItem v-if="isGameRunning" :disabled="!canInviteToMyLocation" @click="friendInvite">
              {{ t("dialog.user.actions.invite") }}
            </DropdownMenuItem>
            <DropdownMenuItem :disabled="!currentUser?.isBoopingEnabled" @click="friendSendBoop">
              {{ t("dialog.user.actions.send_boop") }}
            </DropdownMenuItem>
            <DropdownMenuSeparator v-if="favorite.ref.state === 'online' && hasFriendLocation" />
            <DropdownMenuItem v-if="favorite.ref.state === 'online' && hasFriendLocation" :disabled="!canJoinFriend" @click="friendJoin">
              {{ t("dialog.user.info.launch_invite_tooltip") }}
            </DropdownMenuItem>
            <DropdownMenuItem v-if="favorite.ref.state === 'online' && hasFriendLocation" :disabled="!canJoinFriend" @click="friendInviteSelf">
              {{ t("dialog.user.info.self_invite_tooltip") }}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem @click="showFavoriteDialog('friend', favorite.id)">
              {{ t("view.favorite.edit_favorite_tooltip") }}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" @click="handleDeleteFavorite">
              {{ deleteMenuLabel }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Item>
    </UserContextMenu>
  </template>
  <template v-else>
    <Item variant="outline" class="favorites-item hover:bg-muted x-hover-list" :style="itemStyle">
      <ItemMedia variant="image">
        <Avatar>
          <AvatarFallback>
            <User class="size-4 text-muted-foreground" />
          </AvatarFallback>
        </Avatar>
      </ItemMedia>
      <ItemContent class="min-w-0">
        <ItemTitle class="truncate max-w-full">{{ favorite.name || favorite.id }}</ItemTitle>
        <ItemDescription class="truncate line-clamp-1">{{ favorite.id }}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button class="rounded-full h-6 w-6" size="icon-sm" variant="outline" @click.stop="handleDeleteFavorite">
          <Trash2 class="h-4 w-4" />
        </Button>
      </ItemActions>
    </Item>
  </template>
</template>

<script setup>
import { MoreHorizontal, Trash2, User } from "lucide-vue-next";
import Button from "@/components/ui/button/Button.vue";
import Checkbox from "@/components/ui/checkbox/Checkbox.vue";
import ContextMenuItem from "@/components/ui/context-menu/ContextMenuItem.vue";
import ContextMenuSeparator from "@/components/ui/context-menu/ContextMenuSeparator.vue";
import DropdownMenu from "@/components/ui/dropdown-menu/DropdownMenu.vue";
import DropdownMenuContent from "@/components/ui/dropdown-menu/DropdownMenuContent.vue";
import DropdownMenuItem from "@/components/ui/dropdown-menu/DropdownMenuItem.vue";
import DropdownMenuSeparator from "@/components/ui/dropdown-menu/DropdownMenuSeparator.vue";
import DropdownMenuTrigger from "@/components/ui/dropdown-menu/DropdownMenuTrigger.vue";
import Avatar from "@/components/ui/avatar/Avatar.vue";
import AvatarFallback from "@/components/ui/avatar/AvatarFallback.vue";
import AvatarImage from "@/components/ui/avatar/AvatarImage.vue";
import Item from "@/components/ui/item/Item.vue";
import ItemActions from "@/components/ui/item/ItemActions.vue";
import ItemContent from "@/components/ui/item/ItemContent.vue";
import ItemDescription from "@/components/ui/item/ItemDescription.vue";
import ItemMedia from "@/components/ui/item/ItemMedia.vue";
import ItemTitle from "@/components/ui/item/ItemTitle.vue";
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import favoriteRequest from "../../../api/favorite";
import instanceRequest from "../../../api/instance";
import notificationRequest from "../../../api/notification";
import queryRequest from "../../../api/query-request";
import { useInviteChecks } from "../../../composables/use-invite-checks";
import { removeLocalFriendFavorite } from "../../../coordinators/favorite-coordinator";
import { showUserDialog } from "../../../coordinators/user-coordinator";
import { parseLocation } from "../../../shared/utils/location-parser";
import { isRealInstance } from "../../../shared/utils/instance";
import { useFavoriteStore } from "../../../stores/favorite";
import { useGameStore } from "../../../stores/game";
import { useLocationStore } from "../../../stores/location";
import { useLaunchStore } from "../../../stores/launch";
import { useUserStore } from "../../../stores/user";
import { useUserDisplay } from "../../../composables/use-user-display";

import Location from "../../../components/Location.vue";
import UserContextMenu from "../../../components/UserContextMenu.vue";
import IconFrame from "../../../components/IconFrame.vue";

const { userImage } = useUserDisplay();
const props = defineProps({
  favorite: { type: Object, required: true },
  group: { type: Object, default: null },
  editMode: { type: Boolean, default: false },
  selected: { type: Boolean, default: false },
});

const emit = defineEmits(["toggle-select"]);

const { showFavoriteDialog } = useFavoriteStore();
const launchStore = useLaunchStore();
const { t } = useI18n();
const { showSendBoopDialog } = useUserStore();
const { checkCanInvite, checkCanInviteSelf } = useInviteChecks();
const { currentUser } = storeToRefs(useUserStore());
const { isGameRunning } = storeToRefs(useGameStore());
const { lastLocation, lastLocationDestination } = storeToRefs(useLocationStore());

const isSelected = computed({
  get: () => props.selected,
  set: (value) => emit("toggle-select", value),
});

const displayName = computed(() => props.favorite?.ref?.displayName || props.favorite?.name || props.favorite?.id);

const displayNameStyle = computed(() => {
  if (props.favorite?.ref?.$userColour) {
    return {
      color: props.favorite.ref.$userColour,
    };
  }
  return {};
});

const itemStyle = computed(() => ({
  padding: "var(--favorites-card-padding-y, 8px) var(--favorites-card-padding-x, 10px)",
  gap: "var(--favorites-card-content-gap, 10px)",
  minWidth: "var(--favorites-card-min-width, 220px)",
  maxWidth: "var(--favorites-card-target-width, 220px)",
  width: "100%",
  fontSize: "calc(0.875rem * var(--favorites-card-scale, 1))",
}));

const deleteMenuLabel = computed(() => (props.group?.type === "local" ? t("view.favorite.delete_tooltip") : t("view.favorite.unfavorite_tooltip")));

const canInviteToMyLocation = computed(() => checkCanInvite(lastLocation.value.location));

const hasFriendLocation = computed(() => {
  const loc = props.favorite?.ref?.location;
  return !!loc && isRealInstance(loc);
});

const canJoinFriend = computed(() => {
  const loc = props.favorite?.ref?.location;
  if (!loc || !isRealInstance(loc)) {
    return false;
  }
  return checkCanInviteSelf(loc);
});

function handleOpenProfile() {
  showUserDialog(props.favorite.id);
}

function friendRequestInvite() {
  notificationRequest.sendRequestInvite({ platform: "standalonewindows" }, props.favorite.id).then(() => {
    toast.success("Request invite sent");
  });
}

function friendInvite() {
  let currentLocation = lastLocation.value.location;
  if (currentLocation === "traveling") {
    currentLocation = lastLocationDestination.value;
  }
  const location = parseLocation(currentLocation);
  queryRequest.fetch("world.location", { worldId: location.worldId }).then((args) => {
    notificationRequest
      .sendInvite(
        {
          instanceId: location.tag,
          worldId: location.tag,
          worldName: args.ref.name,
        },
        props.favorite.id
      )
      .then(() => {
        toast.success(t("message.invite.sent"));
      });
  });
}

function friendSendBoop() {
  showSendBoopDialog(props.favorite.id);
}

function friendJoin() {
  const loc = props.favorite?.ref?.location;
  if (!loc) {
    return;
  }
  launchStore.showLaunchDialog(loc);
}

function friendInviteSelf() {
  const loc = props.favorite?.ref?.location;
  if (!loc) {
    return;
  }
  const location = parseLocation(loc);
  instanceRequest
    .selfInvite({
      instanceId: location.instanceId,
      worldId: location.worldId,
    })
    .then(() => {
      toast.success(t("message.invite.self_sent"));
    });
}

function handleDeleteFavorite() {
  if (props.group?.type === "local") {
    removeLocalFriendFavorite(props.favorite.id, props.group.key);
  } else {
    favoriteRequest.deleteFavorite({
      objectId: props.favorite.id,
    });
  }
}
</script>

<style scoped>
.favorites-item :deep(img) {
  filter: saturate(0.8) contrast(0.8);
  transition: filter 0.2s ease;
}

.favorites-item:hover :deep(img) {
  filter: saturate(1) contrast(1);
}
</style>
