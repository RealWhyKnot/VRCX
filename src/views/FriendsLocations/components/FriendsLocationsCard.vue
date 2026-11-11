<template>
  <UserContextMenu :user-id="friend.id" :state="friend.state" :location="friend.ref?.location ?? ''">
    <Card class="friend-card x-hover-card hover:bg-muted relative cursor-pointer" :style="cardStyle" @click="showUserDialog(friend.id)">
      <ProfileEffect :enabled="showCosmetics" :profile-effect="friend.ref?.profileEffect ?? ''" class="object-cover rounded-lg" />
      <div class="friend-card-header grid items-center mb-1.75">
        <div class="relative inline-block flex-none size-9 mr-2.5">
          <Avatar class="size-full rounded-full">
            <AvatarImage :src="userImage(friend.ref, true)" class="object-cover" />
            <AvatarFallback>
              <User class="text-muted-foreground" :size="Math.max(16, 20 * cardScale)" />
            </AvatarFallback>
          </Avatar>
          <IconFrame :enabled="showCosmetics" :icon-frame="friend.ref?.iconFrame ?? ''" />
        </div>
        <span class="friend-card-status-dot absolute rounded-full pointer-events-none" :class="statusDotClass"></span>
        <div class="friend-card-name relative font-semibold overflow-hidden text-ellipsis whitespace-nowrap" :title="friend.name">
          {{ friend.name }}
        </div>
      </div>
      <div class="friend-card-body grid">
        <div
          class="friend-card-signature flex items-center overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground"
          :title="friend.ref?.statusDescription"
        >
          <Pencil v-if="friend.ref?.statusDescription" class="h-3.5 w-3.5 mr-0.5 opacity-[0.7]" />
          {{ friend.ref?.statusDescription || "&nbsp;" }}
        </div>
        <div
          v-if="displayInstanceInfo"
          class="friend-card-world flex items-center justify-start box-border max-w-full min-w-0 overflow-hidden dark:text-zinc-300"
          @click.stop
        >
          <Location
            class="friend-card-location flex w-full overflow-hidden wrap-break-word text-center"
            :location="friend.ref?.location ?? ''"
            :traveling="friend.ref?.travelingToLocation ?? ''"
            enable-context-menu
            link
          />
        </div>
      </div>
    </Card>
  </UserContextMenu>
</template>

<script setup lang="ts">
import Avatar from "@/components/ui/avatar/Avatar.vue";
import AvatarFallback from "@/components/ui/avatar/AvatarFallback.vue";
import AvatarImage from "@/components/ui/avatar/AvatarImage.vue";
import IconFrame from "@/components/IconFrame.vue";
import ProfileEffect from "@/components/ProfileEffect.vue";
import Card from "@/components/ui/card/Card.vue";
import { Pencil, User } from "lucide-vue-next";
import { computed } from "vue";

import { useUserDisplay } from "../../../composables/use-user-display";
import type { FriendContext } from "../../../stores/friend-types";

import Location from "../../../components/Location.vue";
import UserContextMenu from "../../../components/UserContextMenu.vue";
import { showUserDialog } from "../../../coordinators/user-coordinator";

const { userImage, userStatusClass } = useUserDisplay();

const props = withDefaults(
  defineProps<{
    friend: FriendContext;
    cardScale?: number;
    displayInstanceInfo?: boolean;
    showCosmetics?: boolean;
    cardSpacing?: number;
  }>(),
  {
    cardScale: 1,
    displayInstanceInfo: true,
    showCosmetics: true,
    cardSpacing: 1,
  }
);

const STATUS_DOT_FLAGS = ["online", "active-joinme", "active-askme", "active-busy", "active", "joinme", "askme", "busy", "offline"];

const cardStyle = computed(() => ({
  "--card-scale": props.cardScale,
  "--card-spacing": props.cardSpacing,
  "--card-padding": `${8 * props.cardScale}px`,
  "--card-padding-bottom": `${6 * props.cardScale}px`,
}));

const statusDotClass = computed(() => {
  const status = userStatusClass(props.friend.ref, props.friend.pendingOffline);
  const activeFlag = STATUS_DOT_FLAGS.find((flag) => status?.[flag]);

  return activeFlag ? `friend-card-status-dot-${activeFlag}` : "friend-card-status-dot-hidden";
});
</script>

