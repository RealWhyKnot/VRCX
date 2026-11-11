import Location from "../../components/Location.vue";
import Badge from "../../components/ui/badge/Badge.vue";
import Button from "../../components/ui/button/Button.vue";
import ContextMenu from "../../components/ui/context-menu/ContextMenu.vue";
import ContextMenuContent from "../../components/ui/context-menu/ContextMenuContent.vue";
import ContextMenuItem from "../../components/ui/context-menu/ContextMenuItem.vue";
import ContextMenuSeparator from "../../components/ui/context-menu/ContextMenuSeparator.vue";
import ContextMenuTrigger from "../../components/ui/context-menu/ContextMenuTrigger.vue";
import TooltipWrapper from "../../components/ui/tooltip/TooltipWrapper.vue";
import { ArrowUpDown, Copy, ExternalLink, FileText, Trash2, X } from "lucide-vue-next";
import { storeToRefs } from "pinia";

import { copyToClipboard, openExternalLink } from "../../shared/utils/app-actions";
import { formatDateFilter } from "../../coordinators/date-coordinator";
import { i18n } from "../../plugins/i18n";
import { useInstanceStore } from "../../stores/instance";
import { useUiStore } from "../../stores/ui";
import { lookupUser } from "../../coordinators/user-coordinator";
import { showWorldDialog } from "../../coordinators/world-coordinator";
import { logFailure } from "../../stores/log-failure";
import type { GameLogEntry } from "../../stores/gameLog/types";
import type { useVrcxVueTable } from "../../lib/table/use-vrcx-vue-table";

type GameLogTableOptions = Parameters<typeof useVrcxVueTable<GameLogEntry>>[0];
type GameLogColumn = Extract<GameLogTableOptions["columns"], unknown[]>[number];
type GameLogColumnsOptions = {
  getCreatedAt: (row: GameLogEntry) => string;
  onDelete: (row: GameLogEntry) => void;
  onDeletePrompt: (row: GameLogEntry) => void;
};

const { t } = i18n.global;

const UNACTIONABLE_TYPES = new Set(["OnPlayerJoined", "OnPlayerLeft", "Location", "PortalSpawn"]);

function firstNonEmpty(...values: (string | null | undefined)[]): string {
  for (const value of values) {
    if (value) return value;
  }
  return "";
}

function getInstanceId(entry: GameLogEntry): string {
  return "instanceId" in entry && typeof entry.instanceId === "string" ? entry.instanceId : "";
}

export function toUserRef(entry: { userId?: string | null | undefined; displayName?: string | null | undefined }): {
  userId?: string;
  displayName?: string;
} {
  const userRef: { userId?: string; displayName?: string } = {};
  if (entry.userId) userRef.userId = entry.userId;
  if (entry.displayName) userRef.displayName = entry.displayName;
  return userRef;
}

