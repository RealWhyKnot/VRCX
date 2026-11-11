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
    if (original.senderUserId && !isGroupId(original.senderUserId)) {
      return (
        <span class="table-user-text block w-full min-w-0 truncate">
          <span class="cursor-pointer block w-full min-w-0 truncate" onClick={() => showUserDialog(original.senderUserId)}>
            {original.senderUsername}
          </span>
        </span>
      );
    }

    if (original.link?.startsWith("user:")) {
      return (
        <span class="table-user-text block w-full min-w-0 truncate">
          <span class="cursor-pointer block w-full min-w-0 truncate" onClick={() => openNotificationLink(original.link)}>
            {firstNonEmpty(original.linkText, original.senderUsername)}
          </span>
        </span>
      );
    }

    if (original.senderUsername && !isGroupId(original.senderUserId)) {
      return <span class="table-user-text block w-full min-w-0 truncate">{original.senderUsername}</span>;
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
          <span class="cursor-pointer block w-full min-w-0 truncate" onClick={() => showGroupDialog(original.senderUserId ?? "")}>
            {label}
          </span>
        </span>
      );
    }

    if (original.type === "groupChange" && original.senderUsername) {
      return <span class="table-user-text block w-full min-w-0 truncate">{original.senderUsername}</span>;
    }

    if (original.link?.startsWith("group:")) {
      return (
        <span class="table-user-text block w-full min-w-0 truncate">
          <span class="cursor-pointer block w-full min-w-0 truncate" onClick={() => openNotificationLink(original.link)}>
            {firstNonEmpty(dataGroupName, label)}
          </span>
        </span>
      );
    }

    if (original.link?.startsWith("event:")) {
      return (
        <span class="table-user-text block w-full min-w-0 truncate">
          <span class="cursor-pointer block w-full min-w-0 truncate" onClick={() => openNotificationLink(original.link)}>
            {firstNonEmpty(dataGroupName, original.groupName, label)}
          </span>
        </span>
      );
    }

    if (dataGroupName) {
      return <span class="table-user-text block w-full min-w-0 truncate">{dataGroupName}</span>;
    }

    if (detailsGroupName) {
      return <span class="table-user-text block w-full min-w-0 truncate">{detailsGroupName}</span>;
    }

    if (original.groupName) {
      return <span class="table-user-text block w-full min-w-0 truncate">{original.groupName}</span>;
    }

    return null;
  },
});