<style scoped>
.friend-card {
  --card-scale: 1;
  --card-spacing: 1;
  --card-padding: 8px;
  --card-padding-bottom: 6px;

  gap: calc(14px * var(--card-scale) * var(--card-spacing));
  max-width: var(--friend-card-target-width, 220px);
  min-width: var(--friend-card-min-width, 220px);
  padding: var(--card-padding);
  padding-bottom: var(--card-padding-bottom);
}

.friend-card-header {
  grid-template-columns: auto minmax(0, 1fr);
  gap: calc(10px * var(--card-scale) * var(--card-spacing));
  padding-top: calc(3px * var(--card-scale));
  padding-left: calc(4px * var(--card-scale));
}

.friend-card-status-dot {
  top: calc(16px * var(--card-scale));
  right: calc(16px * var(--card-scale));
  inline-size: calc(12px * var(--card-scale));
  block-size: calc(12px * var(--card-scale));
}

.friend-card-status-dot-hidden {
  display: none;
}

.friend-card-status-dot-online {
  background: var(--status-online);
  box-shadow: 0 0 calc(8px * var(--card-scale)) color-mix(in oklch, var(--status-online) 40%, transparent);
}

.friend-card-status-dot-active {
  background: transparent;
  border: calc(2px * var(--card-scale)) solid var(--status-online);
  box-shadow: 0 0 calc(8px * var(--card-scale)) color-mix(in oklch, var(--status-online) 40%, transparent);
}

.friend-card-status-dot-active-joinme {
  background: transparent;
  border: calc(2px * var(--card-scale)) solid var(--status-joinme);
  box-shadow: 0 0 calc(8px * var(--card-scale)) color-mix(in oklch, var(--status-joinme) 40%, transparent);
}

.friend-card-status-dot-active-askme {
  background: transparent;
  border: calc(2px * var(--card-scale)) solid var(--status-askme);
  box-shadow: 0 0 calc(8px * var(--card-scale)) color-mix(in oklch, var(--status-askme) 40%, transparent);
}

.friend-card-status-dot-active-busy {
  background: transparent;
  border: calc(2px * var(--card-scale)) solid var(--status-busy);
  box-shadow: 0 0 calc(8px * var(--card-scale)) color-mix(in oklch, var(--status-busy) 40%, transparent);
}

.friend-card-status-dot-joinme {
  background: var(--status-joinme);
  box-shadow: 0 0 calc(8px * var(--card-scale)) color-mix(in oklch, var(--status-joinme) 40%, transparent);
}

.friend-card-status-dot-busy {
  background: var(--status-busy);
  box-shadow: 0 0 calc(8px * var(--card-scale)) color-mix(in oklch, var(--status-busy) 40%, transparent);
}

.friend-card-status-dot-askme {
  background: var(--status-askme);
  box-shadow: 0 0 calc(8px * var(--card-scale)) color-mix(in oklch, var(--status-askme) 40%, transparent);
}

.friend-card-status-dot-offline {
  background: var(--status-offline-card);
}

.friend-card-body {
  gap: calc(8px * var(--card-scale) * var(--card-spacing));
}

.friend-card-name {
  font-size: calc(0.8125rem * var(--card-scale));
}

.friend-card-signature {
  font-size: calc(0.75rem * var(--card-scale));
  padding: calc(7px * var(--card-scale)) calc(8px * var(--card-scale));
  line-height: 1.4;
  gap: calc(4px * var(--card-scale));
}

.friend-card-signature :deep(svg) {
  margin-top: calc(1px * var(--card-scale));
}

.friend-card-world {
  min-height: calc(24px * var(--card-scale));
  padding: calc(7px * var(--card-scale)) calc(8px * var(--card-scale));
  border-radius: calc(var(--radius-lg) * var(--card-scale));
  font-size: calc(0.75rem * var(--card-scale));
  line-height: 1.3;
}

.friend-card-location {
  max-height: calc(36px * var(--card-scale));
  white-space: normal;
}

.friend-card-location :deep(.flags) {
  scale: calc(1 * var(--card-scale));
  filter: brightness(1.05);
}
</style>