export const createColumns = ({ getCreatedAt, onDelete, onDeletePrompt }: GameLogColumnsOptions): GameLogColumn[] => {
  const { showPreviousInstancesInfoDialog } = useInstanceStore();
  const { shiftHeld } = storeToRefs(useUiStore());

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
    {
      accessorFn: (row) => getCreatedAt(row),
      id: "created_at",
      size: 140,
      meta: { label: () => t("table.gameLog.date") },
      header: ({ column }) => (
        <Button variant="ghost" class="pl-0!" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          {t("table.gameLog.date")}
          <ArrowUpDown class="ml-1 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const createdAt = getCreatedAt(row.original);
        const shortText = formatDateFilter(createdAt, "short");
        const longText = formatDateFilter(createdAt, "long");

        return (
          <TooltipWrapper content={longText} side="right">
            <span>{shortText}</span>
          </TooltipWrapper>
        );
      },
    },
    {
      accessorKey: "type",
      size: 150,
      header: () => t("table.gameLog.type"),
      meta: { label: () => t("table.gameLog.type") },
      cell: ({ row }) => {
        const original = row.original;
        const label = t(`view.game_log.filters.${original.type}`);
        const isLink = Boolean(original.location) && original.type !== "Location";

        return (
          <Badge variant="outline" class="text-muted-foreground">
            <span
              class={isLink ? "cursor-pointer" : undefined}
              onClick={() => {
                if (isLink && original.location) {
                  showWorldDialog(original.location);
                }
              }}
            >
              {label}
            </span>
          </Badge>
        );
      },
    },
    {
      accessorKey: "displayName",
      size: 200,
      header: () => t("table.gameLog.user"),
      meta: { label: () => t("table.gameLog.user") },
      cell: ({ row }) => {
        const original = row.original;
        const isFriend = original.isFriend;
        const isFavorite = original.isFavorite;
        return (
          <span class="cursor-pointer">
            {original.displayName ? (
              <span class="cursor-pointer table-user mr-1" onClick={() => void lookupUser(toUserRef(original)).catch(logFailure("Failed to look up user:"))}>
                {original.displayName}
              </span>
            ) : null}
            {isFriend ? <span>{isFavorite ? "⭐" : "💚"}</span> : null}
          </span>
        );
      },
    },
    {
      id: "detail",
      header: () => t("table.gameLog.detail"),
      enableSorting: false,
      minSize: 150,
      meta: {
        stretch: true,
        label: () => t("table.gameLog.detail"),
      },
      cell: ({ row }) => {
        const original = row.original;
        if (original.type === "Location") {
          return (
            <div class="w-full min-w-0 truncate">
              <Location location={original.location ?? ""} hint={original.worldName ?? ""} grouphint={original.groupName ?? ""} enableContextMenu />
            </div>
          );
        }

        if (original.type === "PortalSpawn") {
          return (
            <div class="w-full min-w-0 truncate">
              <Location location={getInstanceId(original)} hint={original.worldName ?? ""} grouphint={original.groupName ?? ""} enableContextMenu />
            </div>
          );
        }

        if (original.type === "Event") {
          return (
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <TooltipWrapper content={original.data ?? ""} side="bottom">
                  <span class="block w-full min-w-0 truncate">{original.data}</span>
                </TooltipWrapper>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => copyToClipboard(original.data ?? "")}>
                  <Copy class="size-4" />
                  {t("common.actions.copy")}
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        }

        if (original.type === "External") {
          return (
            <TooltipWrapper content={original.message ?? ""} side="bottom">
              <span class="block w-full min-w-0 truncate">{original.message}</span>
            </TooltipWrapper>
          );
        }

        if (original.type === "VideoPlay") {
          const hasVideoLink = original.videoId !== "PopcornPalace" && !!original.videoUrl;
          const label = firstNonEmpty(original.videoName, original.videoUrl);
          const tooltipText = original.videoId ? `${original.videoId}: ${label}` : label;
          return (
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <TooltipWrapper content={tooltipText} side="bottom">
                  <span class="block w-full min-w-0 truncate cursor-pointer">
                    {original.videoId ? <span class="mr-1.5">{original.videoId}:</span> : null}
                    {hasVideoLink ? (
                      <span class="cursor-pointer" onClick={() => openExternalLink(original.videoUrl ?? "")}>
                        {label}
                      </span>
                    ) : (
                      <span>{original.videoName}</span>
                    )}
                  </span>
                </TooltipWrapper>
              </ContextMenuTrigger>
              <ContextMenuContent>
                {hasVideoLink ? (
                  <>
                    <ContextMenuItem onClick={() => openExternalLink(original.videoUrl ?? "")}>
                      <ExternalLink class="size-4" />
                      {t("common.actions.open_link")}
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                  </>
                ) : null}
                <ContextMenuItem onClick={() => copyToClipboard(firstNonEmpty(original.videoUrl, original.videoName))}>
                  <Copy class="size-4" />
                  {t("common.actions.copy")}
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        }

        if (original.type === "ImageLoad" || original.type === "StringLoad") {
          return (
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <TooltipWrapper content={original.resourceUrl ?? ""} side="bottom">
                  <span class="block w-full min-w-0 truncate cursor-pointer">
                    <span class="cursor-pointer" onClick={() => openExternalLink(original.resourceUrl ?? "")}>
                      {original.resourceUrl}
                    </span>
                  </span>
                </TooltipWrapper>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => openExternalLink(original.resourceUrl ?? "")}>
                  <ExternalLink class="size-4" />
                  {t("common.actions.open_link")}
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => copyToClipboard(original.resourceUrl ?? "")}>
                  <Copy class="size-4" />
                  {t("common.actions.copy")}
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        }

        if (original.type === "Notification" || original.type === "OnPlayerJoined" || original.type === "OnPlayerLeft") {
          return null;
        }

        return (
          <TooltipWrapper content={original.data ?? ""} side="bottom">
            <span class="block w-full min-w-0 truncate">{original.data}</span>
          </TooltipWrapper>
        );
      },
    },
    {
      id: "action",
      meta: {
        class: "text-right",
        label: () => t("table.gameLog.action"),
      },
      size: 90,
      minSize: 90,
      maxSize: 90,
      header: () => t("table.gameLog.action"),
      enableSorting: false,
      cell: ({ row }) => {
        const original = row.original;
        const canDelete = !UNACTIONABLE_TYPES.has(original.type);
        const canShowPrevious = original.type === "Location";

        if (!canDelete && !canShowPrevious) {
          return null;
        }

        return (
          <div class="flex items-center justify-end gap-2">
            {canDelete ? (
              <button
                type="button"
                class="inline-flex h-6 items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => (shiftHeld.value ? onDelete(original) : onDeletePrompt(original))}
              >
                {shiftHeld.value ? <X class="h-4 w-4 text-red-600" /> : <Trash2 class="h-4 w-4" />}
              </button>
            ) : null}
            {canShowPrevious ? (
              <TooltipWrapper content={t("dialog.previous_instances.info")} side="top">
                <button
                  type="button"
                  class="inline-flex h-6 items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={() => showPreviousInstancesInfoDialog(original.location ?? "")}
                >
                  <FileText class="h-4 w-4" />
                </button>
              </TooltipWrapper>
            ) : null}
          </div>
        );
      },
    },
  ];
};
