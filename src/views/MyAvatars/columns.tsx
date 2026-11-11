import { getAvatarTagColor, type AvatarContextAction, type MyAvatar } from "./types";
import Badge from "../../components/ui/badge/Badge.vue";
import Button from "../../components/ui/button/Button.vue";
import DropdownMenu from "../../components/ui/dropdown-menu/DropdownMenu.vue";
import DropdownMenuContent from "../../components/ui/dropdown-menu/DropdownMenuContent.vue";
import DropdownMenuItem from "../../components/ui/dropdown-menu/DropdownMenuItem.vue";
import DropdownMenuSeparator from "../../components/ui/dropdown-menu/DropdownMenuSeparator.vue";
import DropdownMenuTrigger from "../../components/ui/dropdown-menu/DropdownMenuTrigger.vue";
import { Apple, ArrowUpDown, Check, Ellipsis, Eye, Image, Monitor, Pencil, RefreshCw, Smartphone, Tag, User } from "lucide-vue-next";
import { formatDateFilter } from "../../coordinators/date-coordinator";
import { getAvailablePlatforms } from "../../shared/utils/platform-utils";
import { getPlatformInfo } from "../../shared/utils/avatar";
import { timeToText } from "../../shared/utils/base/format";
import { i18n } from "../../plugins/i18n";
import type { ComputedRef } from "vue";
import type { useVrcxVueTable } from "../../lib/table/use-vrcx-vue-table";

const { t } = i18n.global;

type MyAvatarTableOptions = Parameters<typeof useVrcxVueTable<MyAvatar>>[0];
type MyAvatarColumn = Extract<MyAvatarTableOptions["columns"], unknown[]>[number];

type SortableColumn = {
  getIsSorted: () => false | "asc" | "desc";
  toggleSorting: (desc?: boolean) => void;
};

type MyAvatarColumnsContext = {
  onShowAvatarDialog: (avatarId: string) => void;
  onContextMenuAction: (action: AvatarContextAction, avatar: MyAvatar) => void;
  currentAvatarId: ComputedRef<string | undefined>;
};

const onClickProps = (onClick: () => void) => ({ onClick });

const sortButton = ({ column, label, descFirst = false }: { column: SortableColumn; label: () => string; descFirst?: boolean }) => {
  return (
    <Button
      variant="ghost"
      size="sm"
      class="-ml-2 h-8 px-2"
      {...onClickProps(() => {
        const sorted = column.getIsSorted();
        if (!sorted && descFirst) {
          column.toggleSorting(true);
          return;
        }
        column.toggleSorting(sorted === "asc");
      })}
    >
      {label()}
      <ArrowUpDown class="ml-1 h-4 w-4" />
    </Button>
  );
};

