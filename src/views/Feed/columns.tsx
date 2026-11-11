import AvatarInfo from "../../components/AvatarInfo.vue";
import Location from "../../components/Location.vue";
import Badge from "../../components/ui/badge/Badge.vue";
import Button from "../../components/ui/button/Button.vue";
import Tooltip from "../../components/ui/tooltip/Tooltip.vue";
import TooltipContent from "../../components/ui/tooltip/TooltipContent.vue";
import TooltipTrigger from "../../components/ui/tooltip/TooltipTrigger.vue";
import { ArrowDown, ArrowRight, ArrowUpDown, ChevronDown, ChevronRight } from "lucide-vue-next";
import { formatDateFilter } from "../../coordinators/date-coordinator";
import { getFaviconUrl } from "../../shared/utils/url-utils";
import { openExternalLink } from "../../shared/utils/app-actions";
import { replaceBioSymbols } from "../../shared/utils/base/string";
import { statusClass } from "../../shared/utils/user";
import { timeToText } from "../../shared/utils/base/format";
import { i18n } from "../../plugins/i18n";
import { useGalleryStore } from "../../stores/gallery";
import { useFriendStore } from "../../stores/friend";
import { showUserDialog } from "../../coordinators/user-coordinator";
import UserContextMenu from "../../components/UserContextMenu.vue";
import type { FeedRow } from "../../services/database/feed";
import type { useVrcxVueTable } from "../../lib/table/use-vrcx-vue-table";

type FeedFriendStore = ReturnType<typeof useFriendStore>;
type FeedTableOptions = Parameters<typeof useVrcxVueTable<FeedRow>>[0];
type FeedColumn = Extract<FeedTableOptions["columns"], unknown[]>[number];
type BioLink = { link: string; className: string };
type FeedBioRow = Extract<FeedRow, { type: "Bio" }>;

const { t } = i18n.global;
let friendStore: FeedFriendStore | undefined;

const getFriendStore = (): FeedFriendStore => {
  friendStore ??= useFriendStore();
  return friendStore;
};

