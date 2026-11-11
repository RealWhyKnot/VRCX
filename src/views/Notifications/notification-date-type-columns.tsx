import { ArrowUpDown } from "lucide-vue-next";
import Badge from "../../components/ui/badge/Badge.vue";
import Button from "../../components/ui/button/Button.vue";
import Tooltip from "../../components/ui/tooltip/Tooltip.vue";
import TooltipContent from "../../components/ui/tooltip/TooltipContent.vue";
import TooltipTrigger from "../../components/ui/tooltip/TooltipTrigger.vue";
import Location from "../../components/Location.vue";
import { formatDateFilter } from "../../coordinators/date-coordinator";
import { showWorldDialog } from "../../coordinators/world-coordinator";
import type { VrcxColumn } from "../FriendList/vrcx-column";
import { t, te } from "./notification-column-helpers";
import type { NotificationColumnDeps, NotificationRow } from "./notification-column-types";

export const createDateColumn = ({ getNotificationCreatedAt, getNotificationCreatedAtTs }: NotificationColumnDeps): VrcxColumn<NotificationRow> => ({
  accessorFn: (row: NotificationRow) => getNotificationCreatedAtTs(row),
  id: "created_at",
  size: 120,
  meta: { label: () => t("table.notification.date") },
  header: ({ column }) => (
    <Button variant="ghost" class="pl-0!" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
      {t("table.notification.date")}
      <ArrowUpDown class="ml-1 h-4 w-4" />
    </Button>
  ),
  sortFn: (rowA, rowB, columnId) => {
    const a = rowA.getValue<number | undefined>(columnId) ?? 0;
    const b = rowB.getValue<number | undefined>(columnId) ?? 0;
    if (a !== b) {
      return a - b;
    }

    const aId = typeof rowA.original.id === "string" ? rowA.original.id : "";
    const bId = typeof rowB.original.id === "string" ? rowB.original.id : "";
    return aId.localeCompare(bId);
  },
  cell: ({ row }) => {
    const createdAt = getNotificationCreatedAt(row.original);
    const shortText = formatDateFilter(createdAt, "short");
    const longText = formatDateFilter(createdAt, "long");

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span>{shortText}</span>
        </TooltipTrigger>
        <TooltipContent side="right">
          <span>{longText}</span>
        </TooltipContent>
      </Tooltip>
    );
  },
});

export const createTypeColumn = ({ openNotificationLink }: NotificationColumnDeps): VrcxColumn<NotificationRow> => ({
  accessorKey: "type",
  size: 180,
  header: () => t("table.notification.type"),
  meta: { label: () => t("table.notification.type") },
  cell: ({ row }) => {
    const original = row.original;
    const typeKey = `view.notification.filters.${original.type}`;
    const label = te(typeKey) ? t(typeKey) : original.type;

    if (original.type === "invite") {
      return (
        <Badge variant="outline" class="text-muted-foreground">
          {label}
        </Badge>
      );
    }

    if (original.type === "group.queueReady" || original.type === "instance.closed") {
      return (
        <Badge variant="outline" class="text-muted-foreground">
          <Tooltip>
            <TooltipTrigger asChild>
              <span class="cursor-pointer" onClick={() => showWorldDialog(original.location ?? "")}>
                {label}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              {original.location ? (
                <Location location={original.location} hint={original.worldName ?? ""} grouphint={original.groupName ?? ""} link={true} />
              ) : null}
            </TooltipContent>
          </Tooltip>
        </Badge>
      );
    }

    if (original.link) {
      return (
        <Badge variant="outline" class="text-muted-foreground">
          <Tooltip>
            <TooltipTrigger asChild>
              <span class="cursor-pointer" onClick={() => openNotificationLink(original.link)}>
                {label}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              <span>{original.linkText}</span>
            </TooltipContent>
          </Tooltip>
        </Badge>
      );
    }

    return (
      <Badge variant="outline" class="text-muted-foreground">
        {label}
      </Badge>
    );
  },
});
