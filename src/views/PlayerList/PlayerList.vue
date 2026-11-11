<template>
  <div ref="playerListRef" class="x-container x-container-auto-height">
    <div class="flex h-full min-h-0 flex-col overflow-y-auto overflow-x-hidden">
      <div v-if="currentInstanceWorld.ref.id" ref="playerListHeaderRef" class="mb-7 flex min-h-[120px]">
        <img
          v-if="!worldImageError"
          :src="currentInstanceWorld.ref.thumbnailImageUrl"
          class="cursor-pointer flex-none w-[160px] h-[120px] rounded-(--radius-md)"
          loading="lazy"
          @click="showCurrentWorldImage"
          @error="worldImageError = true"
        />
        <div v-else class="flex items-center justify-center bg-muted flex-none w-[160px] h-[120px] rounded-(--radius-md)">
          <Image class="size-8 text-muted-foreground" />
        </div>
        <div class="ml-2 flex flex-col min-w-[320px] w-full">
          <div class="flex items-center">
            <span
              class="cursor-pointer overflow-hidden text-ellipsis [font-weight:bold] [display:-webkit-box] [-webkit-box-orient:vertical] [line-clamp:1]"
              @click="showCurrentWorldDialog"
            >
              <Home v-if="currentUser.$homeLocation && currentUser.$homeLocation.worldId === currentInstanceWorld.ref.id" class="inline-block" />
              {{ currentInstanceWorld.ref.name || currentInstanceWorld.ref.id }}
            </span>
          </div>
          <div>
            <span
              class="cursor-pointer x-grey font-mono"
              @click="showUserDialog(currentInstanceWorld.ref.authorId)"
              v-text="currentInstanceWorld.ref.authorName || currentInstanceWorld.ref.authorId"
            ></span>
          </div>
          <div class="mt-1.5">
            <Badge v-if="currentInstanceWorld.ref.$isLabs" class="mr-1.5" variant="outline">
              {{ t("dialog.world.tags.labs") }}
            </Badge>
            <Badge v-else-if="currentInstanceWorld.ref.releaseStatus === 'public'" class="mr-1.5" variant="outline">
              {{ t("dialog.world.tags.public") }}
            </Badge>
            <Badge v-else-if="currentInstanceWorld.ref.releaseStatus === 'private'" class="mr-1.5" variant="outline">
              {{ t("dialog.world.tags.private") }}
            </Badge>
            <TooltipWrapper v-if="currentInstanceWorld.isPC" side="top" content="PC">
              <Badge class="text-platform-pc border-platform-pc! mr-1.5" variant="outline"
                ><Monitor class="h-4 w-4" />
                <span v-if="readFileSize('standalonewindows')" class="x-grey text-platform-pc border-l-[0.8px] border-solid ml-1.5 pl-1.5 pb-px">{{
                  readFileSize("standalonewindows")
                }}</span>
              </Badge>
            </TooltipWrapper>
            <TooltipWrapper v-if="currentInstanceWorld.isQuest" side="top" content="Android">
              <Badge class="text-platform-quest border-platform-quest! mr-1.5" variant="outline"
                ><Smartphone class="h-4 w-4" />
                <span v-if="readFileSize('android')" class="x-grey text-platform-quest border-l-[0.8px] border-solid ml-1.5 pl-1.5 pb-px">{{
                  readFileSize("android")
                }}</span>
              </Badge>
            </TooltipWrapper>
            <TooltipWrapper v-if="currentInstanceWorld.isIos" side="top" content="iOS">
              <Badge class="text-platform-ios border-platform-ios mr-1.5" variant="outline"
                ><Apple class="h-4 w-4 text-platform-ios" />
                <span v-if="readFileSize('ios')" class="x-grey text-platform-ios border-platform-ios border-l-[0.8px] border-solid ml-1.5 pl-1.5 pb-px">{{
                  readFileSize("ios")
                }}</span>
              </Badge>
            </TooltipWrapper>
            <Badge v-if="currentInstanceWorld.avatarScalingDisabled" class="mr-1.5 mt-1.5" variant="outline">
              {{ t("dialog.world.tags.avatar_scaling_disabled") }}
            </Badge>
            <Badge v-if="currentInstanceWorld.inCache" class="mr-1.5" variant="outline">
              <span>{{ currentInstanceWorld.cacheSize }} {{ t("dialog.world.tags.cache") }}</span>
            </Badge>
          </div>
          <div class="mt-1.5">
            <LocationWorld :locationobject="currentInstanceLocation" :currentuserid="currentUser.id" class="w-fit" />
            <span v-if="lastLocation.playerList.size > 0" class="ml-1.5">
              {{ lastLocation.playerList.size }}
              <template v-if="lastLocation.friendList.size > 0">({{ lastLocation.friendList.size }})</template>
              &nbsp;&horbar; <Timer v-if="lastLocation.date" :epoch="lastLocation.date" />
            </span>
          </div>
          <div class="mt-1.5">
            <span
              v-show="currentInstanceWorld.ref.name !== currentInstanceWorld.ref.description"
              class="inline-block max-w-full align-middle text-xs break-words"
              v-text="currentInstanceWorld.ref.description"
            ></span>
          </div>
        </div>
        <div class="ml-5 flex flex-col">
          <div class="box-border flex items-center p-1.5 text-[13px] cursor-default">
            <div class="flex-1 overflow-hidden">
              <span class="block truncate font-medium leading-[18px]">{{ t("dialog.world.info.capacity") }}</span>
              <span class="block truncate text-xs"
                >{{ commaNumber(currentInstanceWorld.ref.recommendedCapacity) }} ({{ commaNumber(currentInstanceWorld.ref.capacity) }})</span
              >
            </div>
          </div>
          <div class="box-border flex items-center p-1.5 text-[13px] cursor-default">
            <div class="flex-1 overflow-hidden">
              <span class="block truncate font-medium leading-[18px]">{{ t("dialog.world.info.last_updated") }}</span>
              <span class="block truncate text-xs">{{ formatDateFilter(readFileCreatedAt("standalonewindows"), "long") }}</span>
            </div>
          </div>
          <div class="box-border flex items-center p-1.5 text-[13px] cursor-default">
            <div class="flex-1 overflow-hidden">
              <span class="block truncate font-medium leading-[18px]">{{ t("dialog.world.info.created") }}</span>
              <span class="block truncate text-xs">{{ formatDateFilter(currentInstanceWorld.ref.created_at, "long") }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="photonLoggingEnabled" ref="playerListPhotonRef" class="mb-2">
        <PhotonEventTable @show-chatbox-blacklist="showChatboxBlacklistDialog" />
      </div>

      <div class="current-instance-table flex min-h-0 min-w-0 flex-1">
        <DataTableLayout
          class="[&_th]:px-2.5! [&_th]:py-0.75! [&_td]:px-2.5! [&_td]:py-0.75! [&_tr]:h-7!"
          :table="playerListTable"
          auto-height
          :loading="false"
          :show-pagination="false"
          :on-row-click="handlePlayerListRowClick"
        />
      </div>
    </div>
    <ChatboxBlacklistDialog
      :chatbox-blacklist-dialog="chatboxBlacklistDialog"
      @delete-chatbox-user-blacklist="deleteChatboxUserBlacklist"
      @update-open="setChatboxBlacklistOpen"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from "vue";
import { Apple, Home, Image, Monitor, Smartphone } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import { useAppearanceSettingsStore } from "../../stores/settings/appearance";
import { useGalleryStore } from "../../stores/gallery";
import { useInstanceStore } from "../../stores/instance";
import { useLocationStore } from "../../stores/location";
import { usePhotonStore } from "../../stores/photon";
import { useUserStore } from "../../stores/user";
import { commaNumber } from "../../shared/utils/base/string";
import { formatDateFilter } from "../../coordinators/date-coordinator";
import Badge from "../../components/ui/badge/Badge.vue";
import DataTableLayout from "../../components/ui/data-table/DataTableLayout.vue";
import { createColumns, type PlayerListRow } from "./columns.tsx";
import { useVrcxVueTable } from "../../lib/table/use-vrcx-vue-table";
import { logFailure } from "../../stores/log-failure";
import type { InstanceUserEntry } from "../../stores/instance-types";

import ChatboxBlacklistDialog from "./dialogs/ChatboxBlacklistDialog.vue";
import Timer from "../../components/Timer.vue";
import { showUserDialog, lookupUser } from "../../coordinators/user-coordinator";
import { showWorldDialog } from "../../coordinators/world-coordinator";
import { toUserRef } from "../GameLog/columns.tsx";

import PhotonEventTable from "./components/PhotonEventTable.vue";
import { useUserDisplay } from "../../composables/use-user-display";

const { randomUserColours } = storeToRefs(useAppearanceSettingsStore());
const { userImage } = useUserDisplay();
const photonStore = usePhotonStore();
const { photonLoggingEnabled, chatboxUserBlacklist } = storeToRefs(photonStore);
const { saveChatboxUserBlacklist } = photonStore;

const { lastLocation } = storeToRefs(useLocationStore());
const { currentInstanceLocation, currentInstanceWorld, currentInstanceUsersData } = storeToRefs(useInstanceStore());

const worldImageError = ref(false);

watch(
  () => currentInstanceWorld.value.ref.id,
  () => {
    worldImageError.value = false;
  }
);
const { getCurrentInstanceUserList } = useInstanceStore();
const { showFullscreenImageDialog } = useGalleryStore();
const { currentUser } = storeToRefs(useUserStore());

const { t } = useI18n();

const chatboxBlacklistDialog = ref({
  visible: false,
  loading: false,
});

function readFileAnalysisEntry(platform: string): object | undefined {
  const entry: unknown = currentInstanceWorld.value.fileAnalysis[platform];
  if (typeof entry !== "object" || entry === null) return undefined;
  return entry;
}

function readFileSize(platform: string): unknown {
  const entry = readFileAnalysisEntry(platform);
  if (!entry || !("_fileSize" in entry)) return undefined;
  return entry._fileSize;
}

function readFileCreatedAt(platform: string): string | undefined {
  const entry = readFileAnalysisEntry(platform);
  if (!entry || !("created_at" in entry)) return undefined;
  return typeof entry.created_at === "string" ? entry.created_at : undefined;
}

function showCurrentWorldImage() {
  const imageUrl = currentInstanceWorld.value.ref.imageUrl;
  if (imageUrl) showFullscreenImageDialog(imageUrl, "");
}

function showCurrentWorldDialog() {
  const worldId = currentInstanceWorld.value.ref.id;
  if (worldId) showWorldDialog(worldId);
}

function setChatboxBlacklistOpen(isOpen: boolean) {
  chatboxBlacklistDialog.value.visible = isOpen;
}

function showChatboxBlacklistDialog() {
  const D = chatboxBlacklistDialog.value;
  D.visible = true;
}

function selectCurrentInstanceRow(row: InstanceUserEntry | null) {
  if (row === null) {
    return;
  }
  const userRef = row.ref;
  if (userRef.id) {
    showUserDialog(userRef.id);
  } else {
    void lookupUser(toUserRef({ userId: userRef.id, displayName: userRef.displayName })).catch(logFailure("Failed to look up user:"));
  }
}

function deleteChatboxUserBlacklist(userId: string) {
  chatboxUserBlacklist.value.delete(userId);
  void saveChatboxUserBlacklist()
    .then(() => getCurrentInstanceUserList())
    .catch(logFailure("Failed to save chatbox user blacklist:"));
}

function addChatboxUserBlacklist(userId: string, displayName: string) {
  chatboxUserBlacklist.value.set(userId, displayName);
  void saveChatboxUserBlacklist()
    .then(() => getCurrentInstanceUserList())
    .catch(logFailure("Failed to save chatbox user blacklist:"));
}

function sortAlphabetically(a: string | undefined, b: string | undefined) {
  if (!a || !b) return 0;
  return a.toLowerCase().localeCompare(b.toLowerCase());
}

const playerListColumns = computed(() =>
  createColumns({
    randomUserColours,
    chatboxUserBlacklist,
    onBlockChatbox: addChatboxUserBlacklist,
    onUnblockChatbox: deleteChatboxUserBlacklist,
    sortAlphabetically,
    userImage,
  })
);

const { table: playerListTable } = useVrcxVueTable<PlayerListRow>({
  persistKey: "playerList",
  get data() {
    return currentInstanceUsersData.value;
  },
  columns: playerListColumns,
  enablePagination: false,
  getRowId: (row) => `${row.ref.id ?? ""}:${row.displayName}`,
});

watch(
  playerListColumns,
  (next) => {
    playerListTable.setOptions((prev) => ({
      ...prev,
      columns: next,
    }));
  },
  { immediate: true }
);

watch(
  photonLoggingEnabled,
  (isEnabled) => {
    const column = playerListTable.getColumn("photonId");
    if (!column) {
      return;
    }
    column.toggleVisibility(isEnabled);
  },
  { immediate: true }
);

const handlePlayerListRowClick = (row: { original: PlayerListRow } | undefined) => {
  selectCurrentInstanceRow(row?.original ?? null);
};

onMounted(() => {
  getCurrentInstanceUserList();
});

onActivated(() => {
  getCurrentInstanceUserList();
});
</script>
