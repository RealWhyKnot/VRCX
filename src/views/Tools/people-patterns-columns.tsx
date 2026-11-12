import type { RowData } from "@tanstack/vue-table";

import { i18n } from "../../plugins/i18n";
import { timeToText } from "../../shared/utils/base/format";
import type { Gathering, OnlineOverlap, RepeatEncounter, VoteKick } from "../../shared/utils/people-patterns";
import type { VrcxColumn } from "../FriendList/vrcx-column";
import { dateCell, sortButton } from "./table-cells.tsx";

const { t } = i18n.global;

const MAX_NAMES_SHOWN = 6;

type PeopleColumnsOptions = {
  onOpenUser: (userId: string) => void;
};

type VoteKickColumnsOptions = {
  onLookUp: (displayName: string) => void;
};

function spacer<TRow extends RowData>(): VrcxColumn<TRow> {
  return {
    id: "spacer",
    header: () => null,
    enableSorting: false,
    size: 20,
    minSize: 0,
    maxSize: 20,
    cell: () => null,
  };
}

function personButton(id: string, displayName: string, onOpenUser: (userId: string) => void) {
  return (
    <button
      type="button"
      class="min-w-0 max-w-full cursor-pointer truncate text-left hover:underline"
      title={displayName}
      data-testid="person-name"
      onClick={() => onOpenUser(id)}
    >
      {displayName}
    </button>
  );
}

function durationCell(milliseconds: number) {
  return <span class="pl-2 tabular-nums">{timeToText(milliseconds)}</span>;
}

function shareCell(percent: number) {
  return <span class="pl-2 tabular-nums">{percent}%</span>;
}

function createRepeatColumns({ onOpenUser }: PeopleColumnsOptions): VrcxColumn<RepeatEncounter>[] {
  return [
    spacer<RepeatEncounter>(),
    {
      accessorKey: "displayName",
      size: 200,
      minSize: 120,
      meta: { stretch: true, label: () => t("view.tools.people_patterns.name") },
      header: ({ column }) => sortButton(column, t("view.tools.people_patterns.name")),
      cell: ({ row }) => <div class="flex min-w-0 pl-2">{personButton(row.original.id, row.original.displayName, onOpenUser)}</div>,
    },
    {
      accessorKey: "placeCount",
      size: 130,
      meta: { label: () => t("view.tools.people_patterns.instances") },
      header: ({ column }) => sortButton(column, t("view.tools.people_patterns.instances")),
      cell: ({ row }) => <span class="pl-2 tabular-nums">{row.original.placeCount.toLocaleString()}</span>,
    },
    {
      accessorKey: "timeTogether",
      size: 160,
      meta: { label: () => t("view.tools.people_patterns.time_together") },
      header: ({ column }) => sortButton(column, t("view.tools.people_patterns.time_together")),
      cell: ({ row }) => durationCell(row.original.timeTogether),
    },
    {
      accessorKey: "lastSeenAt",
      size: 130,
      meta: { label: () => t("view.tools.people_patterns.last_seen") },
      header: ({ column }) => sortButton(column, t("view.tools.people_patterns.last_seen")),
      cell: ({ row }) => dateCell(row.original.lastSeenAt, ""),
    },
  ];
}

