<template>
  <HoverCard :open-delay="400" :close-delay="100">
    <HoverCardTrigger as-child>
      <Item size="sm" variant="muted" class="mb-1.5">
        <ItemMedia variant="image" class="cursor-pointer" @click.stop="openSender">
          <Avatar class="size-full">
            <AvatarImage v-if="avatarUrl" :src="avatarUrl" />
            <AvatarFallback class="text-muted-foreground">
              <component :is="typeIcon" class="size-4" />
            </AvatarFallback>
          </Avatar>
        </ItemMedia>
        <ItemContent class="min-w-0">
          <ItemTitle class="min-w-0 w-full">
            <span class="truncate cursor-pointer" @click.stop="openSender">{{ senderName }}</span>
            <Badge variant="secondary" class="shrink-0 text-muted-foreground text-[10px]">
              {{ typeLabel }}
            </Badge>
            <span v-if="!isNotificationExpired(notification) && !isSeen" class="ml-auto size-2 shrink-0 rounded-full bg-blue-500" />
          </ItemTitle>
          <ItemDescription v-if="notification.type === 'invite' && detailText('worldId')" class="text-xs">
            <Location :location="detailText('worldId')" :hint="detailText('worldName')" :grouphint="detailText('groupName')" link />
          </ItemDescription>
          <ItemDescription
            v-else-if="(notification.type === 'group.queueReady' || notification.type === 'instance.closed') && notification.location"
            class="text-xs"
          >
            <Location :location="notification.location" :hint="textAt(notification, 'worldName')" :grouphint="textAt(notification, 'groupName')" link />
          </ItemDescription>
          <ItemDescription v-if="displayMessage" class="text-xs select-none truncate">
            {{ displayMessage }}
          </ItemDescription>
        </ItemContent>

        <div class="flex h-full shrink-0 flex-col items-end justify-between gap-1">
          <TooltipWrapper v-if="relativeTime" side="top" :content="absoluteTime">
            <span class="text-[10px] text-muted-foreground whitespace-nowrap">
              {{ relativeTime }}
            </span>
          </TooltipWrapper>
          <div class="flex items-center gap-1">
            <template v-if="!isNotificationExpired(notification)">
              <TooltipWrapper v-if="notification.type === 'friendRequest'" side="top" :content="t('view.notification.actions.accept')">
                <button
                  type="button"
                  class="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                  :ariaLabel="t('view.notification.actions.accept')"
                  @click.stop="notificationStore.acceptFriendRequestNotification(notification)"
                >
                  <Check class="size-3" />
                </button>
              </TooltipWrapper>

              <TooltipWrapper v-if="notification.type === 'invite'" side="top" :content="t('view.notification.actions.decline_with_message')">
                <button
                  type="button"
                  class="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                  :ariaLabel="t('view.notification.actions.decline_with_message')"
                  @click.stop="$emit('show-invite-response', notification)"
                >
                  <MessageCircle class="size-3" />
                </button>
              </TooltipWrapper>

              <template v-if="notification.type === 'requestInvite'">
                <TooltipWrapper v-if="canInvite" side="top" :content="t('view.notification.actions.invite')">
                  <button
                    type="button"
                    class="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                    :ariaLabel="t('view.notification.actions.invite')"
                    @click.stop="notificationStore.acceptRequestInvite(notification)"
                  >
                    <Check class="size-3" />
                  </button>
                </TooltipWrapper>
                <TooltipWrapper side="top" :content="t('view.notification.actions.decline_with_message')">
                  <button
                    type="button"
                    class="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                    :ariaLabel="t('view.notification.actions.decline_with_message')"
                    @click.stop="$emit('show-invite-request-response', notification)"
                  >
                    <MessageCircle class="size-3" />
                  </button>
                </TooltipWrapper>
              </template>

              <template v-if="responses.length">
                <TooltipWrapper v-for="response in responses" :key="`${response.text}:${response.type}`" side="top" :content="response.text">
                  <button
                    type="button"
                    class="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                    :ariaLabel="response.text"
                    @click.stop="handleResponse(response)"
                  >
                    <component :is="getResponseIcon(response)" class="size-3" />
                  </button>
                </TooltipWrapper>
              </template>

              <TooltipWrapper v-if="canDecline" side="top" :content="t('view.notification.actions.decline')">
                <button
                  type="button"
                  class="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-muted cursor-pointer"
                  :ariaLabel="t('view.notification.actions.decline')"
                  @click.stop="notificationStore.hideNotificationPrompt(notification)"
                >
                  <X class="size-3" />
                </button>
              </TooltipWrapper>
            </template>

            <TooltipWrapper v-if="canDeleteLog" side="top" :content="t('view.notification.actions.delete_log')">
              <button
                type="button"
                class="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-muted cursor-pointer"
                :ariaLabel="t('view.notification.actions.delete_log')"
                @click.stop="notificationStore.deleteNotificationLogPrompt(notification)"
              >
                <Trash2 class="size-3" />
              </button>
            </TooltipWrapper>
          </div>
        </div>
      </Item>
    </HoverCardTrigger>
    <HoverCardContent side="left" :side-offset="8" class="w-100 p-3">
      <template v-if="isGroupType">
        <div class="flex items-center gap-2 mb-2">
          <Avatar class="size-8 shrink-0 rounded">
            <AvatarImage v-if="hoverImageUrl" :src="hoverImageUrl" />
            <AvatarFallback class="text-muted-foreground rounded">
              <Users class="size-4" />
            </AvatarFallback>
          </Avatar>
          <div class="min-w-0">
            <p class="text-sm font-medium truncate">{{ groupDisplayName }}</p>
            <p class="text-xs text-muted-foreground">{{ typeLabel }}</p>
          </div>
        </div>
        <p v-if="hoverTitle" class="text-sm font-medium mb-1">{{ hoverTitle }}</p>
        <p v-if="notification.message" class="text-xs text-muted-foreground whitespace-pre-line wrap-break-word leading-relaxed">
          {{ notification.message }}
        </p>
      </template>

      <template v-else-if="isFriendType">
        <div class="flex items-center gap-2 mb-2">
          <Avatar class="size-8 shrink-0">
            <AvatarImage v-if="avatarUrl" :src="avatarUrl" />
            <AvatarFallback class="text-muted-foreground">
              <component :is="typeIcon" class="size-4" />
            </AvatarFallback>
          </Avatar>
          <div class="min-w-0">
            <p class="text-sm font-medium truncate">{{ senderName }}</p>
            <p class="text-xs text-muted-foreground">{{ typeLabel }}</p>
          </div>
        </div>
        <div v-if="detailText('worldId')" class="text-xs mb-1">
          <Location :location="detailText('worldId')" :hint="detailText('worldName')" :grouphint="detailText('groupName')" link />
        </div>
        <p v-if="friendMessage" class="text-xs text-muted-foreground wrap-break-word leading-relaxed">
          {{ friendMessage }}
        </p>
      </template>

      <template v-else>
        <div class="flex items-center gap-2 mb-2">
          <Avatar class="size-8 shrink-0">
            <AvatarImage v-if="avatarUrl" :src="avatarUrl" />
            <AvatarFallback class="text-muted-foreground">
              <component :is="typeIcon" class="size-4" />
            </AvatarFallback>
          </Avatar>
          <div class="min-w-0">
            <p class="text-sm font-medium truncate">{{ senderName || notification.type }}</p>
            <p class="text-xs text-muted-foreground">{{ typeLabel }}</p>
          </div>
        </div>
        <p v-if="notification.title" class="text-sm font-medium mb-1">{{ notification.title }}</p>
        <p v-if="displayMessage" class="text-xs text-muted-foreground whitespace-pre-line wrap-break-word leading-relaxed">
          {{ displayMessage }}
        </p>
      </template>

      <Separator v-if="absoluteTime" class="my-2" />
      <div v-if="absoluteTime" class="flex items-center gap-2 text-[10px] text-muted-foreground"><CalendarDays />{{ absoluteTime }}</div>
    </HoverCardContent>
  </HoverCard>
