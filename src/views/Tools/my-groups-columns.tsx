import { LogOut } from "lucide-vue-next";

import { formatDateFilter } from "../../coordinators/date-coordinator";
import { i18n } from "../../plugins/i18n";
import { timeToText } from "../../shared/utils/base/format";
import { convertFileUrlToImageUrl } from "../../shared/utils/common";
import type { GroupOverviewRow } from "../../shared/utils/group-overview";
import type { VrcxColumn } from "../FriendList/vrcx-column";
import { countCell, dateCell, sortButton } from "./table-cells.tsx";

const { t } = i18n.global;

type MyGroupsColumnsOptions = {
  onOpen: (groupId: string) => void;
  onLeave: (groupId: string) => void;
};

export const createColumns = ({ onOpen, onLeave }: MyGroupsColumnsOptions): VrcxColumn<GroupOverviewRow>[] => [
  {
    id: "spacer",
    header: () => null,
    enableSorting: false,
    size: 20,
    minSize: 0,
    maxSize: 20,
    cell: () => null,
  },
  {
    accessorKey: "name",
    size: 168,
    minSize: 120,
    meta: { stretch: true, label: () => t("view.tools.my_groups.group") },
    header: ({ column }) => sortButton(column, t("view.tools.my_groups.group")),
    cell: ({ row }) => (
      <button
        type="button"
        class="flex w-full min-w-0 cursor-pointer items-center gap-2 pl-2 text-left"
        title={row.original.name}
        data-testid="group-name"
        onClick={() => onOpen(row.original.id)}
      >
        <span class="size-6 shrink-0 overflow-hidden rounded-sm bg-muted">
          {row.original.iconUrl ? <img src={convertFileUrlToImageUrl(row.original.iconUrl)} alt="" loading="lazy" class="size-full object-cover" /> : null}
        </span>
        <span class="min-w-0 truncate">{row.original.name}</span>
      </button>
    ),
  },
  {
    accessorKey: "memberCount",
    size: 122,
    meta: { label: () => t("view.tools.my_groups.members") },
    header: ({ column }) => sortButton(column, t("view.tools.my_groups.members")),
    cell: ({ row }) => <span class="pl-2 tabular-nums">{row.original.memberCount.toLocaleString()}</span>,
  },
  {
    accessorKey: "notificationCount",
    size: 144,
    meta: { label: () => t("view.tools.my_groups.notifications") },
    header: ({ column }) => sortButton(column, t("view.tools.my_groups.notifications")),
    cell: ({ row }) =>
      countCell(
        row.original.notificationCount,
        row.original.lastNotificationAt ? `${t("view.tools.my_groups.last_notification")}: ${formatDateFilter(row.original.lastNotificationAt, "long")}` : ""
      ),
  },
  {
    accessorKey: "visitCount",
    size: 96,
    meta: { label: () => t("view.tools.my_groups.visits") },
    header: ({ column }) => sortButton(column, t("view.tools.my_groups.visits")),
    cell: ({ row }) =>
      countCell(row.original.visitCount, row.original.timeSpent > 0 ? `${t("view.tools.my_groups.time_spent")}: ${timeToText(row.original.timeSpent)}` : ""),
  },
  {
    accessorKey: "lastVisitAt",
    size: 118,
    meta: { label: () => t("view.tools.my_groups.last_visit") },
    header: ({ column }) => sortButton(column, t("view.tools.my_groups.last_visit")),
    cell: ({ row }) => dateCell(row.original.lastVisitAt, t("view.tools.my_groups.never")),
  },
  {
    id: "action",
    size: 80,
    maxSize: 80,
    enableSorting: false,
    meta: { class: "w-[80px] max-w-[80px] text-right", label: () => t("view.tools.my_groups.leave") },
    header: () => null,
    cell: ({ row }) => (
      <div class="flex justify-end">
        {row.original.canLeave ? (
          <button
            type="button"
            class="inline-flex h-6 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground"
            title={t("view.tools.my_groups.leave")}
            aria-label={t("view.tools.my_groups.leave")}
            data-testid="group-leave"
            onClick={() => onLeave(row.original.id)}
          >
            <LogOut class="h-4 w-4" />
          </button>
        ) : (
          <span class="text-xs text-muted-foreground">{t("view.tools.my_groups.owner")}</span>
        )}
      </div>
    ),
  },
];
