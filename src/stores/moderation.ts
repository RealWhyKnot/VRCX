import { reactive, ref, watch } from "vue";
import { defineStore } from "pinia";
import type { ModerateUserRequest, PlayerModeration, SubmitModerationReportRequest } from "vrchat";

import { runRefreshPlayerModerationsFlow } from "../coordinators/moderation-coordinator";
import type { Json, Moderations, TableFilter, VrcxUser } from "../types/vrcx";
import { useUserStore } from "./user";
import { watchState } from "../services/watch-state";

export type PlayerModerationEntry = Omit<Json<PlayerModeration>, "type"> & {
  type: string;
  $isExpired: boolean;
};

export type ModerationReportType = SubmitModerationReportRequest["type"];

export type ModerationReportDetails = NonNullable<SubmitModerationReportRequest["details"]>;

export type ModerationReportDialog = {
  visible: boolean;
  type: ModerationReportType;
  contentId: string;
  contentName: string;
  details: ModerationReportDetails | undefined;
};

export type PlayerModerationTable = {
  data: PlayerModerationEntry[];
  search: string;
  loading: boolean;
  filters: TableFilter<PlayerModerationEntry, string | string[]>[];
  pageSize: number;
  pageSizeLinked: boolean;
};

function isCachedUser(value: unknown): value is VrcxUser {
  return typeof value === "object" && value !== null;
}

export const useModerationStore = defineStore("Moderation", () => {
  const userStore = useUserStore();

  const cachedPlayerModerations = reactive(new Map<string, PlayerModerationEntry>());
  const cachedPlayerModerationsUserIds = reactive(new Set<string>());
  const moderationReportDialog = ref<ModerationReportDialog>({
    visible: false,
    type: "",
    contentId: "",
    contentName: "",
    details: undefined,
  });
  const playerModerationTable = ref<PlayerModerationTable>({
    data: [],
    search: "",
    loading: false,
    filters: [
      {
        prop: "type",
        value: [],
      },
      {
        prop: ["sourceDisplayName", "targetDisplayName"],
        value: "",
      },
    ],
    pageSize: 20,
    pageSizeLinked: true,
  });

  watch(
    () => watchState.isLoggedIn,
    (isLoggedIn) => {
      cachedPlayerModerations.clear();
      cachedPlayerModerationsUserIds.clear();
      playerModerationTable.value.loading = false;
      playerModerationTable.value.data = [];
      if (isLoggedIn) {
        runRefreshPlayerModerationsFlow().catch((err: unknown) => console.error(err));
      }
    },
    { flush: "sync" }
  );

  function handlePlayerModerationAtDelete(entry: PlayerModerationEntry) {
    const hasModeration = cachedPlayerModerations.size > 0;
    if (!hasModeration) {
      cachedPlayerModerationsUserIds.delete(entry.targetUserId);
    }

    const userRef: unknown = userStore.cachedUsers.get(entry.targetUserId);
    if (isCachedUser(userRef)) {
      userRef.$moderations = getUserModerations(entry.targetUserId);
    }

    const array = playerModerationTable.value.data;
    const index = array.findIndex((item) => item.id === entry.id);
    if (index !== -1) {
      array.splice(index, 1);
    }

    const userDialog = userStore.userDialog;
    if (!userDialog.visible || entry.targetUserId !== userDialog.id || entry.sourceUserId !== userStore.currentUser.id) {
      return;
    }
    if (entry.type === "block") {
      userDialog.isBlock = false;
    } else if (entry.type === "mute") {
      userDialog.isMute = false;
    } else if (entry.type === "hideAvatar") {
      userDialog.isHideAvatar = false;
    } else if (entry.type === "interactOff") {
      userDialog.isInteractOff = false;
    } else if (entry.type === "muteChat") {
      userDialog.isMuteChat = false;
    }
  }

  function handlePlayerModerationDelete(args: { params: Pick<ModerateUserRequest, "type" | "moderated"> }) {
    const { type, moderated } = args.params;
    const userId = userStore.currentUser.id;
    for (const entry of cachedPlayerModerations.values()) {
      if (entry.type === type && entry.targetUserId === moderated && entry.sourceUserId === userId) {
        cachedPlayerModerations.delete(entry.id);
        handlePlayerModerationAtDelete(entry);
        break;
      }
    }
  }

  function applyPlayerModeration(json: Json<PlayerModeration>) {
    let entry = cachedPlayerModerations.get(json.id);
    if (typeof entry === "undefined") {
      entry = {
        $isExpired: false,
        ...json,
      };
      cachedPlayerModerations.set(entry.id, entry);
    } else {
      Object.assign(entry, json);
      entry.$isExpired = false;
    }
    if (json.targetUserId) {
      cachedPlayerModerationsUserIds.add(json.targetUserId);
    }
    const array = playerModerationTable.value.data;
    const index = array.findIndex((item) => item.id === entry.id);
    if (index !== -1) {
      array[index] = entry;
    } else {
      array.push(entry);
    }
    const userRef: unknown = userStore.cachedUsers.get(entry.targetUserId);
    if (isCachedUser(userRef)) {
      userRef.$moderations = getUserModerations(entry.targetUserId);
    }
    return entry;
  }

  function expirePlayerModerations() {
    cachedPlayerModerationsUserIds.clear();
    for (const entry of cachedPlayerModerations.values()) {
      entry.$isExpired = true;
    }
  }

  function deleteExpiredPlayerModerations() {
    for (const entry of cachedPlayerModerations.values()) {
      if (!entry.$isExpired) {
        continue;
      }
      handlePlayerModerationAtDelete(entry);
    }
  }

  function getUserModerations(userId: string): Moderations {
    const moderations: Moderations = {
      isBlocked: false,
      isMuted: false,
      isAvatarInteractionDisabled: false,
      isChatBoxMuted: false,
    };
    for (const entry of cachedPlayerModerations.values()) {
      if (entry.targetUserId !== userId) {
        continue;
      }
      switch (entry.type) {
        case "block":
          moderations.isBlocked = true;
          break;
        case "mute":
          moderations.isMuted = true;
          break;
        case "interactOff":
          moderations.isAvatarInteractionDisabled = true;
          break;
        case "muteChat":
          moderations.isChatBoxMuted = true;
          break;
      }
    }
    return moderations;
  }

  function showModerationReportDialog({
    type,
    contentId,
    contentName = "",
    details,
  }: {
    type: ModerationReportType;
    contentId: string;
    contentName?: string;
    details?: ModerationReportDetails;
  }) {
    moderationReportDialog.value = {
      visible: true,
      type,
      contentId,
      contentName,
      details,
    };
  }

  return {
    cachedPlayerModerations,
    cachedPlayerModerationsUserIds,
    playerModerationTable,
    moderationReportDialog,

    showModerationReportDialog,

    expirePlayerModerations,
    deleteExpiredPlayerModerations,
    applyPlayerModeration,
    handlePlayerModerationDelete,
    getUserModerations,
  };
});
