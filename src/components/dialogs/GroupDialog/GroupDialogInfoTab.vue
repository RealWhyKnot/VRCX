<template>
  <div v-if="groupDialog.instances.length" class="rounded-xl bg-(--profile-card) p-3 mb-2.5">
    <div class="flex justify-between items-start mb-2 pb-2 border-b border-border">
      <div class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {{ t("dialog.world.instances.header") }}
      </div>
    </div>
    <div v-for="room in groupDialog.instances" :key="room.tag" class="flex flex-col gap-2 mb-4">
      <div class="flex flex-wrap gap-2 whitespace-nowrap overflow-hidden text-ellipsis">
        <Location :location="room.tag" exclude-group-name class="text-sm text-muted-foreground rounded-full border py-0.5 px-2" />
        <InstanceActionBar
          class="text-sm"
          :location="room.tag"
          :currentlocation="lastLocation.location"
          :instance="room.ref"
          :friendcount="room.friendCount"
          refresh-tooltip="Refresh player count"
          :on-refresh="() => refreshInstancePlayerCount(room.tag)"
        />
      </div>
      <div v-if="room.users.length" class="flex flex-wrap items-start max-h-[150px] overflow-auto">
        <div
          v-for="user in room.users"
          :key="user.id"
          class="box-border flex items-center p-1.5 text-[13px] cursor-pointer w-[167px] hover:rounded-[25px_5px_5px_25px]"
          @click="showUserDialog(user.id)"
        >
          <div class="relative inline-block flex-none size-9 mr-2.5" :class="userStatusClass(user)">
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
              class="block truncate font-medium leading-[18px] text-[color:var(--user-colour)]"
              :style="{ '--user-colour': user.$userColour }"
              v-text="user.displayName || user.id"
            />
            <span v-if="user.location === 'traveling'" class="block truncate text-xs">
              <Spinner class="inline-block mr-1" />
              <Timer :epoch="user.$travelingToTime" />
            </span>
            <span v-else class="block truncate text-xs">
              <Timer :epoch="user.$location_at" />
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="flex flex-col gap-2.5">
    <div class="rounded-xl bg-(--profile-card) p-3">
      <div class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2 pb-2 border-b border-border">
        {{ t("dialog.group.info.header") }}
      </div>
      <pre class="text-xs font-[inherit] whitespace-pre-wrap max-h-[210px] overflow-y-auto">{{ groupDialog.ref.description || "—" }}</pre>
    </div>

    <div class="rounded-xl bg-(--profile-card) p-3">
      <div class="flex items-center justify-between mb-2 pb-2 border-b border-border">
        <span class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {{ t("dialog.group.info.announcement") }}
        </span>
        <div v-if="groupDialog.announcement.id && hasGroupPermission(groupDialog.ref, 'group-announcement-manage')" class="flex gap-1">
          <Button
            class="h-5 w-5 text-muted-foreground"
            size="icon-sm"
            variant="ghost"
            @click="showGroupPostEditDialog(groupDialog.id, groupDialog.announcement)"
          >
            <Pencil class="h-3 w-3" />
          </Button>
          <Button class="h-5 w-5 text-muted-foreground" size="icon-sm" variant="ghost" @click="confirmDeleteGroupPost(groupDialog.announcement)">
            <Trash2 class="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div v-if="groupDialog.announcement.id">
        <div v-if="groupDialog.announcement.title" class="text-xs font-medium mb-1">
          {{ groupDialog.announcement.title }}
        </div>
        <div v-if="groupDialog.announcement.imageUrl" class="mb-2">
          <img
            v-if="!announcementPhotoError"
            :src="groupDialog.announcement.imageUrl"
            class="cursor-pointer rounded-md object-cover w-[60px] h-[60px]"
            loading="lazy"
            @click="showFullscreenImageDialog(groupDialog.announcement.imageUrl)"
            @error="announcementPhotoError = true"
          />
          <div v-else class="flex items-center justify-center bg-muted rounded-md w-[60px] h-[60px]">
            <Image class="size-5 text-muted-foreground" />
          </div>
        </div>
        <pre class="text-xs font-[inherit] whitespace-pre-wrap">{{ groupDialog.announcement.text }}</pre>
        <div class="flex flex-row justify-end gap-2 mt-2 text-xs text-muted-foreground">
          <TooltipWrapper v-if="groupDialog.announcement.roleIds?.length" side="top">
            <template #content>
              <span>{{ t("dialog.group.posts.visibility") }}</span>
              <br />
              <template v-for="roleId in groupDialog.announcement.roleIds" :key="roleId">
                <template v-for="role in groupDialog.ref.roles" :key="roleId + role.id">
                  <span v-if="role.id === roleId" v-text="role.name" />
                </template>
                <span v-if="groupDialog.announcement.roleIds.indexOf(roleId) < groupDialog.announcement.roleIds.length - 1"> ,&nbsp; </span>
              </template>
            </template>
            <Eye class="h-3 w-3" />
          </TooltipWrapper>
          <DisplayName :userid="groupDialog.announcement.authorId" />
          <span v-if="groupDialog.announcement.editorId">
            ({{ t("dialog.group.posts.edited_by") }} <DisplayName :userid="groupDialog.announcement.editorId" />)
          </span>
          <TooltipWrapper side="bottom">
            <template #content>
              <span>
                {{ t("dialog.group.posts.created_at") }}
                {{ formatDateFilter(groupDialog.announcement.createdAt, "long") }}
              </span>
              <template v-if="groupDialog.announcement.updatedAt !== groupDialog.announcement.createdAt">
                <br />
                <span>
                  {{ t("dialog.group.posts.edited_at") }}
                  {{ formatDateFilter(groupDialog.announcement.updatedAt, "long") }}
                </span>
              </template>
            </template>
            <Timer :epoch="Date.parse(groupDialog.announcement.updatedAt ?? '')" />
          </TooltipWrapper>
        </div>
      </div>
      <pre v-else class="text-xs font-[inherit] text-muted-foreground">—</pre>
    </div>

    <div v-if="upcomingCalenderEvents.length" class="rounded-xl bg-(--profile-card) p-3">
      <div class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2 pb-2 border-b border-border">
        {{ t("dialog.group.info.upcoming_events") }}
      </div>
      <div v-if="upcomingCalenderEvents.length" class="flex flex-wrap gap-4 overflow-y-auto max-h-[360px] py-2.5">
        <GroupCalendarEventCard
          v-for="value in upcomingCalenderEvents"
          :key="value.id"
          :event="value"
          :is-following="value.userInterest?.isFollowing ?? false"
          mode="grid"
          card-class="group-dialog-grid-card"
          @update-following-calendar-data="updateFollowingCalendarData"
        />
      </div>
      <span v-else class="text-xs text-muted-foreground">—</span>
    </div>

    <div v-if="pastCalenderEvents.length" class="rounded-xl bg-(--profile-card) p-3">
      <div class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2 pb-2 border-b border-border">
        {{ t("dialog.group.info.past_events") }}
      </div>
      <div v-if="pastCalenderEvents.length" class="flex flex-wrap gap-4 overflow-y-auto overflow-x-hidden max-h-[230px] py-2.5">
        <GroupCalendarEventCard
          v-for="value in pastCalenderEvents"
          :key="value.id"
          :event="value"
          :is-following="value.userInterest?.isFollowing ?? false"
          mode="grid"
          card-class="group-dialog-grid-card"
          @update-following-calendar-data="updateFollowingCalendarData"
        />
      </div>
      <span v-else class="text-xs text-muted-foreground">—</span>
    </div>

    <div class="rounded-xl bg-(--profile-card) p-3">
      <div class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2 pb-2 border-b border-border">
        {{ t("dialog.group.info.rules") }}
      </div>
      <pre class="text-xs font-[inherit] whitespace-pre-wrap max-h-[210px] overflow-y-auto">{{ groupDialog.ref.rules || "—" }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import Timer from "@/components/Timer.vue";
import Location from "@/components/Location.vue";
import { Eye, Image, Pencil, Trash2, User } from "lucide-vue-next";
import Avatar from "@/components/ui/avatar/Avatar.vue";
import AvatarFallback from "@/components/ui/avatar/AvatarFallback.vue";
import AvatarImage from "@/components/ui/avatar/AvatarImage.vue";
import IconFrame from "@/components/IconFrame.vue";
import Button from "@/components/ui/button/Button.vue";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import { ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import { formatDateFilter } from "../../../coordinators/date-coordinator";
import { hasGroupPermission } from "../../../shared/utils/group";
import { useUserDisplay } from "../../../composables/use-user-display";
import { refreshInstancePlayerCount } from "../../../coordinators/instance-coordinator";
import { useGalleryStore } from "../../../stores/gallery";
import { useGroupStore } from "../../../stores/group";
import { useLocationStore } from "../../../stores/location";
import { useGroupCalendarEvents } from "./use-group-calendar-events";

import GroupCalendarEventCard from "../../../views/Tools/components/GroupCalendarEventCard.vue";
import InstanceActionBar from "../../InstanceActionBar.vue";
import { showUserDialog } from "../../../coordinators/user-coordinator";
import type { GroupPostEntry } from "../../../stores/group-types";

defineProps<{
  showGroupPostEditDialog: (groupId: string, post: GroupPostEntry | null) => void;
  confirmDeleteGroupPost: (post: GroupPostEntry) => void;
}>();

const { t } = useI18n();
const { userImage, userStatusClass } = useUserDisplay();

const { groupDialog } = storeToRefs(useGroupStore());
const { lastLocation } = storeToRefs(useLocationStore());
const { showFullscreenImageDialog } = useGalleryStore();

const { pastCalenderEvents, upcomingCalenderEvents, updateFollowingCalendarData } = useGroupCalendarEvents(groupDialog);

const announcementPhotoError = ref(false);

watch(
  () => groupDialog.value.id,
  () => {
    announcementPhotoError.value = false;
  }
);
</script>
