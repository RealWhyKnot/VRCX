import Timer from "../../components/Timer.vue";
import Button from "../../components/ui/button/Button.vue";
import TooltipWrapper from "../../components/ui/tooltip/TooltipWrapper.vue";
import { Apple, ArrowUpDown, IdCard, User, Monitor, Smartphone } from "lucide-vue-next";
import type { Ref } from "vue";

import { getFaviconUrl } from "../../shared/utils/url-utils";
import { languageClass, statusClass } from "../../shared/utils/user";
import { openExternalLink } from "../../shared/utils/app-actions";
import { i18n } from "../../plugins/i18n";
import type { InstanceUserEntry, PlayerRef } from "../../stores/instance-types";
import type { useVrcxVueTable } from "../../lib/table/use-vrcx-vue-table";

export type PlayerListRef = PlayerRef & {
  iconUrl?: string;
  thumbnailUrl?: string;
  currentAvatarThumbnailImageUrl?: string;
  currentAvatarImageUrl?: string;
  profilePicOverride?: string;
  status?: string | undefined;
  statusDescription?: string | undefined;
  note?: string | undefined;
  $memo?: string | undefined;
  $userColour?: string | undefined;
  $trustLevel?: string | undefined;
  $trustClass?: string | undefined;
  $platform?: string | undefined;
  last_platform?: string | undefined;
  $languages?: { key: string; value: string }[] | undefined;
};

export type PlayerListRow = Omit<InstanceUserEntry, "ref"> & { ref: PlayerListRef };

type PlayerListTableOptions = Parameters<typeof useVrcxVueTable<PlayerListRow>>[0];
type PlayerListColumn = Extract<PlayerListTableOptions["columns"], unknown[]>[number];

type SortableColumn = {
  getIsSorted: () => false | "asc" | "desc";
  toggleSorting: (desc?: boolean) => void;
};

type PlayerListColumnsOptions = {
  randomUserColours: Ref<boolean>;
  chatboxUserBlacklist: Ref<Map<string, string>>;
  onBlockChatbox: (userId: string, displayName: string) => void;
  onUnblockChatbox: (userId: string) => void;
  sortAlphabetically: (a: string | undefined, b: string | undefined) => number;
  userImage: (user: PlayerListRef) => string;
};

const { t } = i18n.global;

const sortButton = ({ column, label, descFirst = false }: { column: SortableColumn; label: string | (() => string); descFirst?: boolean }) => {
  const resolvedLabel = typeof label === "function" ? label() : label;
  return (
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
      {resolvedLabel}
      <ArrowUpDown class="ml-1 h-4 w-4" />
    </Button>
  );
};

function readBioLinks(profileRef: unknown): string[] {
  if (typeof profileRef !== "object" || profileRef === null || !("bioLinks" in profileRef)) return [];
  const { bioLinks } = profileRef;
  if (!Array.isArray(bioLinks)) return [];
  return bioLinks.filter((link): link is string => typeof link === "string" && link.length > 0);
}

const getInstanceIconWeight = (item: InstanceUserEntry) => {
  let value = 0;
  if (item.isMaster) value += 1000;
  if (item.isModerator) value += 500;
  if (item.isFriend) value += 200;
  if (item.isBlocked) value -= 100;
  if (item.isMuted) value -= 50;
  if (item.isAvatarInteractionDisabled) value -= 20;
  if (item.isChatBoxMuted) value -= 10;
  if (item.ageVerified) value += 5;
  return value;
};

const sortInstanceIcon = (a: InstanceUserEntry, b: InstanceUserEntry) => getInstanceIconWeight(b) - getInstanceIconWeight(a);

