import { ArrowUpDown, Info, LogIn, Trash2 } from "lucide-vue-next";
import { unref, type MaybeRef } from "vue";

import DisplayName from "../../DisplayName.vue";
import Location from "../../Location.vue";
import LocationWorld from "../../LocationWorld.vue";
import Button from "../../ui/button/Button.vue";
import { i18n } from "../../../plugins/i18n";
import { formatDateFilter } from "../../../coordinators/date-coordinator";
import type { VrcxColumn } from "../../../lib/table/use-vrcx-vue-table";
import type { PreviousInstancesVariant } from "../../../stores/instance-types";
import type { ParsedLocation } from "../../../types/vrcx";

const { t } = i18n.global;

export type PreviousInstanceRow = {
  created_at: string | null;
  location: string | null;
  time: number;
  worldName: string | null;
  groupName: string | null;
  events?: (number | null)[] | undefined;
  $location: ParsedLocation;
  timer: string;
};

type SortableColumn = {
  getIsSorted: () => false | "asc" | "desc";
  toggleSorting: (desc?: boolean) => void;
};

type ActionsColumnOptions = {
  shiftHeld: MaybeRef<boolean>;
  onShowInfo: (location: string) => void;
  onDelete?: ((row: PreviousInstanceRow) => void) | undefined;
  onDeletePrompt?: ((row: PreviousInstanceRow) => void) | undefined;
  onLaunch?: ((location: string | null) => void) | undefined;
};

type PreviousInstancesColumnConfig = Omit<ActionsColumnOptions, "onLaunch"> & {
  currentUserId?: string | undefined;
  forceUpdateKey?: number | undefined;
  onLaunch?: ((location: string | null) => void) | undefined;
};

const sortButton = ({ column, label, descFirst = false }: { column: SortableColumn; label: string; descFirst?: boolean }) => (
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

const resolveBool = (value: MaybeRef<boolean>): boolean => unref(value);

const baseDateColumn = (): VrcxColumn<PreviousInstanceRow> => ({
  id: "created_at",
  accessorFn: (row) => (row.created_at ? Date.parse(row.created_at) : 0),
  size: 170,
  header: ({ column }) =>
    sortButton({
      column,
      label: t("table.previous_instances.date"),
      descFirst: true,
    }),
  cell: ({ row }) => <span>{formatDateFilter(row.original.created_at, "long")}</span>,
});

const timeColumn = (): VrcxColumn<PreviousInstanceRow> => ({
  id: "time",
  accessorFn: (row) => row.time,
  size: 100,
  header: ({ column }) => sortButton({ column, label: t("table.previous_instances.time") }),
  cell: ({ row }) => <span>{row.original.timer}</span>,
});

const actionsColumn = ({ shiftHeld, onShowInfo, onDelete, onDeletePrompt, onLaunch }: ActionsColumnOptions): VrcxColumn<PreviousInstanceRow> => ({
  id: "actions",
  enableSorting: false,
  size: onLaunch ? 140 : 120,
  header: () => t("table.previous_instances.action"),
  meta: {
    thClass: "text-right",
    tdClass: "text-right",
  },
  cell: ({ row }) => {
    const original = row.original;
    const isShiftHeld = resolveBool(shiftHeld);

    return (
      <div class="inline-flex items-center justify-end gap-1">
        {onLaunch ? (
          <Button
            size="icon-sm"
            variant="ghost"
            class="w-6 h-6 text-xs"
            onClick={(event) => {
              event.stopPropagation();
              onLaunch(original.location);
            }}
          >
            <LogIn class="h-4 w-4" />
          </Button>
        ) : null}

        <Button
          size="icon-sm"
          variant="ghost"
          class="w-6 h-6 text-xs"
          onClick={(event) => {
            event.stopPropagation();
            onShowInfo(original.$location.tag);
          }}
        >
          <Info class="h-4 w-4" />
        </Button>

        <Button
          size="icon-sm"
          variant="ghost"
          class="w-6 h-6 text-xs"
          style={isShiftHeld ? { color: "#f56c6c" } : undefined}
          onClick={(event) => {
            event.stopPropagation();
            if (isShiftHeld) {
              onDelete?.(original);
            } else {
              onDeletePrompt?.(original);
            }
          }}
        >
          <Trash2 class="h-4 w-4" />
        </Button>
      </div>
    );
  },
});

export const createPreviousInstancesColumns = (variant: PreviousInstancesVariant, config: PreviousInstancesColumnConfig): VrcxColumn<PreviousInstanceRow>[] => {
  if (variant === "user") {
    return [
      baseDateColumn(),
      {
        id: "world",
        accessorFn: (row) => row.worldName ?? "",
        header: ({ column }) =>
          sortButton({
            column,
            label: t("table.previous_instances.world"),
          }),
        meta: {
          stretch: true,
        },
        cell: ({ row }) => (
          <Location location={row.original.location ?? undefined} hint={row.original.worldName ?? ""} grouphint={row.original.groupName ?? ""} />
        ),
      },
      {
        id: "creator",
        accessorFn: (row) => row.$location.userId ?? "",
        size: 170,
        header: () => t("table.previous_instances.instance_creator"),
        cell: ({ row }) => <DisplayName userid={row.original.$location.userId ?? undefined} location={row.original.$location.tag} />,
      },
      timeColumn(),
      actionsColumn({
        shiftHeld: config.shiftHeld,
        onLaunch: config.onLaunch,
        onShowInfo: config.onShowInfo,
        onDelete: config.onDelete,
        onDeletePrompt: config.onDeletePrompt,
      }),
    ];
  }

  if (variant === "world") {
    return [
      baseDateColumn(),
      {
        id: "instance",
        accessorFn: (row) => row.$location.tag,
        header: () => t("table.previous_instances.instance_name"),
        meta: {
          stretch: true,
        },
        cell: ({ row }) => (
          <LocationWorld
            class="w-fit"
            locationobject={row.original.$location}
            grouphint={row.original.groupName ?? ""}
            currentuserid={config.currentUserId ?? ""}
          />
        ),
      },
      {
        id: "creator",
        accessorFn: (row) => row.$location.userId ?? "",
        size: 170,
        header: () => t("table.previous_instances.instance_creator"),
        cell: ({ row }) => (
          <DisplayName userid={row.original.$location.userId ?? undefined} location={row.original.$location.tag} forceUpdateKey={config.forceUpdateKey} />
        ),
      },
      timeColumn(),
      actionsColumn({
        shiftHeld: config.shiftHeld,
        onShowInfo: config.onShowInfo,
        onDelete: config.onDelete,
        onDeletePrompt: config.onDeletePrompt,
      }),
    ];
  }

  return [
    baseDateColumn(),
    {
      id: "instance",
      accessorFn: (row) => row.worldName ?? "",
      header: () => t("table.previous_instances.instance_name"),
      meta: {
        stretch: true,
      },
      cell: ({ row }) => <Location location={row.original.$location.tag} grouphint={row.original.groupName ?? ""} hint={row.original.worldName ?? ""} />,
    },
    timeColumn(),
    actionsColumn({
      shiftHeld: config.shiftHeld,
      onShowInfo: config.onShowInfo,
      onDelete: config.onDelete,
      onDeletePrompt: config.onDeletePrompt,
    }),
  ];
};