function createGatheringColumns({ onOpenUser }: PeopleColumnsOptions): VrcxColumn<Gathering>[] {
  return [
    spacer<Gathering>(),
    {
      accessorKey: "startedAt",
      size: 130,
      meta: { label: () => t("view.tools.people_patterns.when") },
      header: ({ column }) => sortButton(column, t("view.tools.people_patterns.when")),
      cell: ({ row }) => dateCell(row.original.startedAt, ""),
    },
    {
      accessorKey: "worldName",
      size: 200,
      minSize: 120,
      meta: { label: () => t("view.tools.people_patterns.world") },
      header: ({ column }) => sortButton(column, t("view.tools.people_patterns.world")),
      cell: ({ row }) => (
        <div class="flex min-w-0 flex-col pl-2">
          <span class="truncate" title={row.original.worldName}>
            {row.original.worldName || t("view.tools.people_patterns.unknown_world")}
          </span>
          {row.original.groupName ? (
            <span class="truncate text-xs text-muted-foreground" title={row.original.groupName}>
              {row.original.groupName}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: "peopleCount",
      size: 300,
      minSize: 160,
      meta: { stretch: true, label: () => t("view.tools.people_patterns.friends") },
      header: ({ column }) => sortButton(column, t("view.tools.people_patterns.friends")),
      cell: ({ row }) => (
        <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 pl-2" data-testid="gathering-people">
          {row.original.people.slice(0, MAX_NAMES_SHOWN).map((person) => (
            <span key={person.id} class="flex max-w-40 min-w-0">
              {personButton(person.id, person.displayName, onOpenUser)}
            </span>
          ))}
          {row.original.peopleCount > MAX_NAMES_SHOWN ? (
            <span class="shrink-0 text-xs text-muted-foreground tabular-nums" title={row.original.names}>
              +{row.original.peopleCount - MAX_NAMES_SHOWN}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: "timeTogether",
      size: 160,
      meta: { label: () => t("view.tools.people_patterns.time_together") },
      header: ({ column }) => sortButton(column, t("view.tools.people_patterns.time_together")),
      cell: ({ row }) => durationCell(row.original.timeTogether),
    },
  ];
}

function createOverlapColumns({ onOpenUser }: PeopleColumnsOptions): VrcxColumn<OnlineOverlap>[] {
  return [
    spacer<OnlineOverlap>(),
    {
      accessorKey: "displayName",
      size: 200,
      minSize: 120,
      meta: { stretch: true, label: () => t("view.tools.people_patterns.friend") },
      header: ({ column }) => sortButton(column, t("view.tools.people_patterns.friend")),
      cell: ({ row }) => <div class="flex min-w-0 pl-2">{personButton(row.original.id, row.original.displayName, onOpenUser)}</div>,
    },
    {
      accessorKey: "timeTogether",
      size: 170,
      meta: { label: () => t("view.tools.people_patterns.online_together") },
      header: ({ column }) => sortButton(column, t("view.tools.people_patterns.online_together")),
      cell: ({ row }) => durationCell(row.original.timeTogether),
    },
    {
      accessorKey: "theirShare",
      size: 150,
      meta: { label: () => t("view.tools.people_patterns.their_share") },
      header: ({ column }) => sortButton(column, t("view.tools.people_patterns.their_share")),
      cell: ({ row }) => shareCell(row.original.theirShare),
    },
    {
      accessorKey: "myShare",
      size: 150,
      meta: { label: () => t("view.tools.people_patterns.my_share") },
      header: ({ column }) => sortButton(column, t("view.tools.people_patterns.my_share")),
      cell: ({ row }) => shareCell(row.original.myShare),
    },
  ];
}

function createVoteKickColumns({ onLookUp }: VoteKickColumnsOptions): VrcxColumn<VoteKick>[] {
  return [
    spacer<VoteKick>(),
    {
      accessorKey: "at",
      size: 130,
      meta: { label: () => t("view.tools.people_patterns.when") },
      header: ({ column }) => sortButton(column, t("view.tools.people_patterns.when")),
      cell: ({ row }) => dateCell(row.original.at, ""),
    },
    {
      accessorKey: "displayName",
      size: 200,
      minSize: 120,
      meta: { stretch: true, label: () => t("view.tools.people_patterns.who") },
      header: ({ column }) => sortButton(column, t("view.tools.people_patterns.who")),
      cell: ({ row }) => (
        <div class="flex min-w-0 pl-2">{row.original.displayName ? personButton(row.original.displayName, row.original.displayName, onLookUp) : null}</div>
      ),
    },
    {
      accessorKey: "outcome",
      size: 150,
      meta: { label: () => t("view.tools.people_patterns.result") },
      header: ({ column }) => sortButton(column, t("view.tools.people_patterns.result")),
      cell: ({ row }) => (
        <span class="pl-2" data-testid="vote-outcome">
          {t(`view.tools.people_patterns.outcome_${row.original.outcome}`)}
        </span>
      ),
    },
    {
      accessorKey: "worldName",
      size: 220,
      minSize: 120,
      meta: { label: () => t("view.tools.people_patterns.world") },
      header: ({ column }) => sortButton(column, t("view.tools.people_patterns.world")),
      cell: ({ row }) => (
        <span class="block min-w-0 truncate pl-2" title={row.original.worldName}>
          {row.original.worldName || t("view.tools.people_patterns.unknown_world")}
        </span>
      ),
    },
  ];
}

export { createGatheringColumns, createOverlapColumns, createRepeatColumns, createVoteKickColumns, personButton, spacer };