</template>

<script setup lang="ts">
import { Ban, Bell, BellOff, CalendarDays, Check, Link, Mail, MessageCircle, Reply, Send, Tag, Trash2, UserPlus, Users, X } from "lucide-vue-next";
import Item from "@/components/ui/item/Item.vue";
import ItemContent from "@/components/ui/item/ItemContent.vue";
import ItemDescription from "@/components/ui/item/ItemDescription.vue";
import ItemMedia from "@/components/ui/item/ItemMedia.vue";
import ItemTitle from "@/components/ui/item/ItemTitle.vue";
import Avatar from "@/components/ui/avatar/Avatar.vue";
import AvatarFallback from "@/components/ui/avatar/AvatarFallback.vue";
import AvatarImage from "@/components/ui/avatar/AvatarImage.vue";
import HoverCard from "@/components/ui/hover-card/HoverCard.vue";
import HoverCardContent from "@/components/ui/hover-card/HoverCardContent.vue";
import HoverCardTrigger from "@/components/ui/hover-card/HoverCardTrigger.vue";
import { computed, onBeforeUnmount } from "vue";
import type { Component } from "vue";
import Badge from "@/components/ui/badge/Badge.vue";
import Separator from "@/components/ui/separator/Separator.vue";
import TooltipWrapper from "@/components/ui/tooltip/TooltipWrapper.vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import dayjs from "dayjs";