export const expandedRow = ({ row }: { row: { original: FeedRow } }) => {
  const original = row.original;
  const { showFullscreenImageDialog } = useGalleryStore();
  if (original.type === "GPS") {
    return (
      <div class="pl-5 text-sm">
        {original.previousLocation ? (
          <>
            <Location location={original.previousLocation} class="inline-block" enableContextMenu />
            <Badge variant="secondary" class="ml-1 w-fit">
              {timeToText(original.time ?? 0)}
            </Badge>
            <br />
            <span>
              <ArrowDown />
            </span>
          </>
        ) : null}
        {original.location ? (
          <Location location={original.location} hint={original.worldName ?? ""} grouphint={original.groupName ?? ""} enableContextMenu />
        ) : null}
      </div>
    );
  }

  if (original.type === "Offline") {
    return original.location ? (
      <div class="pl-5 text-sm">
        <Location location={original.location} hint={original.worldName ?? ""} grouphint={original.groupName ?? ""} enableContextMenu />
        <Badge variant="secondary" class="ml-1 w-fit">
          {timeToText(original.time ?? 0)}
        </Badge>
      </div>
    ) : null;
  }

  if (original.type === "Online") {
    return original.location ? (
      <div class="pl-5 text-sm">
        <Location location={original.location} hint={original.worldName ?? ""} grouphint={original.groupName ?? ""} enableContextMenu />
      </div>
    ) : null;
  }

  if (original.type === "Avatar") {
    return (
      <div class="pl-5 text-sm">
        <div class="flex items-center">
          <div class="inline-block align-top w-40">
            {original.previousCurrentAvatarThumbnailImageUrl ? (
              <>
                <img
                  src={original.previousCurrentAvatarThumbnailImageUrl}
                  class="cursor-pointer h-30 w-40 rounded pointer"
                  loading="lazy"
                  onClick={() => showFullscreenImageDialog(original.previousCurrentAvatarImageUrl ?? "", "")}
                />
                <br />
                <AvatarInfo imageurl={original.previousCurrentAvatarThumbnailImageUrl} userid={original.userId ?? ""} />
              </>
            ) : null}
          </div>
          <span class="mx-2">
            <ArrowRight />
          </span>
          <div class="inline-block align-top w-40">
            {original.currentAvatarThumbnailImageUrl ? (
              <>
                <img
                  src={original.currentAvatarThumbnailImageUrl}
                  class="cursor-pointer h-30 w-40 rounded pointer"
                  loading="lazy"
                  onClick={() => showFullscreenImageDialog(original.currentAvatarImageUrl ?? "", "")}
                />
                <br />
                <AvatarInfo
                  imageurl={original.currentAvatarThumbnailImageUrl}
                  userid={original.userId ?? ""}
                  hintownerid={original.ownerId ?? ""}
                  hintavatarname={original.avatarName ?? ""}
                />
              </>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (original.type === "Status") {
    return (
      <div class="flex items-center pl-5 text-sm">
        <i class={["x-user-status", statusClass(original.previousStatus ?? undefined)]}></i>
        <span class="ml-1">{original.previousStatusDescription}</span>
        <br />
        <span class="mx-2">
          <ArrowRight />
        </span>
        <i class={["x-user-status", statusClass(original.status ?? undefined), "mx-1"]}></i>
        <span>{original.statusDescription}</span>
      </div>
    );
  }

  if (!isBioRow(original)) return null;
  const links = getBioLinksDifference(toLinkList(original.previousBioLinks), toLinkList(original.bioLinks));
  return (
    <div class="pl-5 text-sm">
      <pre
        class="text-xs leading-5.5 whitespace-pre-wrap font-[inherit]"
        innerHTML={formatDifference(replaceBioSymbols(original.previousBio), replaceBioSymbols(original.bio))}
      ></pre>
      {links.length ? (
        <div class="mt-1 flex flex-col gap-0.5 text-xs">
          {links.map(({ link, className }) => (
            <span class="flex items-center gap-1 cursor-pointer" onClick={() => openExternalLink(link)}>
              <img src={getFaviconUrl(link)} class="size-4" loading="lazy" />
              <span class={className}>{link}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export const columns: FeedColumn[] = [
  {
    id: "expander",
    header: () => null,
    enableSorting: false,
    size: 20,
    minSize: 0,
    maxSize: 20,
    meta: {
      expandedRow,
    },
    cell: ({ row }) => {
      if (!row.getCanExpand()) {
        return null;
      }
      return (
        <button
          type="button"
          class="inline-flex h-6 items-center justify-center text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          onClick={(event) => {
            event.stopPropagation();
            row.toggleExpanded();
          }}
        >
          {row.getIsExpanded() ? <ChevronDown /> : <ChevronRight />}
        </button>
      );
    },
  },
  {
    accessorKey: "created_at",
    size: 140,
    meta: { label: () => t("table.feed.date") },
    header: ({ column }) => (
      <Button variant="ghost" class="pl-0!" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        {t("table.feed.date")}
        <ArrowUpDown class="ml-1 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const createdAt = row.original.created_at;
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
  },
  {
    accessorKey: "type",
    size: 130,
    header: () => t("table.feed.type"),
    meta: { label: () => t("table.feed.type") },
    cell: ({ row }) => {
      const type = row.original.type;
      return (
        <div>
          <Badge variant="outline" class="text-muted-foreground">
            {t(`view.feed.filters.${type}`)}
          </Badge>
        </div>
      );
    },
  },
  {
    accessorKey: "displayName",
    size: 190,
    header: () => t("table.feed.user"),
    meta: { label: () => t("table.feed.user") },
    cell: ({ row }) => {
      const original = row.original;
      const friend = original.userId === null ? undefined : getFriendStore().friends.get(original.userId);
      return (
        <UserContextMenu userId={original.userId ?? ""} state={friend?.state ?? ""} location={friend?.ref?.location ?? ""}>
          <span class="cursor-pointer pr-2.5" onClick={() => showUserDialog(original.userId)}>
            {original.displayName}
          </span>
        </UserContextMenu>
      );
    },
  },
  {
    id: "detail",
    header: () => t("table.feed.detail"),
    enableSorting: false,
    minSize: 100,
    meta: {
      stretch: true,
      label: () => t("table.feed.detail"),
    },
    cell: ({ row }) => renderFeedDetail(row.original),
  },
];

export function renderFeedDetail(original: FeedRow) {
  if (original.type === "GPS") {
    return original.location ? (
      <div class="w-full min-w-0 truncate">
        <Location location={original.location} hint={original.worldName ?? ""} grouphint={original.groupName ?? ""} enableContextMenu disableTooltip />
      </div>
    ) : null;
  }

  if (original.type === "Offline" || original.type === "Online") {
    return original.location ? (
      <div class="w-full min-w-0 truncate">
        <Location location={original.location} hint={original.worldName ?? ""} grouphint={original.groupName ?? ""} enableContextMenu disableTooltip />
      </div>
    ) : null;
  }

  if (original.type === "Status") {
    if (original.statusDescription === original.previousStatusDescription) {
      return (
        <div class="flex items-center">
          <i class={["x-user-status", statusClass(original.previousStatus ?? undefined)]}></i>
          <span class="mx-2">
            <ArrowRight />
          </span>
          <i class={["x-user-status", statusClass(original.status ?? undefined)]}></i>
        </div>
      );
    }

    return (
      <div class="w-full min-w-0 truncate">
        <i style="display:-webkit-inline-box" class={["x-user-status", "mr-2", statusClass(original.status ?? undefined)]}></i>
        <span style="display:-webkit-inline-box">{original.statusDescription}</span>
      </div>
    );
  }

  if (original.type === "Avatar") {
    return (
      <div class="w-full min-w-0 truncate">
        <AvatarInfo
          imageurl={original.currentAvatarImageUrl ?? ""}
          userid={original.userId ?? ""}
          hintownerid={original.ownerId ?? ""}
          hintavatarname={original.avatarName ?? ""}
        />
      </div>
    );
  }

  if (!isBioRow(original)) return null;
  return <span class="block w-full min-w-0 truncate">{replaceBioSymbols(original.bio)}</span>;
}

function isBioRow(row: FeedRow): row is FeedBioRow {
  return row.type === "Bio";
}

function toLinkList(value: unknown[]): string[] {
  return value.filter((link): link is string => typeof link === "string");
}

function getBioLinksDifference(previousLinks: string[] = [], links: string[] = []): BioLink[] {
  return [
    ...links.map((link) => ({
      link,
      className: previousLinks.includes(link) ? "" : "x-text-added",
    })),
    ...previousLinks.filter((link) => !links.includes(link)).map((link) => ({ link, className: "x-text-removed" })),
  ];
}

function formatDifference(
  oldString: string,
  newString: string,
  markerAddition = '<span class="x-text-added">{{text}}</span>',
  markerDeletion = '<span class="x-text-removed">{{text}}</span>'
): string {
  const escapeHtml = (s: string) =>
    s
      .replaceAll(/&/g, "&amp;")
      .replaceAll(/</g, "&lt;")
      .replaceAll(/>/g, "&gt;")
      .replaceAll(/"/g, "&quot;")
      .replaceAll(/'/g, "&#039;")
      .replaceAll(/\n/g, "<br>");
  const oldText = escapeHtml(oldString);
  const newText = escapeHtml(newString);

  const oldWords = oldText.split(/\s+/).flatMap((word) => word.split(/(<br>)/));
  const newWords = newText.split(/\s+/).flatMap((word) => word.split(/(<br>)/));

  function findLongestMatch(oldStart: number, oldEnd: number, newStart: number, newEnd: number) {
    let bestOldStart = oldStart;
    let bestNewStart = newStart;
    let bestSize = 0;

    const lookup = new Map<string, number[]>();
    for (let i = oldStart; i < oldEnd; i++) {
      const word = oldWords[i] ?? "";
      if (!lookup.has(word)) lookup.set(word, []);
      lookup.get(word)?.push(i);
    }

    for (let j = newStart; j < newEnd; j++) {
      const word = newWords[j] ?? "";
      if (!lookup.has(word)) continue;

      for (const i of lookup.get(word) ?? []) {
        let size = 0;
        while (i + size < oldEnd && j + size < newEnd && oldWords[i + size] === newWords[j + size]) {
          size++;
        }
        if (size > bestSize) {
          bestOldStart = i;
          bestNewStart = j;
          bestSize = size;
        }
      }
    }

    return {
      oldStart: bestOldStart,
      newStart: bestNewStart,
      size: bestSize,
    };
  }

  function buildDiff(oldStart: number, oldEnd: number, newStart: number, newEnd: number): string[] {
    const result: string[] = [];
    const match = findLongestMatch(oldStart, oldEnd, newStart, newEnd);

    if (match.size > 0) {
      if (oldStart < match.oldStart || newStart < match.newStart) {
        result.push(...buildDiff(oldStart, match.oldStart, newStart, match.newStart));
      }

      result.push(oldWords.slice(match.oldStart, match.oldStart + match.size).join(" "));

      if (match.oldStart + match.size < oldEnd || match.newStart + match.size < newEnd) {
        result.push(...buildDiff(match.oldStart + match.size, oldEnd, match.newStart + match.size, newEnd));
      }
    } else {
      function build(words: string[], start: number, end: number, pattern: string): string[] {
        const r: string[] = [];
        const ts = words
          .slice(start, end)
          .filter((w) => w.length > 0)
          .join(" ")
          .split("<br>");
        for (let i = 0; i < ts.length; i++) {
          if (i > 0) r.push("<br>");
          const text = ts[i] ?? "";
          if (text.length < 1) continue;
          r.push(pattern.replace("{{text}}", text));
        }
        return r;
      }

      if (oldStart < oldEnd) result.push(...build(oldWords, oldStart, oldEnd, markerDeletion));

      if (newStart < newEnd) result.push(...build(newWords, newStart, newEnd, markerAddition));
    }

    return result;
  }

  return buildDiff(0, oldWords.length, 0, newWords.length)
    .join(" ")
    .replace(/<br>[ ]+<br>/g, "<br><br>")
    .replace(/<br> /g, "<br>");
}
