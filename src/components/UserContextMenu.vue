<template>
  <ContextMenu>
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuContent>
      <ContextMenuItem @click="handleViewDetails">
        <ExternalLink class="size-4" />
        {{ t("common.actions.view_details") }}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem v-if="isOnline" @click="handleRequestInvite">
        <Mail class="size-4" />
        {{ t("dialog.user.actions.request_invite") }}
        <ContextMenuShortcut v-if="showRecentRequestInvite">
          <Clock class="size-3.5 text-muted-foreground" />
        </ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem v-if="isGameRunning" :disabled="!canInviteToMyLocation" @click="handleInvite">
        <MessageSquare class="size-4" />
        {{ t("dialog.user.actions.invite") }}
        <ContextMenuShortcut v-if="showRecentInvite">
          <Clock class="size-3.5 text-muted-foreground" />
        </ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem :disabled="!currentUser?.isBoopingEnabled" @click="handleSendBoop">
        <Hand class="size-4" />
        {{ t("dialog.user.actions.send_boop") }}
      </ContextMenuItem>
      <ContextMenuSeparator v-if="isOnline && hasLocation" />
      <ContextMenuItem v-if="isOnline && hasLocation" :disabled="!canJoin" @click="handleJoin">
        <LogIn class="size-4" />
        {{ t("dialog.user.info.launch_invite_tooltip") }}
      </ContextMenuItem>
      <ContextMenuItem v-if="isOnline && hasLocation" :disabled="!canJoin" @click="handleSelfInvite">
        <Mail class="size-4" />
        {{ t("dialog.user.info.self_invite_tooltip") }}
      </ContextMenuItem>
      <slot name="append" />
    </ContextMenuContent>
  </ContextMenu>
</template>

<script setup lang="ts">
import { Clock, ExternalLink, LogIn, Mail, MessageSquare, Hand } from "lucide-vue-next";
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import ContextMenu from "./ui/context-menu/ContextMenu.vue";
import ContextMenuContent from "./ui/context-menu/ContextMenuContent.vue";
import ContextMenuItem from "./ui/context-menu/ContextMenuItem.vue";
import ContextMenuSeparator from "./ui/context-menu/ContextMenuSeparator.vue";
import ContextMenuShortcut from "./ui/context-menu/ContextMenuShortcut.vue";
import ContextMenuTrigger from "./ui/context-menu/ContextMenuTrigger.vue";
import { isRealInstance } from "../shared/utils/instance";
import { parseLocation } from "../shared/utils/location-parser";
import { useGameStore } from "../stores/game";
import { useLaunchStore } from "../stores/launch";
import { useLocationStore } from "../stores/location";
import { useUserStore } from "../stores/user";
import { instanceRequest } from "../api/instance";
import { notificationRequest } from "../api/notification";
import { queryRequest } from "../api/query-request";
import { useInviteChecks } from "../composables/use-invite-checks";
import { isActionRecent, recordRecentAction } from "../composables/use-recent-actions";
import { logFailure } from "../stores/log-failure";

import { showUserDialog } from "../coordinators/user-coordinator";

const { t } = useI18n();
const { showSendBoopDialog } = useUserStore();
const launchStore = useLaunchStore();
const { lastLocation, lastLocationDestination } = storeToRefs(useLocationStore());
const { isGameRunning } = storeToRefs(useGameStore());
const { currentUser } = storeToRefs(useUserStore());
const { checkCanInvite, checkCanInviteSelf } = useInviteChecks();

const props = withDefaults(
  defineProps<{
    userId: string;
    state?: string;
    location?: string;
  }>(),
  {
    state: "",
    location: "",
  }
);

const isOnline = computed(() => props.state === "online");
const hasLocation = computed(() => !!props.location && isRealInstance(props.location));
const canInviteToMyLocation = computed(() => checkCanInvite(lastLocation.value.location));
const canJoin = computed(() => {
  if (!props.location || !isRealInstance(props.location)) return false;
  return checkCanInviteSelf(props.location);
});

const showRecentRequestInvite = computed(() => isActionRecent(props.userId, "Request Invite"));
const showRecentInvite = computed(() => isActionRecent(props.userId, "Invite"));

function handleViewDetails() {
  showUserDialog(props.userId);
}

function handleRequestInvite() {
  void notificationRequest
    .sendRequestInvite({ platform: "standalonewindows" }, props.userId)
    .then(() => {
      recordRecentAction(props.userId, "Request Invite");
      toast.success(t("message.user.request_invite_sent"));
    })
    .catch(logFailure("Failed to send request invite:"));
}

function handleInvite() {
  let currentLocation = lastLocation.value.location;
  if (currentLocation === "traveling") {
    currentLocation = lastLocationDestination.value;
  }
  const parsedLocation = parseLocation(currentLocation);
  void queryRequest
    .fetch("world.location", { worldId: parsedLocation.worldId })
    .then((args) =>
      notificationRequest.sendInvite(
        {
          instanceId: parsedLocation.tag,
          worldId: parsedLocation.tag,
          worldName: args.ref.name,
        },
        props.userId
      )
    )
    .then(() => {
      recordRecentAction(props.userId, "Invite");
      toast.success(t("message.invite.sent"));
    })
    .catch(logFailure("Failed to send invite:"));
}

function handleSendBoop() {
  showSendBoopDialog(props.userId);
}

function handleJoin() {
  if (!props.location) return;
  void launchStore.showLaunchDialog(props.location).catch(logFailure("Failed to show launch dialog:"));
}

function handleSelfInvite() {
  if (!props.location) return;
  const parsedLocation = parseLocation(props.location);
  void instanceRequest
    .selfInvite({
      instanceId: parsedLocation.instanceId,
      worldId: parsedLocation.worldId,
    })
    .then(() => {
      toast.success(t("message.invite.self_sent"));
    })
    .catch(logFailure("Failed to send self invite:"));
}
</script>