import { useGameStore } from "../../../stores/game";
import { useLocationStore } from "../../../stores/location";
import { useNotificationStore } from "../../../stores/notification";
import { useUserStore } from "../../../stores/user";
import type { NotificationEntry } from "../../../stores/notification/types";
import { showGroupDialog } from "../../../coordinators/group-dialog-coordinator";
import { showUserDialog } from "../../../coordinators/user-coordinator";
import { useInviteChecks } from "../../../composables/use-invite-checks";
import { useUserDisplay } from "../../../composables/use-user-display";

import Location from "../../../components/Location.vue";

type NotificationResponseItem = {
  type: string;
  text: string;
  data: string;
  icon: string;
};

const props = withDefaults(
  defineProps<{
    notification: NotificationEntry;
    isUnseen?: boolean;
  }>(),
  {
    isUnseen: false,
  }
);

defineEmits<{
  "show-invite-response": [notification: NotificationEntry];
  "show-invite-request-response": [notification: NotificationEntry];
}>();

const i18n = useI18n();
const { t } = i18n;
const userStore = useUserStore();
const notificationStore = useNotificationStore();
const { lastLocation } = storeToRefs(useLocationStore());
const { isGameRunning } = storeToRefs(useGameStore());
const { openNotificationLink, isNotificationExpired } = useNotificationStore();
const { checkCanInvite } = useInviteChecks();
const { userImage } = useUserDisplay();

function textAt(source: unknown, key: string): string {
  if (typeof source !== "object" || source === null) {
    return "";
  }
  const value: unknown = Reflect.get(source, key);
  return typeof value === "string" ? value : "";
}

function firstText(...values: (string | null | undefined)[]): string {
  return values.find((value) => Boolean(value)) ?? "";
}

function detailText(key: string): string {
  return textAt(props.notification.details, key);
}

function isNotificationResponseItem(value: unknown): value is NotificationResponseItem {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "type") === "string" &&
    typeof Reflect.get(value, "text") === "string" &&
    typeof Reflect.get(value, "data") === "string"
  );
}

const responses = computed<NotificationResponseItem[]>(() => {
  const value: unknown = Reflect.get(props.notification, "responses");
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isNotificationResponseItem).map((item) => ({
    type: item.type,
    text: item.text,
    data: item.data,
    icon: textAt(item, "icon"),
  }));
});

const senderName = computed(() => {
  const n = props.notification;
  return firstText(n.title, n.senderUsername, textAt(n.data, "groupName"), textAt(n, "groupName"), textAt(n.details, "groupName"));
});

const avatarUrl = computed(() => {
  const n = props.notification;
  const userId = typeof n.senderUserId === "string" ? n.senderUserId : "";

  if (userId.startsWith("grp_") || n.type.startsWith("group.") || n.type === "groupChange") {
    return firstText(textAt(n.details, "imageUrl"), n.imageUrl, textAt(n, "senderUserIcon")) || null;
  }

  if (userId) {
    const user = userStore.cachedUsers.get(userId);
    if (user) {
      return userImage(user);
    }
  }
  return textAt(n, "senderUserIcon") || null;
});

const typeLabel = computed(() => {
  const typeKey = `view.notification.filters.${props.notification.type}`;
  return i18n.te(typeKey) ? t(typeKey) : props.notification.type;
});

const TYPE_ICON_MAP = new Map<string, Component>([
  ["friendRequest", UserPlus],
  ["ignoredFriendRequest", UserPlus],
  ["invite", Send],
  ["requestInvite", Send],
  ["inviteResponse", Send],
  ["requestInviteResponse", Send],
  ["boop", MessageCircle],
  ["message", Mail],
]);

const typeIcon = computed<Component>(() => {
  const type = props.notification.type;
  const mappedIcon = TYPE_ICON_MAP.get(type);
  if (mappedIcon) return mappedIcon;
  if (type.startsWith("group.") || type === "groupChange") return Users;
  return Bell;
});

