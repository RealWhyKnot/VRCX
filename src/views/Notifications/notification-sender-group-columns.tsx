import { notificationName } from "@/shared/utils/notification-message";
import { showGroupDialog } from "../../coordinators/group-dialog-coordinator";
import { showUserDialog } from "../../coordinators/user-coordinator";
import type { VrcxColumn } from "../FriendList/vrcx-column";
import { firstNonEmpty, isGroupId, t, textOf } from "./notification-column-helpers";
import type { NotificationColumnDeps, NotificationRow } from "./notification-column-types";

export const createSenderColumn = ({ openNotificationLink }: NotificationColumnDeps): VrcxColumn<NotificationRow> => ({
  accessorKey: "senderUsername",
  meta: {
    class: "overflow-hidden",
    label: () => t("table.notification.user"),
  },
  size: 150,
  header: () => t("table.notification.user"),
  cell: ({ row }) => {
    const original = row.original;
    const inviter = original.type === "group.invite" ? notificationName(original, "managerUserDisplayName") : undefined;
    if (inviter) {
      return (
        <span class="table-user-text block w-full min-w-0 truncate" title={inviter}>
          {inviter}
        </span>
      );
    }
    const senderName = (original.type === "boop" ? notificationName(original, "boopingUserDisplayName") : undefined) ?? original.senderUsername;
    if (original.senderUserId && !isGroupId(original.senderUserId)) {
      return (
        <span class="table-user-text block w-full min-w-0 truncate">
          <span class="cursor-pointer block w-full min-w-0 truncate" title={senderName} onClick={() => showUserDialog(original.senderUserId)}>
            {senderName}
          </span>
        </span>
      );
    }

    if (original.link?.startsWith("user:")) {
      return (
        <span class="table-user-text block w-full min-w-0 truncate">
          <span
            class="cursor-pointer block w-full min-w-0 truncate"
            title={firstNonEmpty(original.linkText, senderName)}
            onClick={() => openNotificationLink(original.link)}
          >
            {firstNonEmpty(original.linkText, senderName)}
          </span>
        </span>
      );
    }

    if (senderName && !isGroupId(original.senderUserId)) {
      return (
        <span class="table-user-text block w-full min-w-0 truncate" title={senderName}>
          {senderName}
        </span>
      );
    }

    return null;
  },
});

export const createGroupColumn = ({ openNotificationLink }: NotificationColumnDeps): VrcxColumn<NotificationRow> => ({
  accessorKey: "groupName",
  meta: {
    class: "overflow-hidden",
    label: () => t("table.notification.group"),
  },
  size: 150,
  header: () => t("table.notification.group"),
  cell: ({ row }) => {
    const original = row.original;
    const dataGroupName = textOf(original.data, "groupName");
    const detailsGroupName = textOf(original.details, "groupName");
    const label = firstNonEmpty(original.senderUsername, original.groupName, dataGroupName, detailsGroupName, original.linkText);

    if (original.senderUserId && (original.type === "groupChange" || isGroupId(original.senderUserId))) {
      return (
        <span class="table-user-text block w-full min-w-0 truncate">
          <span class="cursor-pointer block w-full min-w-0 truncate" title={label} onClick={() => showGroupDialog(original.senderUserId ?? "")}>
            {label}
          </span>
        </span>
      );
    }

    if (original.type === "groupChange" && original.senderUsername) {
      return (
        <span class="table-user-text block w-full min-w-0 truncate" title={original.senderUsername}>
          {original.senderUsername}
        </span>
      );
    }

    if (original.link?.startsWith("group:")) {
      return (
        <span class="table-user-text block w-full min-w-0 truncate">
          <span
            class="cursor-pointer block w-full min-w-0 truncate"
            title={firstNonEmpty(dataGroupName, label)}
            onClick={() => openNotificationLink(original.link)}
          >
            {firstNonEmpty(dataGroupName, label)}
          </span>
        </span>
      );
    }

    if (original.link?.startsWith("event:")) {
      return (
        <span class="table-user-text block w-full min-w-0 truncate">
          <span
            class="cursor-pointer block w-full min-w-0 truncate"
            title={firstNonEmpty(dataGroupName, original.groupName, label)}
            onClick={() => openNotificationLink(original.link)}
          >
            {firstNonEmpty(dataGroupName, original.groupName, label)}
          </span>
        </span>
      );
    }

    if (dataGroupName) {
      return (
        <span class="table-user-text block w-full min-w-0 truncate" title={dataGroupName}>
          {dataGroupName}
        </span>
      );
    }

    if (detailsGroupName) {
      return (
        <span class="table-user-text block w-full min-w-0 truncate" title={detailsGroupName}>
          {detailsGroupName}
        </span>
      );
    }

    if (original.groupName) {
      return (
        <span class="table-user-text block w-full min-w-0 truncate" title={original.groupName}>
          {original.groupName}
        </span>
      );
    }

    return null;
  },
});
