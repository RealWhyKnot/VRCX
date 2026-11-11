import Location from "@/components/Location.vue";
import { i18n } from "@/plugins/i18n";
import { formatDateFilter } from "@/coordinators/date-coordinator";
import { ArrowUpDown } from "lucide-vue-next";
import Button from "@/components/ui/button/Button.vue";
import type { ModerationColumn, ModerationLogRow } from "./group-moderation-types";

const { t } = i18n.global;

type SortableColumn = {
  getIsSorted: () => false | "asc" | "desc";
  toggleSorting: (desc?: boolean) => void;
};

type SortButtonOptions = {
  column: SortableColumn;
  label: string;
  descFirst?: boolean;
};

const sortButton = ({ column, label, descFirst = false }: SortButtonOptions) => (
  <Button
    variant="ghost"
    size="sm"
    class="-ml-2 h-8 px-2"
    onClick={() => {
      const sorted = column.getIsSorted();
      if (!sorted && descFirst) {
        column.toggleSorting(true);
        return;
      }
      column.toggleSorting(sorted === "asc");
    }}
  >
    {label}
    <ArrowUpDown class="ml-1 h-4 w-4" />
  </Button>
);

export type GroupLogsColumnContext = {
  onShowUser: (userId: string) => void;
};

export const createColumns = ({ onShowUser }: GroupLogsColumnContext): ModerationColumn<ModerationLogRow>[] => [
  {
    accessorKey: "created_at",
    header: ({ column }) =>
      sortButton({
        column,
        label: t("dialog.group_member_moderation.created_at"),
      }),
    size: 170,
    cell: ({ row }) => <span>{formatDateFilter(row.original.created_at, "long")}</span>,
  },
  {
    accessorKey: "eventType",
    header: ({ column }) =>
      sortButton({
        column,
        label: t("dialog.group_member_moderation.type"),
      }),
    size: 190,
    cell: ({ row }) => <span>{row.original.eventType}</span>,
  },
  {
    accessorKey: "actorDisplayName",
    header: ({ column }) =>
      sortButton({
        column,
        label: t("dialog.group_member_moderation.display_name"),
      }),
    size: 160,
    cell: ({ row }) => {
      const original = row.original;
      return (
        <span
          style="cursor: pointer"
          onClick={(e) => {
            e.stopPropagation();
            onShowUser(original.actorId);
          }}
        >
          <span>{original.actorDisplayName}</span>
        </span>
      );
    },
  },
  {
    id: "description",
    accessorFn: (row) => row.description ?? "",
    header: () => t("dialog.group_member_moderation.description"),
    meta: {
      stretch: true,
    },
    cell: ({ row }) => {
      const original = row.original;
      const targetId = original.targetId ?? "";
      return (
        <span>
          {targetId.startsWith("wrld_") ? <Location location={targetId} /> : null}
          <span>{original.description}</span>
        </span>
      );
    },
  },
  {
    id: "data",
    header: () => t("dialog.group_member_moderation.data"),
    enableSorting: false,
    cell: ({ row }) => {
      const data = row.original.data;
      const hasData = typeof data === "object" && data !== null && Object.keys(data).length > 0;
      return <span>{hasData ? JSON.stringify(data) : ""}</span>;
    },
  },
];