const displayMessage = computed(() => {
  const n = props.notification;
  return firstText(
    n.message,
    textAt(n.details, "inviteMessage"),
    textAt(n.details, "requestMessage"),
    textAt(n.details, "responseMessage"),
    textAt(n.details, "worldName")
  );
});

const createdAtValue = computed(() => props.notification.created_at || props.notification.createdAt);

const relativeTime = computed(() => {
  if (!createdAtValue.value) return "";
  return dayjs(createdAtValue.value).fromNow(true);
});

const absoluteTime = computed(() => {
  if (!createdAtValue.value) return "";
  return dayjs(createdAtValue.value).format("YYYY-MM-DD HH:mm:ss");
});

const canDecline = computed(() => {
  const type = props.notification.type;
  const link = textAt(props.notification, "link");
  return (
    type !== "requestInviteResponse" &&
    type !== "inviteResponse" &&
    type !== "message" &&
    type !== "boop" &&
    type !== "groupChange" &&
    !type.includes("group.") &&
    !type.includes("moderation.") &&
    !type.includes("instance.") &&
    !link.startsWith("economy.")
  );
});

const canDeleteLog = computed(() => {
  const type = props.notification.type;
  if (type === "friendRequest" || type === "ignoredFriendRequest") return false;
  return true;
});

const isGroupType = computed(() => {
  const type = props.notification.type;
  return type.startsWith("group.") || type === "groupChange";
});

const isFriendType = computed(() => {
  const type = props.notification.type;
  return ["invite", "requestInvite", "inviteResponse", "requestInviteResponse", "friendRequest", "ignoredFriendRequest", "boop"].includes(type);
});

const groupDisplayName = computed(() => {
  const n = props.notification;
  return firstText(n.title, textAt(n.data, "groupName"), textAt(n, "groupName"), textAt(n.details, "groupName"), n.senderUsername);
});

const hoverTitle = computed(() => {
  const n = props.notification;
  return firstText(textAt(n.data, "announcementTitle"), n.title);
});

const hoverImageUrl = computed(() => {
  const n = props.notification;
  return firstText(n.imageUrl, textAt(n.details, "imageUrl")) || null;
});

const friendMessage = computed(() => {
  const n = props.notification;
  return firstText(n.message, textAt(n.details, "inviteMessage"), textAt(n.details, "requestMessage"), textAt(n.details, "responseMessage"));
});

const isSeen = computed(() => {
  const n = props.notification;
  if (typeof n.seen === "boolean") {
    return n.seen;
  }

  return !props.isUnseen;
});

const canInvite = computed(() => {
  const location = lastLocation.value.location;
  return Boolean(location) && isGameRunning.value && checkCanInvite(location);
});

function getResponseIcon(response: NotificationResponseItem): Component {
  if (response.type === "link") return Link;
  switch (response.icon) {
    case "check":
      return Check;
    case "cancel":
      return X;
    case "ban":
      return Ban;
    case "bell-slash":
      return BellOff;
    case "reply":
      return props.notification.type === "boop" ? MessageCircle : Reply;
    default:
      return Tag;
  }
}

function handleResponse(response: NotificationResponseItem) {
  if (response.type === "link") {
    openNotificationLink(response.data);
    return;
  }
  if (response.icon === "reply" && props.notification.type === "boop") {
    const senderUserId = props.notification.senderUserId;
    if (senderUserId) userStore.showSendBoopDialog(senderUserId);
    return;
  }
  const id = props.notification.id;
  if (!id) return;
  notificationStore.sendNotificationResponse(id, responses.value, response.type);
}

function openSender() {
  const n = props.notification;
  const userId = typeof n.senderUserId === "string" ? n.senderUserId : "";

  if (userId.startsWith("grp_") || n.type.startsWith("group.") || n.type === "groupChange") {
    const groupId = userId.startsWith("grp_") ? userId : firstText(textAt(n.data, "groupId"), textAt(n.details, "groupId"));
    if (groupId) {
      showGroupDialog(groupId);
      return;
    }
  }

  if (userId) {
    showUserDialog(userId);
    return;
  }

  const link = textAt(n, "link");
  if (link) {
    openNotificationLink(link);
  }
}

onBeforeUnmount(() => {
  const id = props.notification.id;
  if (isNotificationExpired(props.notification) || isSeen.value || !id) {
    return;
  }
  let version = 1;
  if (props.notification.version) version = props.notification.version;
  notificationStore.queueMarkAsSeen(id, version);
});
</script>