export function getColumns({ onShowAvatarDialog, onContextMenuAction, currentAvatarId }: MyAvatarColumnsContext): MyAvatarColumn[] {
  return [
    {
      id: "active",
      header: () => null,
      size: 40,
      enableSorting: false,
      enableResizing: false,
      cell: ({ row }) => {
        const avatar = row.original;
        const isActive = avatar.id === currentAvatarId.value;
        return (
          <div class="flex items-center justify-center">
            <Check class={["h-4 w-4", isActive ? "text-primary" : "text-muted-foreground/0"]} />
          </div>
        );
      },
    },
    {
      id: "thumbnail",
      header: () => null,
      size: 64,
      enableSorting: false,
      enableResizing: false,
      cell: ({ row }) => {
        const avatar = row.original;
        return (
          <div class="flex items-center">
            <img
              src={avatar.thumbnailImageUrl}
              class="avatar-table-thumbnail cursor-pointer rounded-sm object-cover"
              style="width: 34px; height: 22px;"
              loading="lazy"
              onClick={() => onShowAvatarDialog(avatar.id)}
              onError={(event: Event) => {
                const img = event.target;
                if (!(img instanceof HTMLImageElement)) return;
                img.style.display = "none";
                const fallback = img.nextElementSibling;
                if (fallback instanceof HTMLElement) fallback.style.display = "";
              }}
            />
            <div
              class="rounded-sm bg-muted flex items-center justify-center cursor-pointer"
              style="width: 34px; height: 22px; display: none"
              onClick={() => onShowAvatarDialog(avatar.id)}
            >
              <Image class="h-3 w-3 text-muted-foreground" />
            </div>
          </div>
        );
      },
    },
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) =>
        sortButton({
          column,
          label: () => t("dialog.avatar.info.name"),
        }),
      size: 200,
      meta: { label: () => t("dialog.avatar.info.name") },
      cell: ({ row }) => {
        const avatar = row.original;
        return (
          <span
            class="cursor-pointer"
            onClick={(event: MouseEvent) => {
              event.stopPropagation();
              onShowAvatarDialog(avatar.id);
            }}
          >
            {avatar.name}
          </span>
        );
      },
    },
    {
      id: "customTags",
      accessorFn: (row) => (row.$tags ?? []).map((entry) => entry.tag).join(", "),
      header: () => t("dialog.avatar.info.tags"),
      size: 150,
      enableSorting: false,
      meta: { label: () => t("dialog.avatar.info.tags") },
      cell: ({ row }) => {
        const tags = row.original.$tags ?? [];
        if (!tags.length) return null;
        return (
          <div class="flex flex-nowrap gap-1 overflow-hidden">
            {tags.map((entry) => {
              const hashColor = getAvatarTagColor(entry.tag);
              const storedColor = entry.color;
              const hasStoredColor = storedColor !== null && storedColor !== "";
              const bg = hasStoredColor ? storedColor : hashColor.bg;
              const text = hasStoredColor ? storedColor.replace(/\/ [\d.]+\)$/, ")") : hashColor.text;
              return (
                <Badge
                  key={entry.tag}
                  variant="secondary"
                  class="text-xs"
                  style={{
                    backgroundColor: bg,
                    color: text,
                  }}
                >
                  {entry.tag}
                </Badge>
              );
            })}
          </div>
        );
      },
    },
    {
      id: "platforms",
      header: () => t("dialog.avatar.info.platform"),
      size: 120,
      enableSorting: false,
      meta: { label: () => t("dialog.avatar.info.platform") },
      cell: ({ row }) => {
        const avatar = row.original;
        const platforms = getAvailablePlatforms(avatar.unityPackages);
        return (
          <div class="flex items-center gap-1">
            {platforms.isPC && (
              <Badge class="x-tag-platform-pc" variant="outline">
                <Monitor class="h-3.5 w-3.5" />
              </Badge>
            )}
            {platforms.isQuest && (
              <Badge class="x-tag-platform-quest" variant="outline">
                <Smartphone class="h-3.5 w-3.5" />
              </Badge>
            )}
            {platforms.isIos && (
              <Badge class="text-platform-ios border-platform-ios" variant="outline">
                <Apple class="h-3.5 w-3.5" />
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      id: "visibility",
      accessorKey: "releaseStatus",
      header: () => t("dialog.avatar.info.visibility"),
      size: 120,
      meta: { label: () => t("dialog.avatar.info.visibility") },
      cell: ({ row }) => {
        const avatar = row.original;
        return <Badge variant="outline">{avatar.releaseStatus === "public" ? t("dialog.avatar.tags.public") : t("dialog.avatar.tags.private")}</Badge>;
      },
    },
    {
      id: "timeSpent",
      accessorFn: (row) => row.$timeSpent ?? 0,
      header: ({ column }) =>
        sortButton({
          column,
          label: () => t("dialog.avatar.info.time_spent"),
          descFirst: true,
        }),
      size: 140,
      meta: {
        class: "text-right",
        label: () => t("dialog.avatar.info.time_spent"),
      },
      cell: ({ row }) => {
        const time = row.original.$timeSpent;
        return time ? <span>{timeToText(time)}</span> : <span>-</span>;
      },
    },
    {
      id: "version",
      accessorKey: "version",
      header: ({ column }) =>
        sortButton({
          column,
          label: () => t("dialog.avatar.info.version"),
          descFirst: true,
        }),
      size: 90,
      meta: {
        class: "text-right",
        label: () => t("dialog.avatar.info.version"),
      },
      cell: ({ row }) => <span>{row.original.version}</span>,
    },
    {
      id: "impostor",
      accessorFn: (row) => {
        if (!Array.isArray(row.unityPackages)) {
          return "";
        }

        for (let i = row.unityPackages.length - 1; i > -1; i--) {
          const unityPackage = row.unityPackages[i];
          if (unityPackage?.variant === "impostor") {
            return unityPackage.impostorizerVersion ?? "";
          }
        }

        return "";
      },
      header: ({ column }) =>
        sortButton({
          column,
          label: () => t("dialog.avatar.tags.impostor"),
        }),
      size: 100,
      meta: {
        class: "text-right",
        label: () => t("dialog.avatar.tags.impostor"),
      },
      cell: ({ row }) => {
        const version = row.getValue<string>("impostor");
        return <span>{version ? `v${version}` : "-"}</span>;
      },
    },
    {
      id: "pcPerf",
      accessorFn: (row) => getPlatformInfo(row.unityPackages).pc.performanceRating ?? "",
      header: ({ column }) =>
        sortButton({
          column,
          label: () => t("dialog.avatar.info.pc_performance"),
        }),
      size: 140,
      meta: { label: () => t("dialog.avatar.info.pc_performance") },
      cell: ({ row }) => {
        const perf = getPlatformInfo(row.original.unityPackages).pc.performanceRating;
        return perf ? <span>{perf}</span> : <span class="text-muted-foreground">-</span>;
      },
    },
    {
      id: "androidPerf",
      accessorFn: (row) => getPlatformInfo(row.unityPackages).android.performanceRating ?? "",
      header: ({ column }) =>
        sortButton({
          column,
          label: () => t("dialog.avatar.info.android_performance"),
        }),
      size: 140,
      meta: { label: () => t("dialog.avatar.info.android_performance") },
      cell: ({ row }) => {
        const perf = getPlatformInfo(row.original.unityPackages).android.performanceRating;
        return perf ? <span>{perf}</span> : <span class="text-muted-foreground">-</span>;
      },
    },
    {
      id: "iosPerf",
      accessorFn: (row) => getPlatformInfo(row.unityPackages).ios.performanceRating ?? "",
      header: ({ column }) =>
        sortButton({
          column,
          label: () => t("dialog.avatar.info.ios_performance"),
        }),
      size: 140,
      meta: { label: () => t("dialog.avatar.info.ios_performance") },
      cell: ({ row }) => {
        const perf = getPlatformInfo(row.original.unityPackages).ios.performanceRating;
        return perf ? <span>{perf}</span> : <span class="text-muted-foreground">-</span>;
      },
    },
    {
      id: "updated_at",
      accessorKey: "updated_at",
      header: ({ column }) =>
        sortButton({
          column,
          label: () => t("dialog.avatar.info.last_updated"),
          descFirst: true,
        }),
      size: 160,
      meta: { label: () => t("dialog.avatar.info.last_updated") },
      cell: ({ row }) => {
        const avatar = row.original;
        return <span>{formatDateFilter(avatar.updated_at, "long")}</span>;
      },
    },
    {
      id: "created_at",
      accessorKey: "created_at",
      header: ({ column }) =>
        sortButton({
          column,
          label: () => t("dialog.avatar.info.created_at"),
          descFirst: true,
        }),
      size: 160,
      meta: { label: () => t("dialog.avatar.info.created_at") },
      cell: ({ row }) => {
        const avatar = row.original;
        return <span>{formatDateFilter(avatar.created_at, "long")}</span>;
      },
    },
    {
      id: "actions",
      header: () => null,
      size: 100,
      enableSorting: false,
      enableResizing: false,
      cell: ({ row }) => {
        const avatar = row.original;
        return (
          <div class="flex items-center gap-1" onClick={(event: MouseEvent) => event.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button class="rounded-full h-6 w-6" size="icon" variant="ghost">
                  <Ellipsis class="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem {...onClickProps(() => onShowAvatarDialog(avatar.id))}>
                  <Eye class="size-4" />
                  {t("dialog.avatar.actions.view_details")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem {...onClickProps(() => onContextMenuAction("manageTags", avatar))}>
                  <Tag class="size-4" />
                  {t("dialog.avatar.actions.manage_tags")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {avatar.releaseStatus === "public" ? (
                  <DropdownMenuItem {...onClickProps(() => onContextMenuAction("makePrivate", avatar))}>
                    <User class="size-4" />
                    {t("dialog.avatar.actions.make_private")}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem {...onClickProps(() => onContextMenuAction("makePublic", avatar))}>
                    <User class="size-4" />
                    {t("dialog.avatar.actions.make_public")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem {...onClickProps(() => onContextMenuAction("rename", avatar))}>
                  <Pencil class="size-4" />
                  {t("dialog.avatar.actions.rename")}
                </DropdownMenuItem>
                <DropdownMenuItem {...onClickProps(() => onContextMenuAction("changeDescription", avatar))}>
                  <Pencil class="size-4" />
                  {t("dialog.avatar.actions.change_description")}
                </DropdownMenuItem>
                <DropdownMenuItem {...onClickProps(() => onContextMenuAction("changeTags", avatar))}>
                  <Pencil class="size-4" />
                  {t("dialog.avatar.actions.change_content_tags")}
                </DropdownMenuItem>
                <DropdownMenuItem {...onClickProps(() => onContextMenuAction("changeStyles", avatar))}>
                  <Pencil class="size-4" />
                  {t("dialog.avatar.actions.change_styles_author_tags")}
                </DropdownMenuItem>
                <DropdownMenuItem {...onClickProps(() => onContextMenuAction("changeImage", avatar))}>
                  <Image class="size-4" />
                  {t("dialog.avatar.actions.change_image")}
                </DropdownMenuItem>
                <DropdownMenuItem {...onClickProps(() => onContextMenuAction("createImpostor", avatar))}>
                  <RefreshCw class="size-4" />
                  {t("dialog.avatar.actions.create_impostor")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
}
