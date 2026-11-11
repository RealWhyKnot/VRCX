import type { Ref } from "vue";
import type { NotificationEntry, NotificationResponse } from "../../stores/notification/types";
import type { CurrentUserState } from "../../stores/user-state";

export type NotificationRow = NotificationEntry & {
  link?: string | undefined;
  linkText?: string | undefined;
  groupName?: string | undefined;
  worldName?: string | undefined;
  responses?: NotificationResponse[] | undefined;
};

export type NotificationColumnHandlers = {
  getNotificationCreatedAt: (row: NotificationRow) => string;
  getNotificationCreatedAtTs: (row: NotificationRow) => number;
  openNotificationLink: (link: string | null | undefined) => void;
  showFullscreenImageDialog: (imageUrl: string) => void;
  getSmallThumbnailUrl: (url: string) => string;
  acceptFriendRequestNotification: (row: NotificationRow) => void;
  showSendInviteResponseDialog: (row: NotificationRow) => void;
  showSendInviteRequestResponseDialog: (row: NotificationRow) => void;
  acceptRequestInvite: (row: NotificationRow) => void;
  sendNotificationResponse: (notificationId: string, responses: NotificationResponse[], responseType: string) => void;
  hideNotification: (row: NotificationRow) => void;
  hideNotificationPrompt: (row: NotificationRow) => void;
  deleteNotificationLog: (row: NotificationRow) => void;
  deleteNotificationLogPrompt: (row: NotificationRow) => void;
};

export type NotificationColumnContext = {
  currentUser: Ref<CurrentUserState>;
  shiftHeld: Ref<boolean>;
  canInvite: () => boolean;
  isNotificationExpired: (notification: NotificationEntry) => boolean;
  showSendBoopDialog: (userId: string) => void;
};

export type NotificationColumnDeps = NotificationColumnHandlers & NotificationColumnContext;
