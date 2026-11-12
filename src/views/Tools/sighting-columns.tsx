import { i18n } from "../../plugins/i18n";
import type { SightingRow } from "../../shared/utils/instance-sightings";
import type { VrcxColumn } from "../FriendList/vrcx-column";
import { personButton, spacer } from "./people-patterns-columns.tsx";
import { dateCell, sortButton } from "./table-cells.tsx";

const { t } = i18n.global;

const MAX_NAMES_SHOWN = 6;

type SightingColumnsOptions = {
  onOpenUser: (userId: string) => void;
  onLookUp: (displayName: string) => void;
};

function creatorCell(row: SightingRow, onOpenUser: (userId: string) => void) {
  const label = row.creatorName || row.creatorId;
  if (!label) {
    return null;
  }
  if (row.creatorId.startsWith("usr_")) {
    return personButton(row.creatorId, label, onOpenUser);
  }
  return (
    <span class="min-w-0 truncate" title={label}>
      {label}
    </span>
  );
}

function createSightingColumns({ onOpenUser, onLookUp }: SightingColumnsOptions): VrcxColumn<SightingRow>[] {
  return [
    spacer<SightingRow>(),
    {
      accessorKey: "at",
      size: 130,
      meta: { label: () => t("view.tools.people_patterns.when") },
      header: ({ column }) => sortButton(column, t("view.tools.people_patterns.when")),
      cell: ({ row }) => dateCell(row.original.at, ""),
    },
    {
      accessorKey: "worldName",
      size: 200,
      minSize: 120,
      meta: { label: () => t("view.tools.people_patterns.world") },
      header: ({ column }) => sortButton(column, t("view.tools.people_patterns.world")),
      cell: ({ row }) => (
        <span class="block min-w-0 truncate pl-2" title={row.original.worldName}>
          {row.original.worldName || t("view.tools.people_patterns.unknown_world")}
        </span>
      ),
    },
    {
      accessorKey: "creatorName",
      size: 170,
      minSize: 100,
      meta: { label: () => t("view.tools.people_patterns.created_by") },
      header: ({ column }) => sortButton(column, t("view.tools.people_patterns.created_by")),
      cell: ({ row }) => (
        <div class="flex min-w-0 pl-2" data-testid="sighting-creator">
          {creatorCell(row.original, onOpenUser)}
        </div>
      ),
    },
    {
      accessorKey: "userCount",
      size: 110,
      meta: { label: () => t("view.tools.people_patterns.in_instance") },
      header: ({ column }) => sortButton(column, t("view.tools.people_patterns.in_instance")),
      cell: ({ row }) => (
        <span class="pl-2 tabular-nums">{row.original.capacity > 0 ? `${row.original.userCount}/${row.original.capacity}` : row.original.userCount}</span>
      ),
    },
    {
      accessorKey: "peopleCount",
      size: 320,
      minSize: 160,
      meta: { stretch: true, label: () => t("view.tools.people_patterns.people") },
      header: ({ column }) => sortButton(column, t("view.tools.people_patterns.people")),
      cell: ({ row }) => {
        const hidden = row.original.names.length - MAX_NAMES_SHOWN;
        const extra = Math.max(0, hidden) + row.original.unnamedCount;
        return (
          <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 pl-2" data-testid="sighting-people">
            {row.original.names.slice(0, MAX_NAMES_SHOWN).map((name) => (
              <span key={name} class="flex max-w-40 min-w-0">
                {personButton(name, name, onLookUp)}
              </span>
            ))}
            {extra > 0 ? (
              <span class="shrink-0 text-xs text-muted-foreground tabular-nums" title={row.original.names.join(", ")} data-testid="sighting-extra">
                +{extra}
              </span>
            ) : null}
          </div>
        );
      },
    },
  ];
}

export { createSightingColumns };