export const createColumns = ({
  randomUserColours,
  chatboxUserBlacklist,
  onBlockChatbox,
  onUnblockChatbox,
  sortAlphabetically,
  userImage,
}: PlayerListColumnsOptions): PlayerListColumn[] => {
  const cols: PlayerListColumn[] = [
    {
      id: "avatar",
      header: () => t("table.playerList.avatar"),
      size: 70,
      enableSorting: false,
      meta: { label: () => t("table.playerList.avatar") },
      cell: ({ row }) => {
        const src = userImage(row.original.ref);
        if (!src) return null;
        return (
          <div class="flex items-center pl-2">
            <img
              src={src}
              class="h-4 w-4 rounded-sm object-cover"
              loading="lazy"
              onError={(event) => {
                const img = event.currentTarget;
                if (!(img instanceof HTMLImageElement)) return;
                const fallback = img.nextElementSibling;
                if (!(fallback instanceof HTMLElement)) return;
                img.style.display = "none";
                fallback.style.display = "";
              }}
            />
            <div class="h-4 w-4 rounded-sm bg-muted flex items-center justify-center" style="display: none">
              <User class="h-3 w-3 text-muted-foreground" />
            </div>
          </div>
        );
      },
    },
    {
      id: "timer",
      accessorFn: (row) => row.timer,
      header: ({ column }) =>
        sortButton({
          column,
          label: () => t("table.playerList.timer"),
        }),
      size: 90,
      meta: { label: () => t("table.playerList.timer") },
      sortFn: (rowA, rowB) => (rowA.original.timer ?? 0) - (rowB.original.timer ?? 0),
      cell: ({ row }) => <Timer epoch={row.original.timer ?? 0} />,
    },
    {
      id: "displayName",
      accessorFn: (row) => row.displayName,
      header: ({ column }) =>
        sortButton({
          column,
          label: () => t("table.playerList.displayName"),
        }),
      size: 200,
      meta: { label: () => t("table.playerList.displayName") },
      sortFn: (rowA, rowB) => sortAlphabetically(rowA.original.displayName, rowB.original.displayName),
      cell: ({ row }) => {
        const userRef = row.original.ref;
        const style = randomUserColours.value ? { color: userRef.$userColour } : null;
        return <span style={style}>{[userRef.displayName, userRef.id].find((value) => value) ?? ""}</span>;
      },
    },
    {
      id: "rank",
      accessorFn: (row) => row.ref.$trustSortNum,
      header: ({ column }) => sortButton({ column, label: () => t("table.playerList.rank") }),
      size: 110,
      meta: { label: () => t("table.playerList.rank") },
      sortFn: (rowA, rowB) => (rowA.original.ref.$trustSortNum ?? 0) - (rowB.original.ref.$trustSortNum ?? 0),
      cell: ({ row }) => {
        const userRef = row.original.ref;
        return <span class={["name", userRef.$trustClass].filter(Boolean).join(" ")}>{userRef.$trustLevel ?? ""}</span>;
      },
    },
    {
      id: "status",
      accessorFn: (row) => row.ref.statusDescription,
      header: () => t("table.playerList.status"),
      size: 200,
      minSize: 100,
      meta: {
        stretch: true,
        label: () => t("table.playerList.status"),
      },
      enableSorting: false,
      cell: ({ row }) => {
        const userRef = row.original.ref;
        const status = userRef.status;
        return (
          <span class="flex w-full min-w-0 items-center gap-2">
            <i class={["x-user-status", "shrink-0", "mr-1", status ? statusClass(status) : null]}></i>
            <span class="min-w-0 truncate">{userRef.statusDescription ?? ""}</span>
          </span>
        );
      },
    },
    {
      id: "photonId",
      accessorFn: (row) => row.photonId,
      header: ({ column }) =>
        sortButton({
          column,
          label: () => t("table.playerList.photonId"),
        }),
      size: 110,
      enableHiding: true,
      meta: {
        label: () => t("table.playerList.photonId"),
        disableVisibilityToggle: true,
        defaultHidden: true,
      },
      sortFn: (rowA, rowB) => rowA.original.photonId - rowB.original.photonId,
      cell: ({ row }) => {
        const userRef = row.original.ref;
        const userId = userRef.id;
        const isBlocked = userId !== undefined && chatboxUserBlacklist.value.has(userId);

        return (
          <div class="flex items-center">
            {userId ? (
              <button
                class={isBlocked ? "mr-1 text-xs underline cursor-pointer text-destructive" : "mr-1 text-xs underline cursor-pointer"}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isBlocked) {
                    onUnblockChatbox(userId);
                  } else {
                    onBlockChatbox(userId, userRef.displayName);
                  }
                }}
              >
                {isBlocked ? "Unblock" : "Block"}
              </button>
            ) : null}
            <span>{String(row.original.photonId)}</span>
          </div>
        );
      },
    },
    {
      id: "icon",
      header: ({ column }) =>
        sortButton({
          column,
          label: () => t("table.playerList.icon"),
          descFirst: true,
        }),
      size: 90,
      accessorFn: (row) => getInstanceIconWeight(row),
      meta: {
        class: "text-center",
        label: () => t("table.playerList.icon"),
      },
      sortFn: (rowA, rowB) => -sortInstanceIcon(rowA.original, rowB.original),
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div class="flex items-center justify-center gap-1">
            {r.isMaster ? (
              <TooltipWrapper side="left" content="Instance Master">
                <span>👑</span>
              </TooltipWrapper>
            ) : null}
            {r.isModerator ? (
              <TooltipWrapper side="left" content="Moderator">
                <span>⚔️</span>
              </TooltipWrapper>
            ) : null}
            {r.isFriend ? (
              <TooltipWrapper side="left" content="Friend">
                <span>💚</span>
              </TooltipWrapper>
            ) : null}
            {r.isBlocked ? (
              <TooltipWrapper side="left" content="Blocked">
                <span class="text-destructive">⛔</span>
              </TooltipWrapper>
            ) : null}
            {r.isMuted ? (
              <TooltipWrapper side="left" content="Muted">
                <span class="text-muted-foreground">🔇</span>
              </TooltipWrapper>
            ) : null}
            {r.isAvatarInteractionDisabled ? (
              <TooltipWrapper side="left" content="Avatar Interaction Disabled">
                <span class="text-muted-foreground">🚫</span>
              </TooltipWrapper>
            ) : null}
            {r.isChatBoxMuted ? (
              <TooltipWrapper side="left" content="Chatbox Muted">
                <span class="text-muted-foreground">💬</span>
              </TooltipWrapper>
            ) : null}
            {r.timeoutTime ? (
              <TooltipWrapper side="left" content="Timeout">
                <span class="text-destructive">🔴{r.timeoutTime}s</span>
              </TooltipWrapper>
            ) : null}
            {r.ageVerified ? (
              <TooltipWrapper side="left" content="18+ Verified">
                <IdCard class="h-4 w-4 x-tag-age-verification" />
              </TooltipWrapper>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "platform",
      header: () => t("table.playerList.platform"),
      size: 90,
      enableSorting: false,
      meta: { label: () => t("table.playerList.platform") },
      cell: ({ row }) => {
        const userRef = row.original.ref;
        const platform = userRef.$platform;
        const isInVrMode = row.original.inVRMode;

        const platformIcon =
          platform === "standalonewindows" ? (
            <Monitor class="h-4 w-4 shrink-0 x-tag-platform-pc" />
          ) : platform === "android" ? (
            <Smartphone class="h-4 w-4 shrink-0 x-tag-platform-quest" />
          ) : platform === "ios" ? (
            <Apple class="h-4 w-4 shrink-0 x-tag-platform-ios" />
          ) : platform ? (
            <span>{platform}</span>
          ) : null;

        const mode = isInVrMode == null ? null : isInVrMode ? "VR" : userRef.last_platform === "android" || userRef.last_platform === "ios" ? "M" : "D";

        return (
          <div class="flex items-center gap-1">
            {platformIcon}
            {mode ? <span>{mode}</span> : null}
          </div>
        );
      },
    },
    {
      id: "language",
      header: () => t("table.playerList.language"),
      size: 100,
      enableSorting: false,
      meta: { label: () => t("table.playerList.language") },
      cell: ({ row }) => {
        const langs = row.original.ref.$languages ?? [];
        return (
          <div class="flex items-center gap-0.5">
            {langs.map((item) => (
              <TooltipWrapper
                key={item.key}
                side="top"
                v-slots={{
                  content: () => (
                    <span>
                      {item.value} ({item.key})
                    </span>
                  ),
                }}
              >
                <span class={["flags", "inline-block", "mr-1", languageClass(item.key)]} />
              </TooltipWrapper>
            ))}
          </div>
        );
      },
    },
    {
      id: "bioLink",
      header: () => t("table.playerList.bioLink"),
      size: 100,
      enableSorting: false,
      meta: { label: () => t("table.playerList.bioLink") },
      cell: ({ row }) => {
        const links = readBioLinks(row.original.profileRef);
        return (
          <div class="flex items-center">
            {links.map((link, index) => (
              <TooltipWrapper
                key={index}
                v-slots={{
                  content: () => <span>{link}</span>,
                }}
              >
                <img
                  src={getFaviconUrl(link)}
                  class="h-4 w-4 mr-1 align-middle cursor-pointer"
                  loading="lazy"
                  onClick={(e) => {
                    e.stopPropagation();
                    openExternalLink(link);
                  }}
                />
              </TooltipWrapper>
            ))}
          </div>
        );
      },
    },
    {
      id: "note",
      accessorFn: (row) => row.ref.note,
      header: () => t("table.playerList.note"),
      size: 150,
      minSize: 20,
      meta: {
        stretch: true,
        label: () => t("table.playerList.note"),
      },
      enableSorting: false,
      cell: ({ row }) => <span>{row.original.ref.note ?? ""}</span>,
    },
    {
      id: "memo",
      accessorFn: (row) => row.ref.$memo,
      header: () => t("table.playerList.memo"),
      size: 150,
      minSize: 20,
      meta: {
        stretch: true,
        label: () => t("table.playerList.memo"),
      },
      enableSorting: false,
      cell: ({ row }) => <span>{row.original.ref.$memo ?? ""}</span>,
    },
  ];

  return cols;
};
