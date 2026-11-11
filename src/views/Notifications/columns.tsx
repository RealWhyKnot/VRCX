import { storeToRefs } from "pinia";
import { checkCanInvite } from "../../shared/utils/invite";
import { useGameStore } from "../../stores/game";
import { useInstanceStore } from "../../stores/instance";
import { useLocationStore } from "../../stores/location";
import { useNotificationStore } from "../../stores/notification";
import { useUiStore } from "../../stores/ui";
import { useUserStore } from "../../stores/user";
import type { VrcxColumn } from "../FriendList/vrcx-column";
import { createActionColumn } from "./notification-action-column";
import { createDateColumn, createTypeColumn } from "./notification-date-type-columns";
import { createGroupColumn, createSenderColumn } from "./notification-sender-group-columns";
import { createMessageColumn, createPhotoColumn } from "./notification-photo-message-columns";
import type { NotificationColumnDeps, NotificationColumnHandlers, NotificationRow } from "./notification-column-types";

export const createColumns = (handlers: NotificationColumnHandlers): VrcxColumn<NotificationRow>[] => {
  const { showSendBoopDialog } = useUserStore();

  const { shiftHeld } = storeToRefs(useUiStore());
  const { currentUser } = storeToRefs(useUserStore());
  const { lastLocation } = storeToRefs(useLocationStore());
  const { isGameRunning } = storeToRefs(useGameStore());
  const { isNotificationExpired } = useNotificationStore();

  const { cachedInstances } = useInstanceStore();

  const canInvite = () => {
    const location = lastLocation.value.location;
    return (
      Boolean(location) &&
      isGameRunning.value &&
      checkCanInvite(location, {
        currentUserId: currentUser.value.id,
        lastLocationStr: lastLocation.value.location,
        cachedInstances: cachedInstances,
      })
    );
  };

  const deps: NotificationColumnDeps = {
    ...handlers,
    currentUser,
    shiftHeld,
    canInvite,
    isNotificationExpired,
    showSendBoopDialog,
  };

  return [
    {
      id: "spacer",
      header: () => null,
      enableSorting: false,
      size: 20,
      minSize: 0,
      maxSize: 20,
      cell: () => null,
    },
    createDateColumn(deps),
    createTypeColumn(deps),
    createSenderColumn(deps),
    createGroupColumn(deps),
    createPhotoColumn(deps),
    createMessageColumn(),
    createActionColumn(deps),
    {
      id: "trailing",
      header: () => null,
      enableSorting: false,
      enableResizing: false,
      size: 5,
      cell: () => null,
    },
  ];
};
